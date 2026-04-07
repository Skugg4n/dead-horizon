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

    // --- Background grid lines for atmosphere ---
    this.drawBackgroundGrid();

    // --- Header ---
    this.buildHeader(cx, this.nextZone);

    // --- Weapons section ---
    const weaponsStartY = 110;
    this.buildWeaponsSection(cx, weaponsStartY);

    // --- Resources section ---
    const resourcesStartY = weaponsStartY + 30 + MAX_WEAPONS * 28 + 20;
    this.buildResourcesSection(cx, resourcesStartY);

    // --- Refugees + Skills sections (display only) ---
    const infoStartY = resourcesStartY + RESOURCE_ORDER.length * 28 + 44;
    this.buildInfoSection(cx, infoStartY);

    // --- MOVE OUT button ---
    this.buildMoveOutButton(cx, GAME_HEIGHT - 44);

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

    this.add.text(cx, 10, `MOVING TO: ${nextName.toUpperCase()}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '11px',
      color: '#FFD700',
    }).setOrigin(0.5, 0).setDepth(1);

    this.add.text(cx, 28, '"Pack what you can carry"', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#667766',
    }).setOrigin(0.5, 0).setDepth(1);
  }

  // -------------------------------------------------------------------------
  // Weapons section
  // -------------------------------------------------------------------------

  private buildWeaponsSection(cx: number, startY: number): void {
    // Section header
    this.add.text(24, startY, `WEAPONS: (choose up to ${MAX_WEAPONS})`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#AADDAA',
    }).setOrigin(0, 0);

    const weaponDefs = (weaponsData.weapons as Array<{
      id: string;
      name: string;
      damage: number;
      rarity: string;
    }>);

    const weapons = this.state.inventory.weapons;

    weapons.forEach((instance, index) => {
      const def = weaponDefs.find(w => w.id === instance.weaponId);
      const weaponName = def?.name ?? instance.weaponId;
      const rarity = instance.rarity ?? def?.rarity ?? 'common';
      const damage = def?.damage ?? 0;

      // Default: select the first MAX_WEAPONS weapons
      const selected = index < MAX_WEAPONS;

      const slotY = startY + 18 + index * 28;

      // Slot background rectangle
      const bgRect = this.add.rectangle(
        cx,
        slotY + 10,
        GAME_WIDTH - 48,
        24,
        selected ? 0x0a2010 : 0x050a08,
        0.9
      ).setOrigin(0.5, 0.5);

      // Keyboard hint (1-9)
      const keyHint = this.add.text(28, slotY + 2, `[${index + 1}]`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#445544',
      }).setOrigin(0, 0);

      // Checkbox indicator
      const checkBox = this.add.text(50, slotY + 2, selected ? '[x]' : '[ ]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: selected ? '#44EE88' : '#445544',
      }).setOrigin(0, 0);

      // Weapon name -- resolve rarity color with explicit fallback to avoid undefined
      const rarityColorVal: number = RARITY_COLORS[rarity] ?? 0xaaaaaa;
      const rarityColorHex = '#' + rarityColorVal.toString(16).padStart(6, '0');
      const nameText = this.add.text(90, slotY + 2, weaponName, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: rarityColorHex,
      }).setOrigin(0, 0);

      // Rarity tag
      const rarityTag = this.add.text(GAME_WIDTH - 110, slotY + 2, `[${rarity}]`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: rarityColorHex,
      }).setOrigin(0, 0);

      // Damage stat
      const dmgText = this.add.text(GAME_WIDTH - 60, slotY + 2, `dmg:${damage}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#888888',
      }).setOrigin(0, 0);

      // Wrap into container for easy management
      const container = this.add.container(0, 0, [
        bgRect, keyHint, checkBox, nameText, rarityTag, dmgText,
      ]);

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
  }

  // -------------------------------------------------------------------------
  // Resources section
  // -------------------------------------------------------------------------

  private buildResourcesSection(cx: number, startY: number): void {
    // Section header with budget display
    this.add.text(24, startY, 'RESOURCES:', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#AADDAA',
    }).setOrigin(0, 0);

    // Budget counter (updates dynamically)
    this.budgetText = this.add.text(GAME_WIDTH - 24, startY, `0/${RESOURCE_BUDGET}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#DDAA44',
    }).setOrigin(1, 0);

    const BAR_WIDTH = 120;
    const BAR_X = cx - 20;

    RESOURCE_ORDER.forEach((type, rowIndex) => {
      const have = this.state.inventory.resources[type] ?? 0;
      // Start by offering all resources the player has, respecting the budget
      const taking = 0; // rows start at 0; player allocates budget manually

      const rowY = startY + 18 + rowIndex * 28;

      // Row background
      this.add.rectangle(cx, rowY + 10, GAME_WIDTH - 48, 22, 0x080d0a, 0.8)
        .setOrigin(0.5, 0.5);

      // Keyboard focus indicator (index + 1 since weapons used 1-9)
      const focusColor = rowIndex === this.focusedResourceIndex ? '#AADDAA' : '#334433';

      // Resource label
      this.add.text(28, rowY + 2, RESOURCE_LABELS[type], {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#7aaa88',
      }).setOrigin(0, 0);

      // Minus button
      const minusBtn = this.add.text(BAR_X - 20, rowY + 2, '[-]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#cc4444',
      }).setOrigin(0, 0).setInteractive({ useHandCursor: true });

      // Bar background
      this.add.rectangle(BAR_X + BAR_WIDTH / 2, rowY + 10, BAR_WIDTH, 10, 0x1a2a1a, 1)
        .setOrigin(0.5, 0.5);

      // Bar fill (width updated dynamically)
      const barFill = this.add.rectangle(
        BAR_X, rowY + 10, 0, 8, 0x22cc55, 1
      ).setOrigin(0, 0.5);

      // Plus button
      const plusBtn = this.add.text(BAR_X + BAR_WIDTH + 6, rowY + 2, '[+]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#44cc44',
      }).setOrigin(0, 0).setInteractive({ useHandCursor: true });

      // Count text "taking/have"
      const countText = this.add.text(BAR_X + BAR_WIDTH + 44, rowY + 2, `0/${have}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#aaaaaa',
      }).setOrigin(0, 0);

      const row: ResourceRow = {
        type,
        have,
        taking,
        countText,
        barFill,
        minusBtn,
        plusBtn,
      };

      this.resourceRows.push(row);

      // Wire up button handlers
      minusBtn.on('pointerdown', () => {
        this.focusedResourceIndex = rowIndex;
        this.adjustResource(rowIndex, -RESOURCE_STEP);
      });
      plusBtn.on('pointerdown', () => {
        this.focusedResourceIndex = rowIndex;
        this.adjustResource(rowIndex, +RESOURCE_STEP);
      });

      // Visual hover for buttons
      minusBtn.on('pointerover', () => minusBtn.setColor('#ff6666'));
      minusBtn.on('pointerout', () => minusBtn.setColor('#cc4444'));
      plusBtn.on('pointerover', () => plusBtn.setColor('#66ff66'));
      plusBtn.on('pointerout', () => plusBtn.setColor('#44cc44'));

      void focusColor; // will be used later via updateResourceRow
    });

    this.updateBudgetDisplay();
  }

  // -------------------------------------------------------------------------
  // Refugees + Skills info section (read-only)
  // -------------------------------------------------------------------------

  private buildInfoSection(_cx: number, startY: number): void {
    const refugees = this.state.refugees;
    const skills = this.state.player.skills;
    const skillDefs = (skillsData.skills as Array<{ id: string; name: string }>);

    // --- Refugees ---
    this.add.text(24, startY, 'REFUGEES: (all follow you)', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#AADDAA',
    }).setOrigin(0, 0);

    if (refugees.length === 0) {
      this.add.text(24, startY + 16, 'None', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#445544',
      }).setOrigin(0, 0);
    } else {
      // Show refugees as a comma-separated list, wrapping at GAME_WIDTH - 48
      const refugeeText = refugees
        .map(r => `${r.name} [${r.status}]`)
        .join('  ');
      this.add.text(24, startY + 16, refugeeText, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#88aa88',
        wordWrap: { width: GAME_WIDTH - 48 },
      }).setOrigin(0, 0);
    }

    // --- Skills ---
    const skillsY = startY + (refugees.length > 0 ? 44 : 32);

    this.add.text(24, skillsY, 'SKILLS: (all kept)', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#AADDAA',
    }).setOrigin(0, 0);

    // Show only skills the player has invested in (level > 0)
    const activeSkills = (Object.entries(skills) as Array<[SkillType, number]>)
      .filter(([, level]) => level > 0)
      .map(([id, level]) => {
        const def = skillDefs.find(s => s.id === id);
        const shortName = def?.name ?? id;
        return `${shortName} Lv${level}`;
      });

    const skillLine = activeSkills.length > 0 ? activeSkills.join('  ') : 'None yet';

    this.add.text(24, skillsY + 16, skillLine, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#8888cc',
      wordWrap: { width: GAME_WIDTH - 48 },
    }).setOrigin(0, 0);
  }

  // -------------------------------------------------------------------------
  // MOVE OUT button
  // -------------------------------------------------------------------------

  private buildMoveOutButton(cx: number, y: number): void {
    this.moveOutBg = this.add.rectangle(cx, y, 260, 32, 0x0a2808, 1)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    this.add.rectangle(cx, y, 262, 34, 0x22aa44, 1)
      .setOrigin(0.5, 0.5)
      .setDepth(0);

    this.moveOutBtn = this.add.text(cx, y, 'MOVE OUT >>', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '11px',
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
    const barWidth = 120;
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
