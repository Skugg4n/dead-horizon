// Dead Horizon -- BuildMenu v2.4.1
// Redesigned with tabs (TRAPS | WALLS | SPECIAL), resource header, icon cells,
// gray-out reasons, and per-item descriptions loaded from structures.json.
// Changes in 2.4.1:
//   - Smaller fonts (tabs 7px, names 9px, desc/cost 7px)
//   - ITEM_H 46, ICON_CELL 28, PANEL_W 300
//   - Keyboard navigation: 1-9, ArrowUp/Down, Enter, Tab
//   - Scroll simulation: max visible items + "more" indicator

import Phaser from 'phaser';
import { BuildingManager } from '../systems/BuildingManager';
import type { StructureData } from '../systems/BuildingManager';
import { GAME_HEIGHT } from '../config/constants';
import baseLevelsJson from '../data/base-levels.json';
import blueprintsJson from '../data/blueprints.json';
import type { BlueprintData, ResourceType } from '../config/types';

// ------------------------------------------------------------------
// Layout constants
// ------------------------------------------------------------------
const PANEL_W = 280;
const PANEL_X = 8;  // Left side of screen
const PANEL_Y = 48;
const HEADER_H = 28;   // resource bar height
const TAB_H = 24;      // tab strip height
const ITEM_H = 52;     // height per list item
const ITEM_GAP = 3;    // vertical gap between items
const ICON_CELL = 28;  // icon box size (was 36)
const PADDING = 8;
const MORE_INDICATOR_H = 18; // height for the "N more..." text row

// Compute how many items fit in the visible panel area
const AVAILABLE_H = GAME_HEIGHT - PANEL_Y - 60 - HEADER_H - TAB_H - PADDING * 2 - MORE_INDICATOR_H;
const MAX_VISIBLE_ITEMS = Math.max(1, Math.floor(AVAILABLE_H / (ITEM_H + ITEM_GAP)));

const BG_COLOR      = 0x1A1A1A;
const BORDER_COLOR  = 0x3A3A3A;
const HEADER_COLOR  = 0x252525;
const TAB_ACTIVE    = 0x333333;
const TAB_INACTIVE  = 0x1E1E1E;
const ITEM_NORMAL   = 0x242424;
const ITEM_HOVER    = 0x3A3A3A;
const ITEM_SELECTED = 0x2E3A2E; // highlighted by keyboard cursor
const FONT_MAIN     = '#E8DCC8';
const FONT_MUTED    = '#6B6B6B';
const FONT_YELLOW   = '#FFD700';
const FONT_RED      = '#FF4444';
const FONT_ORANGE   = '#FF8800';
const FONT_GREEN    = '#4CAF50';

// Emoji icons per structureId -- placeholder visuals
const STRUCTURE_ICONS: Record<string, string> = {
  barricade:      '🪵',
  wall:           '🧱',
  trap:           '⚙️',
  spike_strip:    '📌',
  sandbags:       '🪨',
  cart_wall:      '🛒',
  pit_trap:       '🕳️',
  blade_spinner:  '🔪',
  fire_pit:       '🔥',
  propane_geyser: '💨',
  washing_cannon: '💧',
  pillbox:        '🏠',
  shelter:        '⛺',
  storage:        '📦',
  farm:           '🌱',
  bear_trap:      '🐻',
  landmine:       '💣',
  oil_slick:      '🛢️',
  nail_board:     '🪵',
  trip_wire:      '🪢',
  glass_shards:   '🔷',
  tar_pit:        '🟤',
  shock_wire:     '⚡',
  spring_launcher:'🔩',
  chain_wall:     '⛓️',
};

// Which primitives belong to TRAPS vs WALLS
const PRIMITIVE_TRAP_IDS = new Set([
  'trap', 'spike_strip', 'sandbags', 'pit_trap', 'bear_trap', 'landmine', 'oil_slick',
  'nail_board', 'trip_wire', 'glass_shards', 'tar_pit',
]);

// Blueprint definitions and always-available trap IDs (from blueprints.json)
const ALL_BLUEPRINTS = blueprintsJson.blueprints as BlueprintData[];
const ALWAYS_AVAILABLE_TRAP_IDS = new Set<string>(blueprintsJson.alwaysAvailable);

// Build a lookup: structureId -> blueprintId that unlocks it
const BLUEPRINT_FOR_STRUCTURE = new Map<string, string>();
for (const bp of ALL_BLUEPRINTS) {
  for (const structId of bp.unlocks) {
    BLUEPRINT_FOR_STRUCTURE.set(structId, bp.id);
  }
}


