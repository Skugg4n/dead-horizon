import Phaser from 'phaser';
import { SaveManager } from '../systems/SaveManager';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import type { GameState, WeaponInstance, ResourceType, ZoneId, SkillType } from '../config/types';
import weaponsData from '../data/weapons.json';
import zonesData from '../data/zones.json';
import skillsData from '../data/skills.json';
import { AudioManager } from '../systems/AudioManager';

// How many weapons the player may carry into the next zone
const MAX_WEAPONS = 4;
// Total resource budget across all resource types
const RESOURCE_BUDGET = 50;
// Minimum step when adjusting resources with +/- controls
const RESOURCE_STEP = 1;
// Hold-click repeat: initial delay (ms) before auto-repeat starts
const HOLD_INITIAL_DELAY = 300;
// Hold-click repeat: starting repeat interval (ms) = 3/sec
const HOLD_REPEAT_SLOW = 333;
// Hold-click repeat: fast repeat interval (ms) = 10/sec (after 1 second of holding)
const HOLD_REPEAT_FAST = 100;
// Time in ms before auto-repeat accelerates
const HOLD_ACCELERATE_AFTER = 1000;

// Display order for resources on the screen
const RESOURCE_ORDER: ResourceType[] = ['scrap', 'ammo', 'parts', 'food', 'meds'];

// Human-readable resource labels
const RESOURCE_LABELS: Record<ResourceType, string> = {
  scrap: 'Scrap',
  ammo: 'Ammo',
  parts: 'Parts',
  food: 'Food',
  meds: 'Meds',
};

// Colors used for each rarity tier
const RARITY_COLORS: Record<string, number> = {
  common: 0xaaaaaa,
  uncommon: 0x44cc88,
  rare: 0x4488ff,
  legendary: 0xffaa00,
};

// Zone display names for the "MOVING TO:" header, sourced from zones.json
const ZONE_NAMES: Partial<Record<ZoneId, string>> = Object.fromEntries(
  (zonesData.zones as Array<{ id: string; name: string }>).map(z => [z.id, z.name])
) as Partial<Record<ZoneId, string>>;

// Which zone follows which (mirrors ZoneCompleteScene)
const NEXT_ZONE: Partial<Record<ZoneId, ZoneId>> = {
  forest: 'city',
  city: 'military',
};

interface PackYourBagData {
  fromZone: ZoneId;
}

// Internal state for one weapon slot in this screen
interface WeaponSlot {
  instance: WeaponInstance;
  weaponName: string;
  rarity: string;
  damage: number;
  selected: boolean;
  // Phaser UI objects
  container: Phaser.GameObjects.Container;
  checkBox: Phaser.GameObjects.Text;
  bgRect: Phaser.GameObjects.Rectangle;
}

// Internal state for one resource row
interface ResourceRow {
  type: ResourceType;
  have: number;    // how many the player currently has
  taking: number;  // how many the player chose to take
  // Phaser UI objects
  countText: Phaser.GameObjects.Text;
  barFill: Phaser.GameObjects.Rectangle;
  minusBtn: Phaser.GameObjects.Text;
  plusBtn: Phaser.GameObjects.Text;
  maxBtn: Phaser.GameObjects.Text;
}

// Tracks an active hold-click repeat timer
interface HoldTimer {
  event: Phaser.Time.TimerEvent | null;
  accelerated: boolean;
  startTime: number;
}

// Skill data shape from skills.json for XP-to-level conversion
interface SkillDef {
  id: string;
  name: string;
  maxLevel: number;
  xpPerLevel: number[];
}

export class PackYourBagScene extends Phaser.Scene {
  // References kept so we can update them on every change
  private weaponSlots: WeaponSlot[] = [];
  private resourceRows: ResourceRow[] = [];
  private budgetText!: Phaser.GameObjects.Text;
  private moveOutBtn!: Phaser.GameObjects.Text;
  private moveOutBg!: Phaser.GameObjects.Rectangle;

  // The loaded save state (read-only reference; we mutate a copy on MOVE OUT)
  private state!: GameState;
  // Which zone we are transitioning into
  private nextZone!: ZoneId;

  // Track which resource row is "focused" for keyboard +/- control
  private focusedResourceIndex: number = 0;
  // Track the keyboard handler so we can clean up on shutdown
  private kbHandler: ((e: KeyboardEvent) => void) | null = null;

