// Dead Horizon -- BuildMenu v2.4
// Redesigned with tabs (TRAPS | WALLS | SPECIAL), resource header, icon cells,
// gray-out reasons, and per-item descriptions loaded from structures.json.

import Phaser from 'phaser';
import { BuildingManager } from '../systems/BuildingManager';
import type { StructureData } from '../systems/BuildingManager';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import baseLevelsJson from '../data/base-levels.json';
import type { ResourceType } from '../config/types';

// ------------------------------------------------------------------
// Layout constants
// ------------------------------------------------------------------
const PANEL_W = 340;
const PANEL_X = Math.floor((GAME_WIDTH - PANEL_W) / 2);
const PANEL_Y = 48;
const HEADER_H = 32;   // resource bar height
const TAB_H = 28;      // tab strip height
const ITEM_H = 56;     // height per list item
const ITEM_GAP = 4;    // vertical gap between items
const ICON_CELL = 36;  // icon box size
const PADDING = 10;
const MAX_VISIBLE_H = GAME_HEIGHT - PANEL_Y - 60; // max panel content area

const BG_COLOR      = 0x1A1A1A;
const BORDER_COLOR  = 0x3A3A3A;
const HEADER_COLOR  = 0x252525;
const TAB_ACTIVE    = 0x333333;
const TAB_INACTIVE  = 0x1E1E1E;
const ITEM_NORMAL   = 0x242424;
const ITEM_HOVER    = 0x3A3A3A;
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
};