type TabName = 'TRAPS' | 'WALLS' | 'SPECIAL';

interface DisabledReason {
  text: string;
  color: string;
}

export class BuildMenu {
  private scene: Phaser.Scene;
  private buildingManager: BuildingManager;
  private getCurrentAP: () => number;
  private getMaxAP: () => number;
  private getResources: () => Record<ResourceType, number>;
  private onSelect: (structureId: string) => void;
  private onClose: (() => void) | null = null;

  // The overall container added to UI camera
  private container: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Graphics;

  private visible: boolean = false;
  private activeTab: TabName = 'TRAPS';

  // Keyboard navigation state
  private cursorIndex: number = -1; // -1 = no keyboard selection
  private scrollOffset: number = 0; // index of first visible item

  // Current base level determines which structures are unlocked
  private getBaseLevelUnlockedIds: () => string[];
  // Returns the list of blueprint IDs the player has found on loot runs
  private getUnlockedBlueprints: () => string[];

  constructor(
    scene: Phaser.Scene,
    buildingManager: BuildingManager,
    getCurrentAP: () => number,
    getMaxAP: () => number,
    getResources: () => Record<ResourceType, number>,
    getBaseLevelUnlockedIds: () => string[],
    getUnlockedBlueprints: () => string[],
    onSelect: (structureId: string) => void,
  ) {
    this.scene = scene;
    this.buildingManager = buildingManager;
    this.getCurrentAP = getCurrentAP;
    this.getMaxAP = getMaxAP;
    this.getResources = getResources;
    this.getBaseLevelUnlockedIds = getBaseLevelUnlockedIds;
    this.getUnlockedBlueprints = getUnlockedBlueprints;
    this.onSelect = onSelect;

    // Backdrop -- no longer closes on click (menu stays open during placement)
    // Player uses [X] button, ESC, or BUILD toggle to close
    this.backdrop = scene.add.graphics();
    this.backdrop.setDepth(209);
    this.backdrop.setVisible(false);

    this.container = scene.add.container(PANEL_X, PANEL_Y);
    this.container.setDepth(210);
    this.container.setVisible(false);
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  show(): void {
    this.visible = true;
    this.cursorIndex = -1;
    this.scrollOffset = 0;
    this.backdrop.setVisible(true);
    this.container.setVisible(true);
    this.rebuild();
  }

  hide(): void {
    this.visible = false;
    this.backdrop.setVisible(false);
    this.container.setVisible(false);
    if (this.onClose) this.onClose();
  }

  setOnClose(cb: () => void): void {
    this.onClose = cb;
  }

  isVisible(): boolean {
    return this.visible;
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  getBackdrop(): Phaser.GameObjects.Graphics {
    return this.backdrop;
  }

  /** Called when AP or resources change -- rebuilds to reflect new affordability. */
  rebuild(): void {
    this.container.removeAll(true);
    this.buildPanel();
  }

  destroy(): void {
    this.backdrop.destroy();
    this.container.destroy();
  }

  /**
   * Handle keyboard input when the build menu is open.
   * Returns true if the key was handled (so the caller can stop propagation).
   *
   * Keys:
   *   1-9    : select item by visible position
   *   ArrowDown  : move cursor down, scroll if needed
   *   ArrowUp    : move cursor up, scroll if needed
   *   Enter  : select the currently highlighted item
   *   Tab    : cycle to next tab
   */
  handleKey(key: string, event?: KeyboardEvent): boolean {
    const filtered = this.getFilteredItems();
    const total = filtered.length;
    if (total === 0) return false;
    // Helper: prevent browser defaults (Tab switches tabs, arrows scroll page)
    const consume = () => { if (event) { event.preventDefault(); event.stopPropagation(); } };

    // Digit 1-9: select visible item by number
    const digit = parseInt(key, 10);
    if (!isNaN(digit) && digit >= 1 && digit <= 9) {
      const visibleIndex = digit - 1; // 0-based within the visible window
      const absoluteIndex = this.scrollOffset + visibleIndex;
      if (absoluteIndex < total) {
        this.cursorIndex = absoluteIndex;
        this.trySelectCurrent(filtered);
      }
      return true;
    }

    if (key === 'ArrowDown') { consume();
      if (this.cursorIndex < 0) {
        this.cursorIndex = this.scrollOffset;
      } else if (this.cursorIndex < total - 1) {
        this.cursorIndex++;
        // Scroll down if cursor went below visible window
        if (this.cursorIndex >= this.scrollOffset + MAX_VISIBLE_ITEMS) {
          this.scrollOffset = this.cursorIndex - MAX_VISIBLE_ITEMS + 1;
        }
      }
      this.rebuild();
      return true;
    }

    if (key === 'ArrowUp') { consume();
      if (this.cursorIndex < 0) {
        this.cursorIndex = this.scrollOffset;
      } else if (this.cursorIndex > 0) {
        this.cursorIndex--;
        // Scroll up if cursor went above visible window
        if (this.cursorIndex < this.scrollOffset) {
          this.scrollOffset = this.cursorIndex;
        }
      }
      this.rebuild();
      return true;
    }

    if (key === 'Enter') {
      this.trySelectCurrent(filtered);
      return true;
    }

    if (key === 'Tab') { consume();
      const tabs: TabName[] = ['TRAPS', 'WALLS', 'SPECIAL'];
      const idx = tabs.indexOf(this.activeTab);
      const next = tabs[(idx + 1) % tabs.length];
      if (next) this.activeTab = next;
      this.cursorIndex = -1;
      this.scrollOffset = 0;
      this.rebuild();
      return true;
    }

    return false;
  }

  // ------------------------------------------------------------------
  // Panel construction
  // ------------------------------------------------------------------

  /**
   * Returns true if a structure is buildable from a blueprint perspective.
   * A structure is blueprint-accessible if it is in alwaysAvailable OR if its
   * blueprint has been unlocked by the player.
   */
  private isBlueprintAccessible(structureId: string): boolean {
    if (ALWAYS_AVAILABLE_TRAP_IDS.has(structureId)) return true;
    const requiredBlueprintId = BLUEPRINT_FOR_STRUCTURE.get(structureId);
    if (requiredBlueprintId === undefined) {
      // Not gated by any blueprint -- treat as always available
      return true;
    }
    return this.getUnlockedBlueprints().includes(requiredBlueprintId);
  }

  private getFilteredItems(): StructureData[] {
    // Only show structures that are blueprint-accessible (alwaysAvailable or unlocked)
    return this.buildingManager.getAllStructureData()
      .filter(s => this.getTabForStructure(s) === this.activeTab && this.isBlueprintAccessible(s.id));
  }

  private trySelectCurrent(filtered: StructureData[]): void {
    if (this.cursorIndex < 0 || this.cursorIndex >= filtered.length) return;
    const s = filtered[this.cursorIndex];
    if (!s) return;

    const unlockedIds = this.getBaseLevelUnlockedIds();
    const isUnlocked = unlockedIds.includes(s.id);
    const canAfford = this.buildingManager.canAfford(s.id);
    const hasAP = this.getCurrentAP() >= s.apCost;
    const reasons = this.getDisabledReasons(s, isUnlocked, canAfford, hasAP, this.getResources(), this.getCurrentAP());
    const available = isUnlocked && reasons.length === 0;

    if (available) {
      this.onSelect(s.id);
    }
  }

  private buildPanel(): void {
    const unlockedIds = this.getBaseLevelUnlockedIds();
    const ap = this.getCurrentAP();
    const maxAP = this.getMaxAP();
    const resources = this.getResources();
    const filtered = this.getFilteredItems();
    const total = filtered.length;

    // Clamp cursor and scroll offset to valid range after tab change etc.
    if (this.cursorIndex >= total) this.cursorIndex = total - 1;
    if (this.scrollOffset > Math.max(0, total - MAX_VISIBLE_ITEMS)) {
      this.scrollOffset = Math.max(0, total - MAX_VISIBLE_ITEMS);
    }

    const visibleItems = filtered.slice(this.scrollOffset, this.scrollOffset + MAX_VISIBLE_ITEMS);
    const hasMore = total > this.scrollOffset + MAX_VISIBLE_ITEMS;
    const moreCount = total - (this.scrollOffset + MAX_VISIBLE_ITEMS);
    const hasPrev = this.scrollOffset > 0;

    const listH = visibleItems.length * (ITEM_H + ITEM_GAP);
    const moreBarH = (hasMore || hasPrev) ? MORE_INDICATOR_H : 0;
    const totalH = HEADER_H + TAB_H + PADDING + listH + moreBarH + PADDING;

    // --- Panel background ---
    const bg = this.scene.add.graphics();
    bg.fillStyle(BG_COLOR, 0.97);
    bg.fillRect(0, 0, PANEL_W, totalH);
    bg.lineStyle(1, BORDER_COLOR, 1);
    bg.strokeRect(0, 0, PANEL_W, totalH);
    // Block clicks from reaching the backdrop
    bg.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, PANEL_W, totalH),
      Phaser.Geom.Rectangle.Contains,
    );
    this.container.add(bg);

    // --- Resource header ---
    this.buildResourceHeader(resources, ap, maxAP);

    // --- Tab strip ---
    this.buildTabStrip();

    // --- Item list ---
    const listY = HEADER_H + TAB_H + PADDING;
    let offsetY = listY;

    visibleItems.forEach((s, visIdx) => {
      const absoluteIndex = this.scrollOffset + visIdx;
      const isUnlocked = unlockedIds.includes(s.id);
      const canAfford = this.buildingManager.canAfford(s.id);
      const hasAP = ap >= s.apCost;
      const reasons = this.getDisabledReasons(s, isUnlocked, canAfford, hasAP, resources, ap);
      const available = isUnlocked && reasons.length === 0;
      const isHighlighted = absoluteIndex === this.cursorIndex;

      this.buildItem(s, available, isUnlocked, reasons, offsetY, visIdx + 1, isHighlighted);
      offsetY += ITEM_H + ITEM_GAP;
    });

    // --- "More" indicator ---
    if (hasMore || hasPrev) {
      const moreY = listY + listH;
      const lines: string[] = [];
      if (hasPrev) lines.push('^ more above');
      if (hasMore) lines.push(`v ${moreCount} more (arrows to scroll)`);
      const moreText = this.scene.add.text(PANEL_W / 2, moreY + MORE_INDICATOR_H / 2, lines.join('   '), {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: FONT_MUTED,
      }).setOrigin(0.5, 0.5);
      this.container.add(moreText);
    }

    // --- Close button [X] in top-right ---
    const closeBtn = this.scene.add.text(PANEL_W - PADDING - 8, 6, '[X]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: FONT_MUTED,
    }).setOrigin(1, 0);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor(FONT_YELLOW));
    closeBtn.on('pointerout', () => closeBtn.setColor(FONT_MUTED));
    closeBtn.on('pointerdown', () => this.hide());
    this.container.add(closeBtn);
  }

  /** Resource bar at the very top of the panel. */
  private buildResourceHeader(resources: Record<ResourceType, number>, ap: number, maxAP: number): void {
    const hdr = this.scene.add.graphics();
    hdr.fillStyle(HEADER_COLOR, 1);
    hdr.fillRect(0, 0, PANEL_W, HEADER_H);
    this.container.add(hdr);

    const scrap = resources.scrap ?? 0;
    const parts = resources.parts ?? 0;
    const food  = resources.food ?? 0;
    const resourceStr = `S:${scrap}  P:${parts}  F:${food}  AP:${ap}/${maxAP}`;
    const resText = this.scene.add.text(PADDING, HEADER_H / 2, resourceStr, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: FONT_YELLOW,
    }).setOrigin(0, 0.5);
    this.container.add(resText);
  }

  /** Three-tab strip: TRAPS | WALLS | SPECIAL */
  private buildTabStrip(): void {
    const tabs: TabName[] = ['TRAPS', 'WALLS', 'SPECIAL'];
    const tabW = Math.floor(PANEL_W / tabs.length);

    tabs.forEach((tab, i) => {
      const x = i * tabW;
      const isActive = tab === this.activeTab;

      const tabBg = this.scene.add.graphics();
      tabBg.fillStyle(isActive ? TAB_ACTIVE : TAB_INACTIVE, 1);
      tabBg.fillRect(x, HEADER_H, tabW, TAB_H);
      if (isActive) {
        tabBg.lineStyle(1, 0x666666, 1);
        tabBg.strokeRect(x, HEADER_H, tabW, TAB_H);
      }
      tabBg.setInteractive(
        new Phaser.Geom.Rectangle(x, HEADER_H, tabW, TAB_H),
        Phaser.Geom.Rectangle.Contains,
      );
      if (tabBg.input) tabBg.input.cursor = 'pointer';
      tabBg.on('pointerdown', () => {
        this.activeTab = tab;
        this.cursorIndex = -1;
        this.scrollOffset = 0;
        this.rebuild();
      });
      tabBg.on('pointerover', () => {
        if (!isActive) {
          tabBg.clear();
          tabBg.fillStyle(0x2A2A2A, 1);
          tabBg.fillRect(x, HEADER_H, tabW, TAB_H);
        }
      });
      tabBg.on('pointerout', () => {
        if (!isActive) {
          tabBg.clear();
          tabBg.fillStyle(TAB_INACTIVE, 1);
          tabBg.fillRect(x, HEADER_H, tabW, TAB_H);
        }
      });
      this.container.add(tabBg);

      // Tab labels: 7px (was larger)
      const tabLabel = this.scene.add.text(x + tabW / 2, HEADER_H + TAB_H / 2, tab, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: isActive ? FONT_YELLOW : FONT_MUTED,
      }).setOrigin(0.5, 0.5);
      this.container.add(tabLabel);
    });

    // Bottom border under tabs
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, BORDER_COLOR, 1);
    divider.lineBetween(0, HEADER_H + TAB_H, PANEL_W, HEADER_H + TAB_H);
    this.container.add(divider);
  }

  /**
   * Single list item row.
   * @param visibleNumber 1-based number shown on the left (for keyboard selection hint)
   * @param isHighlighted true when this item has the keyboard cursor on it
   */
  private buildItem(
    s: StructureData,
    available: boolean,
    isUnlocked: boolean,
    reasons: DisabledReason[],
    y: number,
    visibleNumber: number,
    isHighlighted: boolean,
  ): void {
    // Background -- use a lighter shade when keyboard-selected
    const bgColor = isHighlighted ? ITEM_SELECTED : ITEM_NORMAL;
    const itemBg = this.scene.add.graphics();
    itemBg.fillStyle(bgColor, 1);
    itemBg.fillRect(PADDING, y, PANEL_W - PADDING * 2, ITEM_H);
    // Highlighted items also get a border
    if (isHighlighted) {
      itemBg.lineStyle(1, 0x4CAF50, 0.6);
      itemBg.strokeRect(PADDING, y, PANEL_W - PADDING * 2, ITEM_H);
    }
    this.container.add(itemBg);

    // Small number hint in the top-left corner of the item (1-9)
    if (visibleNumber <= 9) {
      const numHint = this.scene.add.text(PADDING + 2, y + 2, `${visibleNumber}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: FONT_MUTED,
      });
      this.container.add(numHint);
    }

    // --- Icon cell (ICON_CELL x ICON_CELL) ---
    const iconOffsetX = PADDING + 10; // shift right to make room for number hint
    const iconBorderColor = available ? 0x4CAF50 : 0x3A3A3A;
    const iconBg = this.scene.add.graphics();
    iconBg.lineStyle(1, iconBorderColor, 1);
    iconBg.strokeRect(iconOffsetX, y + (ITEM_H - ICON_CELL) / 2, ICON_CELL, ICON_CELL);
    iconBg.fillStyle(0x1A1A1A, 1);
    iconBg.fillRect(iconOffsetX + 1, y + (ITEM_H - ICON_CELL) / 2 + 1, ICON_CELL - 2, ICON_CELL - 2);
    this.container.add(iconBg);

    const icon = STRUCTURE_ICONS[s.id] ?? '?';
    const iconText = this.scene.add.text(
      iconOffsetX + ICON_CELL / 2,
      y + ITEM_H / 2,
      icon,
      { fontSize: '14px' },
    ).setOrigin(0.5, 0.5);
    if (!available) iconText.setAlpha(0.35);
    this.container.add(iconText);

    // --- Name + description ---
    const textX = iconOffsetX + ICON_CELL + 6;
    const nameColor = isHighlighted ? FONT_YELLOW : (available ? FONT_MAIN : FONT_MUTED);
    const nameText = this.scene.add.text(textX, y + 6, s.name, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: nameColor,
    });
    this.container.add(nameText);

    // Description (7px grey text)
    const desc = s.description ?? '';
    const descText = this.scene.add.text(textX, y + 19, desc, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: available ? '#888888' : '#4A4A4A',
      wordWrap: { width: PANEL_W - textX - PADDING - 50 },
    });
    this.container.add(descText);

    // --- Disabled reason(s) below description ---
    if (reasons.length > 0 && isUnlocked) {
      const reasonText = reasons.map(r => r.text).join(' | ');
      const rColor = reasons[0]?.color ?? FONT_RED;
      const rt = this.scene.add.text(textX, y + 30, reasonText, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: rColor,
        wordWrap: { width: PANEL_W - textX - PADDING - 50 },
      });
      this.container.add(rt);
    }

    // --- Locked reason (base level required) ---
    if (!isUnlocked) {
      const requiredLevel = this.getRequiredBaseLevelName(s.id);
      const lockText = this.scene.add.text(textX, y + 28, `Requires ${requiredLevel}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: FONT_ORANGE,
      });
      this.container.add(lockText);
    }

    // --- Cost display (right side) ---
    const costX = PANEL_W - PADDING - 42;
    const costStr = Object.entries(s.cost).map(([r, n]) => `${n}${r[0]?.toUpperCase() ?? ''}`).join(' ');
    const canAffordCost = this.buildingManager.canAfford(s.id);
    const costColor = !isUnlocked ? FONT_MUTED : canAffordCost ? FONT_GREEN : FONT_RED;
    const costText = this.scene.add.text(costX, y + 6, costStr, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: costColor,
    });
    this.container.add(costText);

    // AP cost
    const hasAP = this.getCurrentAP() >= s.apCost;
    const apColor = !isUnlocked ? FONT_MUTED : hasAP ? FONT_YELLOW : FONT_RED;
    const apText = this.scene.add.text(costX, y + 18, `${s.apCost}AP`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: apColor,
    });
    this.container.add(apText);

    // --- Hover + click (only for available items) ---
    if (available) {
      itemBg.setInteractive(
        new Phaser.Geom.Rectangle(PADDING, y, PANEL_W - PADDING * 2, ITEM_H),
        Phaser.Geom.Rectangle.Contains,
      );
      if (itemBg.input) itemBg.input.cursor = 'pointer';
      itemBg.on('pointerover', () => {
        itemBg.clear();
        itemBg.fillStyle(ITEM_HOVER, 1);
        itemBg.fillRect(PADDING, y, PANEL_W - PADDING * 2, ITEM_H);
        nameText.setColor(FONT_YELLOW);
      });
      itemBg.on('pointerout', () => {
        itemBg.clear();
        itemBg.fillStyle(isHighlighted ? ITEM_SELECTED : ITEM_NORMAL, 1);
        itemBg.fillRect(PADDING, y, PANEL_W - PADDING * 2, ITEM_H);
        if (isHighlighted) {
          itemBg.lineStyle(1, 0x4CAF50, 0.6);
          itemBg.strokeRect(PADDING, y, PANEL_W - PADDING * 2, ITEM_H);
        }
        nameText.setColor(isHighlighted ? FONT_YELLOW : FONT_MAIN);
      });
      itemBg.on('pointerdown', () => {
        this.onSelect(s.id);
      });
    }
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /** Determine which tab a structure belongs to based on its category. */
  private getTabForStructure(s: StructureData): TabName {
    if (s.category === 'machine') return 'TRAPS';
    if (s.category === 'special') return 'SPECIAL';
    // primitive: split into WALLS (barricade, wall, cart_wall) vs TRAPS
    if (PRIMITIVE_TRAP_IDS.has(s.id)) return 'TRAPS';
    return 'WALLS';
  }

  /** Build the list of human-readable disabled reasons. */
  private getDisabledReasons(
    s: StructureData,
    isUnlocked: boolean,
    _canAfford: boolean,
    hasAP: boolean,
    resources: Record<ResourceType, number>,
    _ap: number,
  ): DisabledReason[] {
    if (!isUnlocked) return []; // locked items have their own separate message

    const reasons: DisabledReason[] = [];

    // Check individual resource shortfalls
    for (const [res, needed] of Object.entries(s.cost)) {
      const have = resources[res as ResourceType] ?? 0;
      if (have < needed) {
        const label = this.resourceLabel(res);
        reasons.push({ text: `Not enough ${label}`, color: FONT_RED });
      }
    }

    if (!hasAP) {
      reasons.push({ text: 'Not enough AP', color: FONT_RED });
    }

    return reasons;
  }

  private resourceLabel(res: string): string {
    const labels: Record<string, string> = {
      scrap: 'scrap',
      parts: 'parts',
      food:  'food',
      ammo:  'ammo',
      meds:  'meds',
    };
    return labels[res] ?? res;
  }

  /** Find the base level name that first unlocks a given structure id. */
  private getRequiredBaseLevelName(structureId: string): string {
    const level = baseLevelsJson.baseLevels.find(bl =>
      (bl.unlockedStructures as string[]).includes(structureId)
    );
    return level?.name ?? '???';
  }
}