  // Hold-click timers for minus and plus buttons (one per resource row)
  private holdTimers: Map<string, HoldTimer> = new Map();

  // Scrollable content container and its current scroll offset
  private scrollContainer!: Phaser.GameObjects.Container;
  private scrollY: number = 0;
  private contentHeight: number = 0;
  // Visible area for content (below header, above button)
  private readonly SCROLL_TOP = 52;
  private readonly SCROLL_BOTTOM = GAME_HEIGHT - 60;
  private readonly SCROLL_VIEW_H = (GAME_HEIGHT - 60) - 52;

  constructor() {
    super({ key: 'PackYourBagScene' });
  }

  create(data: PackYourBagData): void {
    this.cameras.main.setBackgroundColor('#080D10');

    this.state = SaveManager.load();

    // Resolve next zone; fall back to military if somehow undefined
    const fromZone: ZoneId = data?.fromZone ?? this.state.zone;
    this.nextZone = NEXT_ZONE[fromZone] ?? 'military';

    const cx = GAME_WIDTH / 2;

    // Reset scroll state on each create
    this.scrollY = 0;
    this.holdTimers.clear();

    // --- Background grid lines for atmosphere ---
    this.drawBackgroundGrid();

    // --- Header (fixed, not scrolled) ---
    this.buildHeader(cx, this.nextZone);

    // --- Scrollable content container ---
    // All sections below the header live inside this container so they can scroll together
    this.scrollContainer = this.add.container(0, this.SCROLL_TOP);

    // --- Weapons section ---
    const weaponsStartY = 8;
    this.buildWeaponsSection(cx, weaponsStartY);

    // Divider after weapons
    const divider1Y = weaponsStartY + 22 + Math.min(this.state.inventory.weapons.length, 6) * 28 + 6;
    const dividerLine1 = this.add.graphics();
    dividerLine1.lineStyle(1, 0x334433, 0.8);
    dividerLine1.lineBetween(24, divider1Y, GAME_WIDTH - 24, divider1Y);
    this.scrollContainer.add(dividerLine1);

    // --- Resources section ---
    const resourcesStartY = divider1Y + 10;
    this.buildResourcesSection(cx, resourcesStartY);

    // Divider after resources
    const divider2Y = resourcesStartY + 22 + RESOURCE_ORDER.length * 30 + 6;
    const dividerLine2 = this.add.graphics();
    dividerLine2.lineStyle(1, 0x334433, 0.8);
    dividerLine2.lineBetween(24, divider2Y, GAME_WIDTH - 24, divider2Y);
    this.scrollContainer.add(dividerLine2);

    // --- Refugees + Skills sections (display only) ---
    const infoStartY = divider2Y + 10;
    this.buildInfoSection(cx, infoStartY);

    // Record total content height for scroll clamping
    this.contentHeight = infoStartY + 120; // approximate; includes refugees + skills

    // --- Clip mask so content doesn't bleed over header/button ---
    // (Phaser mask via graphics)
    const maskShape = this.add.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, this.SCROLL_TOP, GAME_WIDTH, this.SCROLL_VIEW_H);
    const mask = maskShape.createGeometryMask();
    this.scrollContainer.setMask(mask);

    // --- Mouse wheel scroll ---
    this.input.on('wheel', (_ptr: unknown, _gos: unknown, _dx: number, dy: number) => {
      this.applyScroll(dy * 0.8);
    });

    // --- MOVE OUT button (fixed, not scrolled) ---
    this.buildMoveOutButton(cx, GAME_HEIGHT - 30);