// Which primitives belong to TRAPS vs WALLS
const PRIMITIVE_TRAP_IDS = new Set(['trap', 'spike_strip', 'sandbags', 'pit_trap', 'bear_trap', 'landmine', 'oil_slick']);

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

  // The overall container added to UI camera
  private container: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Graphics;

  private visible: boolean = false;
  private activeTab: TabName = 'TRAPS';

  // Current base level determines which structures are unlocked
  private getBaseLevelUnlockedIds: () => string[];

  constructor(
    scene: Phaser.Scene,
    buildingManager: BuildingManager,
    getCurrentAP: () => number,
    getMaxAP: () => number,
    getResources: () => Record<ResourceType, number>,
    getBaseLevelUnlockedIds: () => string[],
    onSelect: (structureId: string) => void,
  ) {
    this.scene = scene;
    this.buildingManager = buildingManager;
    this.getCurrentAP = getCurrentAP;
    this.getMaxAP = getMaxAP;
    this.getResources = getResources;
    this.getBaseLevelUnlockedIds = getBaseLevelUnlockedIds;
    this.onSelect = onSelect;

    // Full-screen backdrop -- closes menu on click-outside
    this.backdrop = scene.add.graphics();
    this.backdrop.fillStyle(0x000000, 0.01);
    this.backdrop.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.backdrop.setDepth(109);
    this.backdrop.setVisible(false);
    this.backdrop.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT),
      Phaser.Geom.Rectangle.Contains,
    );
    this.backdrop.on('pointerdown', () => this.hide());

    this.container = scene.add.container(PANEL_X, PANEL_Y);
    this.container.setDepth(110);
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
    this.backdrop.setVisible(true);
    this.container.setVisible(true);
    this.rebuild();
  }

  hide(): void {
    this.visible = false;
    this.backdrop.setVisible(false);
    this.container.setVisible(false);
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

  // ------------------------------------------------------------------
  // Panel construction
  // ------------------------------------------------------------------

  private buildPanel(): void {
    const unlockedIds = this.getBaseLevelUnlockedIds();
    const allStructures = this.buildingManager.getAllStructureData();
    const ap = this.getCurrentAP();
    const maxAP = this.getMaxAP();
    const resources = this.getResources();

    // Separate structures by active tab
    const filtered = allStructures.filter(s => this.getTabForStructure(s) === this.activeTab);

    // Calculate total panel height based on item count
    const listH = filtered.length * (ITEM_H + ITEM_GAP);
    const totalH = HEADER_H + TAB_H + PADDING + listH + PADDING;
    const clampedH = Math.min(totalH, MAX_VISIBLE_H);

    // --- Panel background ---
    const bg = this.scene.add.graphics();
    bg.fillStyle(BG_COLOR, 0.97);
    bg.fillRect(0, 0, PANEL_W, clampedH);
    bg.lineStyle(1, BORDER_COLOR, 1);
    bg.strokeRect(0, 0, PANEL_W, clampedH);
    // Block clicks from reaching the backdrop
    bg.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, PANEL_W, clampedH),
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

    for (const s of filtered) {
      const isUnlocked = unlockedIds.includes(s.id);
      const canAfford = this.buildingManager.canAfford(s.id);
      const hasAP = ap >= s.apCost;
      const reasons = this.getDisabledReasons(s, isUnlocked, canAfford, hasAP, resources, ap);
      const available = isUnlocked && reasons.length === 0;

      this.buildItem(s, available, isUnlocked, reasons, offsetY);
      offsetY += ITEM_H + ITEM_GAP;
    }

    // --- Close button [X] in top-right ---
    const closeBtn = this.scene.add.text(PANEL_W - PADDING - 8, 8, '[X]', {
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

    // Resource text -- always visible
    const scrap = resources.scrap ?? 0;
    const parts = resources.parts ?? 0;
    const food  = resources.food ?? 0;
    const resourceStr = `S:${scrap}  P:${parts}  F:${food}  AP:${ap}/${maxAP}`;
    const resText = this.scene.add.text(PADDING, HEADER_H / 2, resourceStr, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
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

      const tabLabel = this.scene.add.text(x + tabW / 2, HEADER_H + TAB_H / 2, tab, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: isActive ? FONT_YELLOW : FONT_MUTED,
      }).setOrigin(0.5, 0.5);
      // Tab labels should not intercept pointer so the tabBg handles clicks
      this.container.add(tabLabel);
    });

    // Bottom border under tabs
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, BORDER_COLOR, 1);
    divider.lineBetween(0, HEADER_H + TAB_H, PANEL_W, HEADER_H + TAB_H);
    this.container.add(divider);
  }

  /** Single list item row. */
  private buildItem(
    s: StructureData,
    available: boolean,
    isUnlocked: boolean,
    reasons: DisabledReason[],
    y: number,
  ): void {
    const itemBg = this.scene.add.graphics();
    itemBg.fillStyle(ITEM_NORMAL, 1);
    itemBg.fillRect(PADDING, y, PANEL_W - PADDING * 2, ITEM_H);
    this.container.add(itemBg);

    // --- Icon cell (36x36) ---
    const iconBorderColor = available ? 0x4CAF50 : 0x3A3A3A;
    const iconBg = this.scene.add.graphics();
    iconBg.lineStyle(1, iconBorderColor, 1);
    iconBg.strokeRect(PADDING + 2, y + (ITEM_H - ICON_CELL) / 2, ICON_CELL, ICON_CELL);
    iconBg.fillStyle(0x1A1A1A, 1);
    iconBg.fillRect(PADDING + 3, y + (ITEM_H - ICON_CELL) / 2 + 1, ICON_CELL - 2, ICON_CELL - 2);
    this.container.add(iconBg);

    const icon = STRUCTURE_ICONS[s.id] ?? '?';
    const iconText = this.scene.add.text(
      PADDING + 2 + ICON_CELL / 2,
      y + ITEM_H / 2,
      icon,
      { fontSize: '20px' },
    ).setOrigin(0.5, 0.5);
    if (!available) iconText.setAlpha(0.35);
    this.container.add(iconText);

    // --- Name + description ---
    const textX = PADDING + ICON_CELL + 8;
    const nameColor = available ? FONT_MAIN : FONT_MUTED;
    const nameText = this.scene.add.text(textX, y + 8, s.name, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: nameColor,
    });
    this.container.add(nameText);

    // Description (smaller grey text)
    const desc = s.description ?? '';
    const descText = this.scene.add.text(textX, y + 22, desc, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: available ? '#888888' : '#4A4A4A',
      wordWrap: { width: PANEL_W - textX - PADDING - 60 },
    });
    this.container.add(descText);

    // --- Disabled reason(s) below description ---
    if (reasons.length > 0 && isUnlocked) {
      const reasonText = reasons.map(r => r.text).join(' | ');
      // Use color of first reason
      const rColor = reasons[0]?.color ?? FONT_RED;
      const rt = this.scene.add.text(textX, y + 36, reasonText, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: rColor,
        wordWrap: { width: PANEL_W - textX - PADDING - 60 },
      });
      this.container.add(rt);
    }

    // --- Locked reason (base level required) ---
    if (!isUnlocked) {
      const requiredLevel = this.getRequiredBaseLevelName(s.id);
      const lockText = this.scene.add.text(textX, y + 34, `Requires ${requiredLevel}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: FONT_ORANGE,
      });
      this.container.add(lockText);
    }

    // --- Cost display (right side) ---
    const costX = PANEL_W - PADDING - 50;
    const costStr = Object.entries(s.cost).map(([r, n]) => `${n}${r[0]?.toUpperCase() ?? ''}`).join(' ');
    const canAffordCost = this.buildingManager.canAfford(s.id);
    const costColor = !isUnlocked ? FONT_MUTED : canAffordCost ? FONT_GREEN : FONT_RED;
    const costText = this.scene.add.text(costX, y + 8, costStr, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: costColor,
    });
    this.container.add(costText);

    // AP cost
    const hasAP = this.getCurrentAP() >= s.apCost;
    const apColor = !isUnlocked ? FONT_MUTED : hasAP ? FONT_YELLOW : FONT_RED;
    const apText = this.scene.add.text(costX, y + 22, `${s.apCost}AP`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
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
        itemBg.fillStyle(ITEM_NORMAL, 1);
        itemBg.fillRect(PADDING, y, PANEL_W - PADDING * 2, ITEM_H);
        nameText.setColor(FONT_MAIN);
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