    // --- Keyboard input ---
    this.setupKeyboard();
  }

  // -------------------------------------------------------------------------
  // Header
  // -------------------------------------------------------------------------

  private buildHeader(cx: number, nextZone: ZoneId): void {
    const nextName = ZONE_NAMES[nextZone] ?? nextZone.toUpperCase();

    // Top title bar background
    const headerBg = this.add.rectangle(cx, 20, GAME_WIDTH, 40, 0x000000, 0.7);
    headerBg.setDepth(0);

    this.add.text(cx, 6, `MOVING TO: ${nextName.toUpperCase()}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#FFD700',
    }).setOrigin(0.5, 0).setDepth(1);

    this.add.text(cx, 26, '"Pack what you can carry"', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#667766',
    }).setOrigin(0.5, 0).setDepth(1);
  }

  // -------------------------------------------------------------------------
  // Weapons section
  // -------------------------------------------------------------------------

  private buildWeaponsSection(cx: number, startY: number): void {
    // Section header (10px per spec)
    const header = this.add.text(24, startY, `WEAPONS (max ${MAX_WEAPONS}):`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#AADDAA',
    }).setOrigin(0, 0);
    this.scrollContainer.add(header);

    const weaponDefs = (weaponsData.weapons as Array<{
      id: string;
      name: string;
      damage: number;
      rarity: string;
    }>);

    const weapons = this.state.inventory.weapons;
    // Show at most 6 weapons; player must scroll if they have more
    const visibleCount = Math.min(weapons.length, 6);

    weapons.forEach((instance, index) => {
      if (index >= 6) return; // only show up to 6 slots

      const def = weaponDefs.find(w => w.id === instance.weaponId);
      const weaponName = def?.name ?? instance.weaponId;
      const rarity = instance.rarity ?? def?.rarity ?? 'common';
      const damage = def?.damage ?? 0;

      // Default: select the first MAX_WEAPONS weapons
      const selected = index < MAX_WEAPONS;

      const slotY = startY + 16 + index * 28;

      // Slot background rectangle
      const bgRect = this.add.rectangle(
        cx,
        slotY + 10,
        GAME_WIDTH - 48,
        24,
        selected ? 0x0a2010 : 0x050a08,
        0.9
      ).setOrigin(0.5, 0.5);
      this.scrollContainer.add(bgRect);

      // Keyboard hint (1-6 for visible slots)
      const keyHint = this.add.text(28, slotY + 2, `[${index + 1}]`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#445544',
      }).setOrigin(0, 0);
      this.scrollContainer.add(keyHint);

      // Checkbox indicator (8px per spec: items)
      const checkBox = this.add.text(50, slotY + 2, selected ? '[x]' : '[ ]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: selected ? '#44EE88' : '#445544',
      }).setOrigin(0, 0);
      this.scrollContainer.add(checkBox);

      // Weapon name -- resolve rarity color with explicit fallback to avoid undefined
      const rarityColorVal: number = RARITY_COLORS[rarity] ?? 0xaaaaaa;
      const rarityColorHex = '#' + rarityColorVal.toString(16).padStart(6, '0');
      const nameText = this.add.text(90, slotY + 2, weaponName, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: rarityColorHex,
      }).setOrigin(0, 0);
      this.scrollContainer.add(nameText);

      // Rarity tag
      const rarityTag = this.add.text(GAME_WIDTH - 110, slotY + 2, `[${rarity}]`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: rarityColorHex,
      }).setOrigin(0, 0);
      this.scrollContainer.add(rarityTag);

      // Damage stat
      const dmgText = this.add.text(GAME_WIDTH - 60, slotY + 2, `dmg:${damage}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#888888',
      }).setOrigin(0, 0);
      this.scrollContainer.add(dmgText);

      // Container groups objects logically but they're already added to scrollContainer
      const container = this.add.container(0, 0);

      // Make the slot interactive -- clicking toggles selection
      bgRect.setInteractive({ useHandCursor: true });
      bgRect.on('pointerdown', () => this.toggleWeapon(index));
      bgRect.on('pointerover', () => { bgRect.setFillStyle(0x0d2818, 0.9); });
      bgRect.on('pointerout', () => {
        const s = this.weaponSlots[index];
        if (s) {
          bgRect.setFillStyle(s.selected ? 0x0a2010 : 0x050a08, 0.9);
        }
      });

      const slot: WeaponSlot = {
        instance,
        weaponName,
        rarity,
        damage,
        selected,
        container,
        checkBox,
        bgRect,
      };

      this.weaponSlots.push(slot);
    });

    // Hint when player has more than 6 weapons
    if (weapons.length > 6) {
      const overflowY = startY + 16 + visibleCount * 28 + 4;
      const overflowHint = this.add.text(cx, overflowY, `(${weapons.length - 6} more not shown)`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#445544',
      }).setOrigin(0.5, 0);
      this.scrollContainer.add(overflowHint);
    }
  }

  // -------------------------------------------------------------------------
  // Resources section
  // -------------------------------------------------------------------------

  private buildResourcesSection(cx: number, startY: number): void {
    // Section header (10px per spec: headers)
    const header = this.add.text(24, startY, 'RESOURCES:', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#AADDAA',
    }).setOrigin(0, 0);
    this.scrollContainer.add(header);

    // Budget counter (updates dynamically) -- right-aligned with header
    this.budgetText = this.add.text(GAME_WIDTH - 24, startY, `0/${RESOURCE_BUDGET}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#DDAA44',
    }).setOrigin(1, 0);
    this.scrollContainer.add(this.budgetText);

    // Keyboard hint for resources
    const kbHint = this.add.text(24, startY + 14, 'Arrow keys: navigate/adjust', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#334433',
    }).setOrigin(0, 0);
    this.scrollContainer.add(kbHint);

    const BAR_WIDTH = 100;
    // Bar starts after label (label ~80px wide at 8px font)
    const LABEL_X = 24;
    const MINUS_X = LABEL_X + 88;
    const BAR_X = MINUS_X + 26;
    const PLUS_X = BAR_X + BAR_WIDTH + 6;
    const MAX_X = PLUS_X + 36;
    const COUNT_X = MAX_X + 38;

    RESOURCE_ORDER.forEach((type, rowIndex) => {
      const have = this.state.inventory.resources[type] ?? 0;
      const taking = 0; // rows start at 0; player allocates budget manually

      const rowY = startY + 28 + rowIndex * 30;

      // Row background -- highlighted when focused
      const isFocused = rowIndex === this.focusedResourceIndex;
      const rowBg = this.add.rectangle(cx, rowY + 11, GAME_WIDTH - 48, 24,
        isFocused ? 0x0d2a10 : 0x080d0a, 0.8
      ).setOrigin(0.5, 0.5);
      this.scrollContainer.add(rowBg);

      // Resource label (9px = items per spec)
      const labelText = this.add.text(LABEL_X, rowY + 2, RESOURCE_LABELS[type], {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#7aaa88',
      }).setOrigin(0, 0);
      this.scrollContainer.add(labelText);

      // Minus button -- hold-repeat supported
      const minusBtn = this.add.text(MINUS_X, rowY + 2, '[-]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#cc4444',
      }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      this.scrollContainer.add(minusBtn);

      // Bar background
      this.add.rectangle(BAR_X + BAR_WIDTH / 2, rowY + 11, BAR_WIDTH, 10, 0x1a2a1a, 1)
        .setOrigin(0.5, 0.5);
      // (not adding bar bg to scrollContainer -- it'll be added below in the same call)

      // Actually we must add bar bg to scrollContainer too
      const barBg = this.add.rectangle(BAR_X + BAR_WIDTH / 2, rowY + 11, BAR_WIDTH, 10, 0x1a2a1a, 1)
        .setOrigin(0.5, 0.5);
      this.scrollContainer.add(barBg);

      // Bar fill (width updated dynamically)
      const barFill = this.add.rectangle(
        BAR_X, rowY + 11, 0, 8, 0x22cc55, 1
      ).setOrigin(0, 0.5);
      this.scrollContainer.add(barFill);

      // Plus button -- hold-repeat supported
      const plusBtn = this.add.text(PLUS_X, rowY + 2, '[+]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#44cc44',
      }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      this.scrollContainer.add(plusBtn);

      // MAX button -- fills to min(have, remaining budget)
      const maxBtn = this.add.text(MAX_X, rowY + 2, '[MAX]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#886622',
      }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      this.scrollContainer.add(maxBtn);

      // Count text "taking/have"
      const countText = this.add.text(COUNT_X, rowY + 2, `0/${have}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#aaaaaa',
      }).setOrigin(0, 0);
      this.scrollContainer.add(countText);

      const row: ResourceRow = {
        type,
        have,
        taking,
        countText,
        barFill,
        minusBtn,
        plusBtn,
        maxBtn,
      };

      this.resourceRows.push(row);

      // --- Wire up hold-click for minus button ---
      const minusKey = `minus_${rowIndex}`;
      minusBtn.on('pointerdown', () => {
        this.focusedResourceIndex = rowIndex;
        this.adjustResource(rowIndex, -RESOURCE_STEP);
        this.startHold(minusKey, rowIndex, -RESOURCE_STEP);
      });
      minusBtn.on('pointerup', () => this.stopHold(minusKey));
      minusBtn.on('pointerout', () => {
        this.stopHold(minusKey);
        minusBtn.setColor('#cc4444');
      });

      // --- Wire up hold-click for plus button ---
      const plusKey = `plus_${rowIndex}`;
      plusBtn.on('pointerdown', () => {
        this.focusedResourceIndex = rowIndex;
        this.adjustResource(rowIndex, +RESOURCE_STEP);
        this.startHold(plusKey, rowIndex, +RESOURCE_STEP);
      });
      plusBtn.on('pointerup', () => this.stopHold(plusKey));
      plusBtn.on('pointerout', () => {
        this.stopHold(plusKey);
        plusBtn.setColor('#44cc44');
      });

      // MAX button: fill to min(have, remaining budget)
      maxBtn.on('pointerdown', () => {
        this.focusedResourceIndex = rowIndex;
        this.maxResource(rowIndex);
      });

      // Visual hover for buttons
      minusBtn.on('pointerover', () => minusBtn.setColor('#ff6666'));
      plusBtn.on('pointerover', () => plusBtn.setColor('#66ff66'));
      maxBtn.on('pointerover', () => maxBtn.setColor('#ffcc44'));
      maxBtn.on('pointerout', () => maxBtn.setColor('#886622'));
    });

    this.updateBudgetDisplay();
  }

  // -------------------------------------------------------------------------
  // Refugees + Skills info section (read-only)
  // -------------------------------------------------------------------------

  private buildInfoSection(_cx: number, startY: number): void {
    const refugees = this.state.refugees;
    const skills = this.state.player.skills;
    const skillDefs = (skillsData.skills as SkillDef[]);

    // --- Refugees ---
    const refugeeHeader = this.add.text(24, startY, 'REFUGEES: (all follow you)', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#AADDAA',
    }).setOrigin(0, 0);
    this.scrollContainer.add(refugeeHeader);

    if (refugees.length === 0) {
      const noneText = this.add.text(24, startY + 16, 'None', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#445544',
      }).setOrigin(0, 0);
      this.scrollContainer.add(noneText);
    } else {
      // Show refugees as a comma-separated list, wrapping at GAME_WIDTH - 48
      const refugeeText = refugees
        .map(r => `${r.name} [${r.status}]`)
        .join('  ');
      const refugeeList = this.add.text(24, startY + 16, refugeeText, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#88aa88',
        wordWrap: { width: GAME_WIDTH - 48 },
      }).setOrigin(0, 0);
      this.scrollContainer.add(refugeeList);
    }

    // --- Skills ---
    const skillsY = startY + (refugees.length > 0 ? 44 : 32);

    const skillHeader = this.add.text(24, skillsY, 'SKILLS: (all kept)', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#AADDAA',
    }).setOrigin(0, 0);
    this.scrollContainer.add(skillHeader);

    // Convert raw XP to level using skill thresholds from skills.json
    // Show only skills the player has invested in (XP > 0 and level >= 1)
    const activeSkills = (Object.entries(skills) as Array<[SkillType, number]>)
      .filter(([, xp]) => xp > 0)
      .map(([id, xp]) => {
        const def = skillDefs.find(s => s.id === id);
        const shortName = def ? this.shortenSkillName(def.name) : id;
        const level = def ? this.xpToLevel(xp, def) : 0;
        if (level < 1) return null;
        return `${shortName} Lv${level}`;
      })
      .filter((s): s is string => s !== null);

    const skillLine = activeSkills.length > 0 ? activeSkills.join('  ') : 'None yet';

    const skillList = this.add.text(24, skillsY + 16, skillLine, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#8888cc',
      wordWrap: { width: GAME_WIDTH - 48 },
    }).setOrigin(0, 0);
    this.scrollContainer.add(skillList);
  }

  // -------------------------------------------------------------------------
  // MOVE OUT button
  // -------------------------------------------------------------------------

  private buildMoveOutButton(cx: number, y: number): void {
    this.moveOutBg = this.add.rectangle(cx, y, 260, 28, 0x0a2808, 1)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    this.add.rectangle(cx, y, 262, 30, 0x22aa44, 1)
      .setOrigin(0.5, 0.5)
      .setDepth(0);

    this.moveOutBtn = this.add.text(cx, y, 'MOVE OUT >>', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#44FF88',
    }).setOrigin(0.5, 0.5).setDepth(2);

    this.moveOutBg.setDepth(1);

    this.moveOutBg.on('pointerover', () => {
      this.moveOutBg.setFillStyle(0x156a2e, 1);
      this.moveOutBtn.setColor('#AAFFCC');
    });
    this.moveOutBg.on('pointerout', () => {
      this.moveOutBg.setFillStyle(0x0a2808, 1);
      this.moveOutBtn.setColor('#44FF88');
    });
    this.moveOutBg.on('pointerdown', () => this.confirmMoveOut());

    // Gentle pulsing border to draw attention
    this.tweens.add({
      targets: this.moveOutBtn,
      alpha: { from: 1, to: 0.6 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // -------------------------------------------------------------------------
  // Keyboard input
  // -------------------------------------------------------------------------

  private setupKeyboard(): void {
    this.kbHandler = (e: KeyboardEvent): void => {
      // 1-9: toggle weapon slots
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < this.weaponSlots.length) {
          this.toggleWeapon(idx);
        }
        return;
      }

      // Arrow Up/Down or W/S: cycle focused resource row
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        this.focusedResourceIndex = Math.max(0, this.focusedResourceIndex - 1);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        this.focusedResourceIndex = Math.min(
          RESOURCE_ORDER.length - 1,
          this.focusedResourceIndex + 1
        );
        return;
      }

      // Left/Right arrows or +/- : adjust focused resource
      if (e.key === 'ArrowLeft' || e.key === '-' || e.key === '_') {
        this.adjustResource(this.focusedResourceIndex, -RESOURCE_STEP);
        return;
      }
      if (e.key === 'ArrowRight' || e.key === '=' || e.key === '+') {
        this.adjustResource(this.focusedResourceIndex, +RESOURCE_STEP);
        return;
      }

      // Enter or Space: confirm
      if (e.key === 'Enter' || e.key === ' ') {
        this.confirmMoveOut();
      }
    };

    this.input.keyboard?.on('keydown', this.kbHandler);

    this.events.once('shutdown', () => {
      if (this.kbHandler) {
        this.input.keyboard?.off('keydown', this.kbHandler);
        this.kbHandler = null;
      }
      // Stop all hold timers on scene shutdown
      this.stopAllHolds();
    });
  }

  // -------------------------------------------------------------------------
  // Interaction logic
  // -------------------------------------------------------------------------

  /**
   * Toggle whether weapon at `index` is selected for packing.
   * Enforces the MAX_WEAPONS cap: cannot select more than 4 weapons.
   */
  private toggleWeapon(index: number): void {
    const slot = this.weaponSlots[index];
    if (!slot) return;

    if (slot.selected) {
      // Deselect always allowed
      slot.selected = false;
    } else {
      // Only allow selection if under the cap
      const selectedCount = this.weaponSlots.filter(s => s.selected).length;
      if (selectedCount >= MAX_WEAPONS) {
        // Flash the checkbox red to indicate cap reached
        this.tweens.add({
          targets: slot.checkBox,
          alpha: { from: 1, to: 0.2 },
          duration: 150,
          yoyo: true,
          repeat: 3,
        });
        return;
      }
      slot.selected = true;
    }

    this.updateWeaponSlotUI(index);
    AudioManager.play('ui_click');
  }

  /**
   * Adjust the "taking" amount for a resource row.
   * Clamped: 0 <= taking <= have, and sum of all taking <= RESOURCE_BUDGET.
   */
  private adjustResource(rowIndex: number, delta: number): void {
    const row = this.resourceRows[rowIndex];
    if (!row) return;

    const currentTotal = this.resourceRows.reduce((sum, r) => sum + r.taking, 0);
    let newTaking = row.taking + delta;

    // Clamp to what the player actually owns
    newTaking = Math.max(0, Math.min(row.have, newTaking));

    // Clamp to remaining budget
    if (delta > 0) {
      const remaining = RESOURCE_BUDGET - currentTotal;
      newTaking = Math.min(row.taking + remaining, newTaking);
    }

    if (newTaking === row.taking) return;

    row.taking = newTaking;
    this.updateResourceRowUI(rowIndex);
    this.updateBudgetDisplay();
  }

  /**
   * Fill a resource row to the maximum allowed by budget.
   * Sets taking = min(have, remaining_budget + current_taking).
   */
  private maxResource(rowIndex: number): void {
    const row = this.resourceRows[rowIndex];
    if (!row) return;

    const currentTotal = this.resourceRows.reduce((sum, r) => sum + r.taking, 0);
    const remaining = RESOURCE_BUDGET - currentTotal;
    // How much more we can add (remaining budget + what this row already has)
    const maxAllowed = row.taking + remaining;
    const newTaking = Math.min(row.have, maxAllowed);

    if (newTaking === row.taking) return;

    row.taking = newTaking;
    this.updateResourceRowUI(rowIndex);
    this.updateBudgetDisplay();
    AudioManager.play('ui_click');
  }

  // -------------------------------------------------------------------------
  // Hold-click auto-repeat
  // -------------------------------------------------------------------------

  /**
   * Start a hold-click auto-repeat timer for a resource button.
   * First fires after HOLD_INITIAL_DELAY ms, then repeats at HOLD_REPEAT_SLOW ms
   * intervals. After HOLD_ACCELERATE_AFTER ms of holding, switches to HOLD_REPEAT_FAST.
   */
  private startHold(key: string, rowIndex: number, delta: number): void {
    this.stopHold(key);

    const holdState: HoldTimer = {
      event: null,
      accelerated: false,
      startTime: this.time.now,
    };
    this.holdTimers.set(key, holdState);

    // Initial delay before auto-repeat begins
    holdState.event = this.time.delayedCall(HOLD_INITIAL_DELAY, () => {
      this.scheduleHoldRepeat(key, rowIndex, delta, holdState);
    });
  }

  /**
   * Schedule the next hold-repeat tick, accelerating if the hold has been long enough.
   */
  private scheduleHoldRepeat(key: string, rowIndex: number, delta: number, holdState: HoldTimer): void {
    if (!this.holdTimers.has(key)) return;

    this.adjustResource(rowIndex, delta);

    const elapsed = this.time.now - holdState.startTime;
    const interval = elapsed >= HOLD_ACCELERATE_AFTER ? HOLD_REPEAT_FAST : HOLD_REPEAT_SLOW;

    holdState.event = this.time.delayedCall(interval, () => {
      this.scheduleHoldRepeat(key, rowIndex, delta, holdState);
    });
  }

  /** Stop auto-repeat for a given button key. */
  private stopHold(key: string): void {
    const holdState = this.holdTimers.get(key);
    if (holdState?.event) {
      holdState.event.remove();
      holdState.event = null;
    }
    this.holdTimers.delete(key);
  }

  /** Stop all active hold timers (called on shutdown). */
  private stopAllHolds(): void {
    for (const [key] of this.holdTimers) {
      this.stopHold(key);
    }
  }

  // -------------------------------------------------------------------------
  // Scroll support
  // -------------------------------------------------------------------------

  private applyScroll(dy: number): void {
    const maxScroll = Math.max(0, this.contentHeight - this.SCROLL_VIEW_H);
    this.scrollY = Math.max(0, Math.min(maxScroll, this.scrollY + dy));
    this.scrollContainer.setY(this.SCROLL_TOP - this.scrollY);
  }

  // -------------------------------------------------------------------------
  // UI update helpers
  // -------------------------------------------------------------------------

  private updateWeaponSlotUI(index: number): void {
    const slot = this.weaponSlots[index];
    if (!slot) return;

    slot.checkBox.setText(slot.selected ? '[x]' : '[ ]');
    slot.checkBox.setColor(slot.selected ? '#44EE88' : '#445544');
    slot.bgRect.setFillStyle(slot.selected ? 0x0a2010 : 0x050a08, 0.9);
  }

  private updateResourceRowUI(rowIndex: number): void {
    const row = this.resourceRows[rowIndex];
    if (!row) return;

    // Update counter text
    row.countText.setText(`${row.taking}/${row.have}`);
    row.countText.setColor(row.taking > 0 ? '#ddaa44' : '#aaaaaa');

    // Update bar fill width proportional to RESOURCE_BUDGET
    const barWidth = 100;
    const fillW = Math.round((row.taking / RESOURCE_BUDGET) * barWidth);
    row.barFill.setSize(fillW, 8);
  }

  private updateBudgetDisplay(): void {
    const total = this.resourceRows.reduce((sum, r) => sum + r.taking, 0);
    const remaining = RESOURCE_BUDGET - total;
    this.budgetText.setText(`${total}/${RESOURCE_BUDGET}`);

    // Color shifts: green when plenty of space, yellow when tight, red when full
    if (remaining === 0) {
      this.budgetText.setColor('#FF4444');
    } else if (remaining < 10) {
      this.budgetText.setColor('#FFAA00');
    } else {
      this.budgetText.setColor('#44FF88');
    }
  }

  // -------------------------------------------------------------------------
  // Skill XP helpers
  // -------------------------------------------------------------------------

  /**
   * Convert a raw XP value to an actual skill level using cumulative xpPerLevel thresholds.
   * Returns 0 if XP is below the first threshold.
   */
  private xpToLevel(xp: number, def: SkillDef): number {
    let level = 0;
    let cumulative = 0;
    for (const threshold of def.xpPerLevel) {
      cumulative += threshold;
      if (xp >= cumulative) {
        level++;
      } else {
        break;
      }
    }
    return Math.min(level, def.maxLevel);
  }

  /**
   * Return a short display name for a skill.
   * Strips common trailing words to keep the display compact.
   */
  private shortenSkillName(name: string): string {
    return name
      .replace(' Proficiency', '')
      .replace(' Combat', '')
      .replace(' & Agility', '');
  }

  // -------------------------------------------------------------------------
  // Background decoration
  // -------------------------------------------------------------------------

  private drawBackgroundGrid(): void {
    const g = this.add.graphics().setDepth(0).setAlpha(0.04);
    g.lineStyle(1, 0x22aa44, 1);

    // Vertical lines every 40px
    for (let x = 0; x <= GAME_WIDTH; x += 40) {
      g.lineBetween(x, 0, x, GAME_HEIGHT);
    }
    // Horizontal lines every 40px
    for (let y = 0; y <= GAME_HEIGHT; y += 40) {
      g.lineBetween(0, y, GAME_WIDTH, y);
    }
  }

  // -------------------------------------------------------------------------
  // Finalise and transition
  // -------------------------------------------------------------------------

  /**
   * Apply the player's choices to GameState, then start DayScene in the next zone.
   * This is the key zone-transition logic:
   *   - Keep only selected weapons (max 4)
   *   - Set resources to chosen amounts (max 50 total)
   *   - Reset base (no structures, level 0)
   *   - Keep refugees, skills, blueprints, achievements
   *   - Set currentWave = 1
   *   - Generate a new mapSeed
   */
  private confirmMoveOut(): void {
    // Disable the button so it can't be double-pressed during the fade
    this.moveOutBg.removeAllListeners();
    this.moveOutBtn.setColor('#aaaaaa');

    // Stop any active hold timers
    this.stopAllHolds();

    // Fade out then apply transition
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.applyZoneTransition();
    });

    AudioManager.play('ui_click');
  }

  private applyZoneTransition(): void {
    const newState: GameState = {
      ...this.state,
      // Zone identifier advances
      zone: this.nextZone,
      // Fresh map seed for the new zone terrain
      mapSeed: Math.floor(Math.random() * 100000),
      inventory: {
        ...this.state.inventory,
        // Only the weapons the player selected (capped at MAX_WEAPONS)
        weapons: this.weaponSlots
          .filter(s => s.selected)
          .map(s => s.instance),
        // Resources the player chose to pack
        resources: {
          scrap: this.getResourceTaking('scrap'),
          ammo: this.getResourceTaking('ammo'),
          parts: this.getResourceTaking('parts'),
          food: this.getResourceTaking('food'),
          meds: this.getResourceTaking('meds'),
        },
        // Clear loaded ammo -- fresh night in new zone
        loadedAmmo: 0,
      },
      // Reset base: no structures, back to level 0
      base: {
        structures: [],
        level: 0,
        hp: this.state.base.maxHp,
        maxHp: this.state.base.maxHp,
      },
      // Reset equipped slots -- NightScene's auto-equip will re-fill them
      equipped: {
        primaryWeaponId: null,
        secondaryWeaponId: null,
      },
      // Wave resets to 1 in the new zone
      progress: {
        ...this.state.progress,
        currentWave: 1,
      },
    };

    SaveManager.save(newState);

    // Start DayScene in the new zone (it reads zone from the saved state)
    this.scene.start('DayScene');
  }

  /** Helper: get how many of a resource type the player is taking. */
  private getResourceTaking(type: ResourceType): number {
    return this.resourceRows.find(r => r.type === type)?.taking ?? 0;
  }
}
