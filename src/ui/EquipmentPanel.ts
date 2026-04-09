// EquipmentPanel -- dual-panel inventory UI for Dead Horizon.
// LEFT panel: tabbed inventory (WEAPONS / ARMOR / SHIELDS) with pagination and hover comparison.
// RIGHT panel: equipped slots with full stats, repair/upgrade/scrap actions.
// Replaces the old single-column UIPanel-based layout. Uses own background (700px wide).
// Open with Q in DayScene toolbar.

import Phaser from 'phaser';
import { WeaponManager } from '../systems/WeaponManager';
import { renderResourceCosts } from './resourceIcons';
import { CLOSE_ALL_PANELS } from './UIPanel';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import type {
  GameState,
  WeaponInstance,
  WeaponUpgradeType,
  UpgradeDefinition,
  WeaponUltimate,
  ArmorInstance,
  ShieldInstance,
  ArmorData,
  ShieldData,
} from '../config/types';
import armorJson from '../data/armor.json';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PANEL_W = Math.min(GAME_WIDTH - 16, 720);
const PANEL_H = GAME_HEIGHT - 100;
const PANEL_X = Math.floor((GAME_WIDTH - PANEL_W) / 2);
const PANEL_Y = 50;

const LEFT_W = 320;
const RIGHT_X = LEFT_W + 20;
const RIGHT_W = PANEL_W - RIGHT_X - 12;

const HEADER_H = 28;
const CONTENT_PAD = 10;

const DEPTH = 250;

const BG_COLOR = 0x111111;
const BG_ALPHA = 0.97;
const BORDER_COLOR = 0x333333;

const FONT = '"Press Start 2P", monospace';

// Rarity color mapping
const RARITY_COLORS: Record<string, string> = {
  common:    '#E8DCC8',
  uncommon:  '#4CAF50',
  rare:      '#4A90D9',
  legendary: '#FFD700',
};

// Scrap yield per rarity (shared for weapons, armor and shields)
const SCRAP_VALUES: Record<string, { scrap: number; parts: number }> = {
  common:    { scrap: 2, parts: 1 },
  uncommon:  { scrap: 3, parts: 2 },
  rare:      { scrap: 5, parts: 3 },
  legendary: { scrap: 8, parts: 5 },
};

/** Return color for weapon level indicator in list rows. */
function weaponLevelColor(level: number): string {
  if (level >= 5) return '#FFD700'; // gold
  if (level >= 3) return '#FFD700'; // yellow
  return '#E8DCC8'; // white
}

// Left panel tabs
type InventoryTab = 'WEAPONS' | 'ARMOR' | 'SHIELDS';

type Slot = 'primary' | 'secondary';

/**
 * View state machine:
 *  - default: dual panel view
 *  - upgrade: inline upgrade options for a specific weapon
 */
type ViewState =
  | { mode: 'default' }
  | { mode: 'upgrade'; weaponId: string };

// ---------------------------------------------------------------------------
// Backward-compat shim -- DayScene calls getPanel().getBackdrop()
// ---------------------------------------------------------------------------

class PanelShim {
  private backdrop: Phaser.GameObjects.Graphics;
  constructor(backdrop: Phaser.GameObjects.Graphics) {
    this.backdrop = backdrop;
  }
  getBackdrop(): Phaser.GameObjects.Graphics {
    return this.backdrop;
  }
}

// ---------------------------------------------------------------------------
// Helper: build a label e.g. "Lv 2/3"
// ---------------------------------------------------------------------------
function levelLabel(current: number, max: number): string {
  return `Lv ${current}/${max}`;
}

// ---------------------------------------------------------------------------
// Helper: resolve upgrade description template
// ---------------------------------------------------------------------------
function resolveDescription(def: UpgradeDefinition, level: number): string {
  const val = def.values[level - 1] ?? 0;
  return def.description
    .replace('{percent}', String(val))
    .replace('{value}', String(val));
}

// ---------------------------------------------------------------------------
// Loaded armor/shield data lists
// ---------------------------------------------------------------------------
const armorDataList = (armorJson as { armor: ArmorData[]; shields: ShieldData[] }).armor;
const shieldDataList = (armorJson as { armor: ArmorData[]; shields: ShieldData[] }).shields;

function getArmorData(armorId: string): ArmorData | undefined {
  return armorDataList.find(a => a.id === armorId);
}

function getShieldData(shieldId: string): ShieldData | undefined {
  return shieldDataList.find(s => s.id === shieldId);
}

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

export class EquipmentPanel {
  private scene: Phaser.Scene;
  private weaponManager: WeaponManager;
  private gameState: GameState;

  // Root container (everything lives here)
  private container: Phaser.GameObjects.Container;

  // Full-screen backdrop for click-outside-to-close
  private backdrop: Phaser.GameObjects.Graphics;

  // Shim for backward compat with DayScene.addToUI(panel.getPanel().getBackdrop())
  private panelShim: PanelShim;

  // Left and right content sub-containers (cleared and rebuilt on every rebuild())
  private leftContent!: Phaser.GameObjects.Container;
  private rightContent!: Phaser.GameObjects.Container;

  // Tooltip overlay container (hover comparison)
  private tooltipContainer!: Phaser.GameObjects.Container;

  private visible: boolean = false;
  private viewState: ViewState = { mode: 'default' };
  private activeTab: InventoryTab = 'WEAPONS';
  private weaponPage: number = 0;
  private armorPage: number = 0;
  private shieldPage: number = 0;
  // Which weapon slot will receive the next equip click from the left panel
  private selectedSlot: Slot = 'primary';

  private currentAP: () => number;
  private spendAP: (cost: number) => void;
  private onResourceChange: () => void;

  constructor(
    scene: Phaser.Scene,
    weaponManager: WeaponManager,
    gameState: GameState,
    currentAP: () => number = () => 0,
    spendAP: (cost: number) => void = () => { /* no-op */ },
    onResourceChange: () => void = () => { /* no-op */ },
  ) {
    this.scene = scene;
    this.weaponManager = weaponManager;
    this.gameState = gameState;
    this.currentAP = currentAP;
    this.spendAP = spendAP;
    this.onResourceChange = onResourceChange;

    // Full-screen backdrop (invisible, catches outside clicks)
    this.backdrop = scene.add.graphics();
    this.backdrop.fillStyle(0x000000, 0.01);
    this.backdrop.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.backdrop.setDepth(DEPTH - 1);
    this.backdrop.setVisible(false);
    this.backdrop.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT),
      Phaser.Geom.Rectangle.Contains,
    );
    this.backdrop.on('pointerdown', () => this.hide());

    this.panelShim = new PanelShim(this.backdrop);

    // Root container
    this.container = scene.add.container(PANEL_X, PANEL_Y);
    this.container.setDepth(DEPTH);
    this.container.setVisible(false);

    // Opaque background panel
    const bg = scene.add.graphics();
    bg.fillStyle(BG_COLOR, BG_ALPHA);
    bg.fillRect(0, 0, PANEL_W, PANEL_H);
    bg.lineStyle(1, BORDER_COLOR, 1);
    bg.strokeRect(0, 0, PANEL_W, PANEL_H);
    // Intercept clicks so they don't fall through to backdrop
    bg.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, PANEL_W, PANEL_H),
      Phaser.Geom.Rectangle.Contains,
    );
    this.container.add(bg);

    // Header bar
    const headerBg = scene.add.graphics();
    headerBg.fillStyle(0x222222, 1);
    headerBg.fillRect(0, 0, PANEL_W, HEADER_H);
    this.container.add(headerBg);

    const titleText = scene.add.text(CONTENT_PAD, 8, 'EQUIPMENT', {
      fontFamily: FONT,
      fontSize: '10px',
      color: '#E8DCC8',
    });
    this.container.add(titleText);

    // Close button
    const closeBtn = scene.add.text(PANEL_W - 30, 8, '[X]', {
      fontFamily: FONT,
      fontSize: '10px',
      color: '#E8DCC8',
    }).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    closeBtn.on('pointerover', () => closeBtn.setColor('#FFD700'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#E8DCC8'));
    this.container.add(closeBtn);

    // Vertical divider between left and right panels
    const divider = scene.add.graphics();
    divider.lineStyle(1, BORDER_COLOR, 1);
    divider.lineBetween(LEFT_W + 10, HEADER_H, LEFT_W + 10, PANEL_H - 4);
    this.container.add(divider);

    // Sub-containers for content (offset below header)
    this.leftContent = scene.add.container(CONTENT_PAD, HEADER_H + CONTENT_PAD);
    this.container.add(this.leftContent);

    this.rightContent = scene.add.container(RIGHT_X, HEADER_H + CONTENT_PAD);
    this.container.add(this.rightContent);

    // Tooltip container (shown on hover, rendered on top within panel)
    this.tooltipContainer = scene.add.container(0, 0);
    this.container.add(this.tooltipContainer);

    // Listen for close-all-panels event
    scene.events.on(CLOSE_ALL_PANELS, this.handleCloseAll, this);

    // Bug 11+12: Rebuild panel when inventory changes (e.g. after a loot run finds a weapon).
    // Without this, newly found weapons only show after closing and reopening the panel.
    scene.events.on('inventory-changed', this.handleInventoryChanged, this);

    scene.events.once('shutdown', () => {
      scene.events.off(CLOSE_ALL_PANELS, this.handleCloseAll, this);
      scene.events.off('inventory-changed', this.handleInventoryChanged, this);
      this.backdrop.destroy();
      this.container.destroy();
    });

    this.rebuild();
  }

  // ---------------------------------------------------------------------------
  // Public API (backward compatible)
  // ---------------------------------------------------------------------------

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /** Shim: DayScene calls getPanel().getBackdrop(). Returns a minimal shim. */
  getPanel(): PanelShim {
    return this.panelShim;
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  /** Handle keyboard input. Returns true if key was consumed. */
  handleKey(key: string): boolean {
    if (!this.visible) return false;
    if (key === 'Escape') {
      if (this.viewState.mode !== 'default') {
        this.viewState = { mode: 'default' };
        this.rebuild();
      } else {
        this.hide();
      }
      return true;
    }
    return false;
  }

  rebuild(): void {
    this.hideTooltip();
    switch (this.viewState.mode) {
      case 'default':
        this.buildDefaultView();
        break;
      case 'upgrade':
        this.buildUpgradeView(this.viewState.weaponId);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Show / hide
  // ---------------------------------------------------------------------------

  private show(): void {
    // Close other open panels first
    this.scene.events.emit(CLOSE_ALL_PANELS);
    this.viewState = { mode: 'default' };
    this.rebuild();
    this.backdrop.setVisible(true);
    this.container.setVisible(true);
    this.visible = true;
  }

  private hide(): void {
    this.hideTooltip();
    this.backdrop.setVisible(false);
    this.container.setVisible(false);
    this.visible = false;
  }

  private handleCloseAll = (): void => {
    if (this.visible) {
      this.container.setVisible(false);
      this.backdrop.setVisible(false);
      this.visible = false;
    }
  };

  /** Bug 11+12: Rebuild the panel whenever inventory changes (e.g. loot run weapon drop). */
  private handleInventoryChanged = (): void => {
    if (this.visible) {
      this.rebuild();
    }
  };

  // ---------------------------------------------------------------------------
  // Default view -- dual panel layout
  // ---------------------------------------------------------------------------

  private buildDefaultView(): void {
    this.leftContent.removeAll(true);
    this.rightContent.removeAll(true);

    this.buildLeftPanel();
    this.buildRightPanel();
  }

  // ---------------------------------------------------------------------------
  // LEFT PANEL -- tabbed inventory
  // ---------------------------------------------------------------------------

  private buildLeftPanel(): void {
    const c = this.leftContent;
    const w = LEFT_W - CONTENT_PAD * 2;
    let y = 0;

    // Tab strip: WEAPONS | ARMOR | SHIELDS
    y = this.buildTabStrip(c, y, w);
    y += 6;

    switch (this.activeTab) {
      case 'WEAPONS':
        y = this.buildWeaponsTab(c, y, w);
        break;
      case 'ARMOR':
        y = this.buildArmorTab(c, y, w);
        break;
      case 'SHIELDS':
        this.buildShieldsTab(c, y, w);
        break;
    }
  }

  /** Draw WEAPONS | ARMOR | SHIELDS tab buttons. Returns next y. */
  private buildTabStrip(
    c: Phaser.GameObjects.Container,
    y: number,
    w: number,
  ): number {
    const tabs: InventoryTab[] = ['WEAPONS', 'ARMOR', 'SHIELDS'];
    const tabW = Math.floor(w / tabs.length);
    const tabH = 18;

    tabs.forEach((tab, i) => {
      const tx = i * tabW;
      const isActive = this.activeTab === tab;

      const bg = this.scene.add.graphics();
      bg.fillStyle(isActive ? 0x333333 : 0x1A1A1A, 1);
      bg.fillRect(tx, y, tabW - 2, tabH);
      bg.lineStyle(1, isActive ? 0xE07030 : 0x333333, 1);
      bg.strokeRect(tx, y, tabW - 2, tabH);
      c.add(bg);

      const label = this.scene.add.text(tx + Math.floor(tabW / 2) - 1, y + 5, tab, {
        fontFamily: FONT,
        fontSize: '7px',
        color: isActive ? '#E07030' : '#6B6B6B',
      }).setOrigin(0.5, 0);
      c.add(label);

      if (!isActive) {
        bg.setInteractive(
          new Phaser.Geom.Rectangle(tx, y, tabW - 2, tabH),
          Phaser.Geom.Rectangle.Contains,
        );
        if (bg.input) bg.input.cursor = 'pointer';
        bg.on('pointerdown', () => {
          this.activeTab = tab;
          this.weaponPage = 0;
          this.armorPage = 0;
          this.shieldPage = 0;
          this.rebuild();
        });
        bg.on('pointerover', () => {
          bg.clear();
          bg.fillStyle(0x2A2A2A, 1);
          bg.fillRect(tx, y, tabW - 2, tabH);
          bg.lineStyle(1, 0x555555, 1);
          bg.strokeRect(tx, y, tabW - 2, tabH);
          label.setColor('#E8DCC8');
        });
        bg.on('pointerout', () => {
          bg.clear();
          bg.fillStyle(0x1A1A1A, 1);
          bg.fillRect(tx, y, tabW - 2, tabH);
          bg.lineStyle(1, 0x333333, 1);
          bg.strokeRect(tx, y, tabW - 2, tabH);
          label.setColor('#6B6B6B');
        });
      }
    });

    return y + tabH;
  }

  // ---- WEAPONS tab ----

  private buildWeaponsTab(c: Phaser.GameObjects.Container, y: number, w: number): number {
    const weapons = this.gameState.inventory.weapons;
    const { primaryWeaponId, secondaryWeaponId } = this.gameState.equipped;

    // Sort: highest damage first, then by rarity
    const rarityOrder: Record<string, number> = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
    const sorted = [...weapons].sort((a, b) => {
      const da = this.weaponManager.getWeaponStats(a).damage;
      const db = this.weaponManager.getWeaponStats(b).damage;
      if (db !== da) return db - da;
      return (rarityOrder[a.rarity] ?? 4) - (rarityOrder[b.rarity] ?? 4);
    });

    const total = sorted.length;

    // Header row with count
    const header = this.scene.add.text(0, y, `WEAPONS (${total})`, {
      fontFamily: FONT, fontSize: '8px', color: '#6B6B6B',
    });
    c.add(header);
    y += 14;

    // Show which slot is currently targeted by equip clicks
    const slotNum = this.selectedSlot === 'primary' ? '1' : '2';
    const equipHint = this.scene.add.text(0, y, `Equipping to: ${this.selectedSlot.toUpperCase()} [${slotNum}]`, {
      fontFamily: FONT, fontSize: '7px', color: '#E07030',
    });
    c.add(equipHint);
    y += 14;

    if (total === 0) {
      c.add(this.scene.add.text(0, y, 'No weapons', {
        fontFamily: FONT, fontSize: '7px', color: '#444444',
      }));
      return y + 12;
    }

    // Pagination: 8 items per page
    const PAGE_SIZE = 8;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const page = Math.min(this.weaponPage, totalPages - 1);
    const startIdx = page * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, total);

    for (let i = startIdx; i < endIdx; i++) {
      const weapon = sorted[i];
      if (!weapon) continue;

      const isEquipped = weapon.id === primaryWeaponId || weapon.id === secondaryWeaponId;
      const isBroken = this.weaponManager.isBroken(weapon);
      const stats = this.weaponManager.getWeaponStats(weapon);
      const data = WeaponManager.getWeaponData(weapon.weaponId);
      const name = data?.name ?? weapon.weaponId;
      const color = isBroken ? '#F44336' : (RARITY_COLORS[weapon.rarity] ?? '#E8DCC8');
      const rar = weapon.rarity[0]?.toUpperCase() ?? '?';

      const rowH = 18;
      const rowBg = this.scene.add.graphics();
      rowBg.fillStyle(isEquipped ? 0x2A2A2A : 0x1A1A1A, 1);
      rowBg.fillRect(0, y, w, rowH);
      c.add(rowBg);

      const equippedMark = isEquipped
        ? (weapon.id === primaryWeaponId ? ' [1]' : ' [2]')
        : '';
      // Reserve 20px on right for [S] scrap button on non-equipped rows
      const scrapBtnW = isEquipped ? 0 : 20;
      const textAreaW = w - scrapBtnW - 8;
      // Fix 2: Show weapon level in list ("Lv3" with level colored)
      const lvLabel = weapon.level >= 5 ? '★' : `Lv${weapon.level}`;
      const rowLabel = `${name} [${rar}] ${lvLabel} D:${stats.damage}${equippedMark}`;
      const rowText = this.scene.add.text(4, y + 4, rowLabel, {
        fontFamily: FONT, fontSize: '7px', color,
        // Truncate label to fit within the row text area
        fixedWidth: textAreaW > 0 ? textAreaW : undefined,
      });
      c.add(rowText);

      // Fix 2: Level color overlay -- draw a separate colored text just for the level part
      // placed right after "name [R] "
      const lvColor = weaponLevelColor(weapon.level);
      if (lvColor !== color) {
        // Calculate x offset to the level label within the row text (approximate)
        // We position a separate text object for the level tag with its own color
        const prefixLabel = `${name} [${rar}] `;
        const prefixText = this.scene.add.text(4, y + 4, prefixLabel, {
          fontFamily: FONT, fontSize: '7px', color: 'rgba(0,0,0,0)',
        });
        const lvX = 4 + prefixText.width;
        prefixText.destroy();
        const lvText = this.scene.add.text(lvX, y + 4, lvLabel, {
          fontFamily: FONT, fontSize: '7px', color: lvColor,
        });
        c.add(lvText);
      }

      // Chevron on right (shifted left when scrap button is present)
      const arrowX = isEquipped ? w - 4 : w - scrapBtnW - 8;
      const arrowText = this.scene.add.text(arrowX, y + 4, '>', {
        fontFamily: FONT, fontSize: '7px', color: '#4A90D9',
      }).setOrigin(1, 0);
      c.add(arrowText);

      // Capture loop variables for closures (arrow functions preserve 'this')
      const capturedWeapon = weapon;
      const capturedY = y;
      const capturedIsEquipped = isEquipped;
      const capturedColor = color;
      const capturedIsBroken = isBroken;

      // Bug 13: [S] scrap button for non-equipped weapons only
      if (!isEquipped) {
        const sv = SCRAP_VALUES[weapon.rarity] ?? { scrap: 2, parts: 1 };
        const scrapBtn = this.scene.add.text(w - 2, y + 4, '[S]', {
          fontFamily: FONT, fontSize: '7px', color: '#AA4433',
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        scrapBtn.on('pointerover', () => scrapBtn.setColor('#FF6655'));
        scrapBtn.on('pointerout', () => scrapBtn.setColor('#AA4433'));
        scrapBtn.on('pointerdown', () => {
          const idx = this.gameState.inventory.weapons.indexOf(capturedWeapon);
          if (idx >= 0) {
            this.gameState.inventory.weapons.splice(idx, 1);
            this.gameState.inventory.resources.scrap += sv.scrap;
            this.gameState.inventory.resources.parts += sv.parts;
            this.onResourceChange();
            // Stay on same page (or go back one if it was the last item on this page)
            const remaining = this.gameState.inventory.weapons.length;
            const maxPage = Math.max(0, Math.ceil(remaining / PAGE_SIZE) - 1);
            if (this.weaponPage > maxPage) this.weaponPage = maxPage;
            this.rebuild();
          }
        });
        c.add(scrapBtn);
      }

      rowBg.setInteractive(
        new Phaser.Geom.Rectangle(0, y, w - scrapBtnW, rowH),
        Phaser.Geom.Rectangle.Contains,
      );
      if (rowBg.input) rowBg.input.cursor = 'pointer';

      rowBg.on('pointerover', () => {
        rowBg.clear();
        rowBg.fillStyle(0x3A3A3A, 1);
        rowBg.fillRect(0, capturedY, w, rowH);
        rowText.setColor('#FFD700');
        // Show hover comparison ABOVE the hovered row (Bug 14: avoid overlapping next row)
        const primaryWeapon = this.gameState.equipped.primaryWeaponId
          ? this.gameState.inventory.weapons.find(ww => ww.id === this.gameState.equipped.primaryWeaponId) ?? null
          : null;
        this.showWeaponComparison(capturedWeapon, primaryWeapon, capturedY);
      });
      rowBg.on('pointerout', () => {
        rowBg.clear();
        rowBg.fillStyle(capturedIsEquipped ? 0x2A2A2A : 0x1A1A1A, 1);
        rowBg.fillRect(0, capturedY, w, rowH);
        rowText.setColor(capturedColor);
        this.hideTooltip();
      });
      rowBg.on('pointerdown', () => {
        if (capturedIsEquipped) {
          // Click equipped weapon -- open upgrade view
          this.viewState = { mode: 'upgrade', weaponId: capturedWeapon.id };
          this.rebuild();
        } else if (!capturedIsBroken) {
          // Equip to the currently selected slot (primary or secondary)
          if (this.selectedSlot === 'secondary') {
            // If this weapon is currently in the primary slot, swap it out
            if (this.gameState.equipped.primaryWeaponId === capturedWeapon.id) {
              this.gameState.equipped.primaryWeaponId = null;
            }
            this.gameState.equipped.secondaryWeaponId = capturedWeapon.id;
          } else {
            // If this weapon is currently in the secondary slot, swap it out
            if (this.gameState.equipped.secondaryWeaponId === capturedWeapon.id) {
              this.gameState.equipped.secondaryWeaponId = null;
            }
            this.gameState.equipped.primaryWeaponId = capturedWeapon.id;
          }
          this.rebuild();
        }
      });

      y += rowH + 2;
    }

    // Pagination controls
    if (totalPages > 1) {
      y += 4;
      const pageLabel = this.scene.add.text(w / 2, y, `Page ${page + 1}/${totalPages}`, {
        fontFamily: FONT, fontSize: '7px', color: '#555555',
      }).setOrigin(0.5, 0);
      c.add(pageLabel);

      if (page > 0) {
        const prevBtn = this.scene.add.text(0, y, '[<]', {
          fontFamily: FONT, fontSize: '7px', color: '#FFD700',
        }).setInteractive({ useHandCursor: true });
        prevBtn.on('pointerdown', () => { this.weaponPage = page - 1; this.rebuild(); });
        c.add(prevBtn);
      }
      if (page < totalPages - 1) {
        const nextBtn = this.scene.add.text(w - 2, y, '[>]', {
          fontFamily: FONT, fontSize: '7px', color: '#FFD700',
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        nextBtn.on('pointerdown', () => { this.weaponPage = page + 1; this.rebuild(); });
        c.add(nextBtn);
      }

      y += 14;
    }

    // Scrap all common button (only non-equipped common weapons)
    const unequippedCommon = weapons.filter(
      ww => ww.rarity === 'common'
        && ww.id !== primaryWeaponId
        && ww.id !== secondaryWeaponId,
    );
    if (unequippedCommon.length >= 1) {
      y += 4;
      const scrapAllBtn = this.scene.add.text(
        0, y,
        `[SCRAP ALL COMMON (${unequippedCommon.length}) +${unequippedCommon.length * 2}S]`,
        { fontFamily: FONT, fontSize: '7px', color: '#AA4433' },
      ).setInteractive({ useHandCursor: true });
      scrapAllBtn.on('pointerover', () => scrapAllBtn.setColor('#FF6655'));
      scrapAllBtn.on('pointerout', () => scrapAllBtn.setColor('#AA4433'));
      scrapAllBtn.on('pointerdown', () => {
        for (const ww of unequippedCommon) {
          const idx = this.gameState.inventory.weapons.indexOf(ww);
          if (idx >= 0) this.gameState.inventory.weapons.splice(idx, 1);
          this.gameState.inventory.resources.scrap += 2;
          this.gameState.inventory.resources.parts += 1;
        }
        this.onResourceChange();
        this.weaponPage = 0;
        this.rebuild();
      });
      c.add(scrapAllBtn);
      y += 14;
    }

    return y;
  }

  // ---- ARMOR tab ----

  private buildArmorTab(c: Phaser.GameObjects.Container, y: number, w: number): number {
    const armorInv: ArmorInstance[] = this.gameState.inventory.armorInventory ?? [];
    const equippedArmorId = this.gameState.equipped.equippedArmor ?? null;

    const total = armorInv.length;
    c.add(this.scene.add.text(0, y, `ARMOR (${total})`, {
      fontFamily: FONT, fontSize: '8px', color: '#6B6B6B',
    }));
    y += 14;

    if (total === 0) {
      c.add(this.scene.add.text(0, y, 'No armor in inventory', {
        fontFamily: FONT, fontSize: '7px', color: '#444444',
      }));
      return y + 12;
    }

    const PAGE_SIZE = 8;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const page = Math.min(this.armorPage, totalPages - 1);
    const startIdx = page * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, total);

    for (let i = startIdx; i < endIdx; i++) {
      const inst = armorInv[i];
      if (!inst) continue;

      const data = getArmorData(inst.armorId);
      const name = data?.name ?? inst.armorId;
      const reductionPct = data ? Math.round(data.reduction * 100) : 0;
      const isEquipped = inst.id === equippedArmorId;
      const color = isEquipped ? '#4CAF50' : (RARITY_COLORS[inst.rarity] ?? '#E8DCC8');
      const rar = inst.rarity[0]?.toUpperCase() ?? '?';

      const rowH = 18;
      const rowBg = this.scene.add.graphics();
      rowBg.fillStyle(isEquipped ? 0x2A2A2A : 0x1A1A1A, 1);
      rowBg.fillRect(0, y, w, rowH);
      c.add(rowBg);

      // Fix 1: reserve 20px for [S] scrap button on non-equipped rows
      const armorScrapBtnW = isEquipped ? 0 : 20;
      const armorTextAreaW = w - armorScrapBtnW - 8;
      const mark = isEquipped ? ' [E]' : '';
      const rowLabel = `${name} [${rar}] ${reductionPct}%${mark}`;
      const rowText = this.scene.add.text(4, y + 4, rowLabel, {
        fontFamily: FONT, fontSize: '7px', color,
        fixedWidth: armorTextAreaW > 0 ? armorTextAreaW : undefined,
      });
      c.add(rowText);

      const capturedInst = inst;
      const capturedIsEquipped = isEquipped;
      const capturedY = y;
      const capturedColor = color;
      const capturedData = data;

      // Fix 1: [S] scrap button for non-equipped armor
      if (!isEquipped) {
        const sv = SCRAP_VALUES[inst.rarity] ?? { scrap: 2, parts: 1 };
        const armorScrapBtn = this.scene.add.text(w - 2, y + 4, '[S]', {
          fontFamily: FONT, fontSize: '7px', color: '#AA4433',
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        armorScrapBtn.on('pointerover', () => armorScrapBtn.setColor('#FF6655'));
        armorScrapBtn.on('pointerout', () => armorScrapBtn.setColor('#AA4433'));
        armorScrapBtn.on('pointerdown', () => {
          const idx = (this.gameState.inventory.armorInventory ?? []).indexOf(capturedInst);
          if (idx >= 0) {
            (this.gameState.inventory.armorInventory ?? []).splice(idx, 1);
            this.gameState.inventory.resources.scrap += sv.scrap;
            this.gameState.inventory.resources.parts += sv.parts;
            this.onResourceChange();
            const remaining = (this.gameState.inventory.armorInventory ?? []).length;
            const maxPage = Math.max(0, Math.ceil(remaining / PAGE_SIZE) - 1);
            if (this.armorPage > maxPage) this.armorPage = maxPage;
            this.rebuild();
          }
        });
        c.add(armorScrapBtn);
      }

      rowBg.setInteractive(
        new Phaser.Geom.Rectangle(0, y, w - armorScrapBtnW, rowH),
        Phaser.Geom.Rectangle.Contains,
      );
      if (rowBg.input) rowBg.input.cursor = 'pointer';
      rowBg.on('pointerover', () => {
        rowBg.clear();
        rowBg.fillStyle(0x3A3A3A, 1);
        rowBg.fillRect(0, capturedY, w, rowH);
        rowText.setColor('#FFD700');
        // Fix 4: Show armor comparison on hover
        const equippedArmorId = this.gameState.equipped.equippedArmor ?? null;
        const armorInvList: ArmorInstance[] = this.gameState.inventory.armorInventory ?? [];
        const equippedArmorInst = equippedArmorId
          ? armorInvList.find(a => a.id === equippedArmorId) ?? null
          : null;
        const equippedArmorData = equippedArmorInst ? getArmorData(equippedArmorInst.armorId) ?? null : null;
        this.showArmorComparison(capturedData ?? null, equippedArmorData, capturedY);
      });
      rowBg.on('pointerout', () => {
        rowBg.clear();
        rowBg.fillStyle(capturedIsEquipped ? 0x2A2A2A : 0x1A1A1A, 1);
        rowBg.fillRect(0, capturedY, w, rowH);
        rowText.setColor(capturedColor);
        this.hideTooltip();
      });
      rowBg.on('pointerdown', () => {
        // Toggle equip on click
        if (capturedIsEquipped) {
          this.gameState.equipped.equippedArmor = null;
        } else {
          this.gameState.equipped.equippedArmor = capturedInst.id;
        }
        this.rebuild();
      });

      y += rowH + 2;
    }

    if (totalPages > 1) {
      y += 4;
      c.add(this.scene.add.text(w / 2, y, `Page ${page + 1}/${totalPages}`, {
        fontFamily: FONT, fontSize: '7px', color: '#555555',
      }).setOrigin(0.5, 0));
      if (page > 0) {
        const pb = this.scene.add.text(0, y, '[<]', {
          fontFamily: FONT, fontSize: '7px', color: '#FFD700',
        }).setInteractive({ useHandCursor: true });
        pb.on('pointerdown', () => { this.armorPage = page - 1; this.rebuild(); });
        c.add(pb);
      }
      if (page < totalPages - 1) {
        const nb = this.scene.add.text(w - 2, y, '[>]', {
          fontFamily: FONT, fontSize: '7px', color: '#FFD700',
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        nb.on('pointerdown', () => { this.armorPage = page + 1; this.rebuild(); });
        c.add(nb);
      }
      y += 14;
    }

    return y;
  }

  // ---- SHIELDS tab ----

  private buildShieldsTab(c: Phaser.GameObjects.Container, y: number, w: number): number {
    const shieldInv: ShieldInstance[] = this.gameState.inventory.shieldInventory ?? [];
    const equippedShieldId = this.gameState.equipped.equippedShield ?? null;

    const total = shieldInv.length;
    c.add(this.scene.add.text(0, y, `SHIELDS (${total})`, {
      fontFamily: FONT, fontSize: '8px', color: '#6B6B6B',
    }));
    y += 14;

    if (total === 0) {
      c.add(this.scene.add.text(0, y, 'No shields in inventory', {
        fontFamily: FONT, fontSize: '7px', color: '#444444',
      }));
      return y + 12;
    }

    const PAGE_SIZE = 8;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const page = Math.min(this.shieldPage, totalPages - 1);
    const startIdx = page * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, total);

    for (let i = startIdx; i < endIdx; i++) {
      const inst = shieldInv[i];
      if (!inst) continue;

      const data = getShieldData(inst.shieldId);
      const name = data?.name ?? inst.shieldId;
      const blocks = data?.blockHits ?? 0;
      const isEquipped = inst.id === equippedShieldId;
      const color = isEquipped ? '#4CAF50' : (RARITY_COLORS[inst.rarity] ?? '#E8DCC8');
      const rar = inst.rarity[0]?.toUpperCase() ?? '?';

      const rowH = 18;
      const rowBg = this.scene.add.graphics();
      rowBg.fillStyle(isEquipped ? 0x2A2A2A : 0x1A1A1A, 1);
      rowBg.fillRect(0, y, w, rowH);
      c.add(rowBg);

      // Fix 1: reserve 20px for [S] scrap button on non-equipped rows
      const shieldScrapBtnW = isEquipped ? 0 : 20;
      const shieldTextAreaW = w - shieldScrapBtnW - 8;
      const mark = isEquipped ? ' [E]' : '';
      const rowLabel = `${name} [${rar}] ${blocks}blk${mark}`;
      const rowText = this.scene.add.text(4, y + 4, rowLabel, {
        fontFamily: FONT, fontSize: '7px', color,
        fixedWidth: shieldTextAreaW > 0 ? shieldTextAreaW : undefined,
      });
      c.add(rowText);

      const capturedInst = inst;
      const capturedIsEquipped = isEquipped;
      const capturedY = y;
      const capturedColor = color;
      const capturedShieldData = data;

      // Fix 1: [S] scrap button for non-equipped shields
      if (!isEquipped) {
        const sv = SCRAP_VALUES[inst.rarity] ?? { scrap: 2, parts: 1 };
        const shieldScrapBtn = this.scene.add.text(w - 2, y + 4, '[S]', {
          fontFamily: FONT, fontSize: '7px', color: '#AA4433',
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        shieldScrapBtn.on('pointerover', () => shieldScrapBtn.setColor('#FF6655'));
        shieldScrapBtn.on('pointerout', () => shieldScrapBtn.setColor('#AA4433'));
        shieldScrapBtn.on('pointerdown', () => {
          const idx = (this.gameState.inventory.shieldInventory ?? []).indexOf(capturedInst);
          if (idx >= 0) {
            (this.gameState.inventory.shieldInventory ?? []).splice(idx, 1);
            this.gameState.inventory.resources.scrap += sv.scrap;
            this.gameState.inventory.resources.parts += sv.parts;
            this.onResourceChange();
            const remaining = (this.gameState.inventory.shieldInventory ?? []).length;
            const maxPage = Math.max(0, Math.ceil(remaining / PAGE_SIZE) - 1);
            if (this.shieldPage > maxPage) this.shieldPage = maxPage;
            this.rebuild();
          }
        });
        c.add(shieldScrapBtn);
      }

      rowBg.setInteractive(
        new Phaser.Geom.Rectangle(0, y, w - shieldScrapBtnW, rowH),
        Phaser.Geom.Rectangle.Contains,
      );
      if (rowBg.input) rowBg.input.cursor = 'pointer';
      rowBg.on('pointerover', () => {
        rowBg.clear();
        rowBg.fillStyle(0x3A3A3A, 1);
        rowBg.fillRect(0, capturedY, w, rowH);
        rowText.setColor('#FFD700');
        // Fix 4: Show shield comparison on hover
        const equippedShieldId = this.gameState.equipped.equippedShield ?? null;
        const shieldInvList: ShieldInstance[] = this.gameState.inventory.shieldInventory ?? [];
        const equippedShieldInst = equippedShieldId
          ? shieldInvList.find(s => s.id === equippedShieldId) ?? null
          : null;
        const equippedShieldData = equippedShieldInst ? getShieldData(equippedShieldInst.shieldId) ?? null : null;
        this.showShieldComparison(capturedShieldData ?? null, equippedShieldData, capturedY);
      });
      rowBg.on('pointerout', () => {
        rowBg.clear();
        rowBg.fillStyle(capturedIsEquipped ? 0x2A2A2A : 0x1A1A1A, 1);
        rowBg.fillRect(0, capturedY, w, rowH);
        rowText.setColor(capturedColor);
        this.hideTooltip();
      });
      rowBg.on('pointerdown', () => {
        // Toggle equip on click
        if (capturedIsEquipped) {
          this.gameState.equipped.equippedShield = null;
        } else {
          this.gameState.equipped.equippedShield = capturedInst.id;
        }
        this.rebuild();
      });

      y += rowH + 2;
    }

    if (totalPages > 1) {
      y += 4;
      c.add(this.scene.add.text(w / 2, y, `Page ${page + 1}/${totalPages}`, {
        fontFamily: FONT, fontSize: '7px', color: '#555555',
      }).setOrigin(0.5, 0));
      if (page > 0) {
        const pb = this.scene.add.text(0, y, '[<]', {
          fontFamily: FONT, fontSize: '7px', color: '#FFD700',
        }).setInteractive({ useHandCursor: true });
        pb.on('pointerdown', () => { this.shieldPage = page - 1; this.rebuild(); });
        c.add(pb);
      }
      if (page < totalPages - 1) {
        const nb = this.scene.add.text(w - 2, y, '[>]', {
          fontFamily: FONT, fontSize: '7px', color: '#FFD700',
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        nb.on('pointerdown', () => { this.shieldPage = page + 1; this.rebuild(); });
        c.add(nb);
      }
      y += 14;
    }

    return y;
  }

  // ---------------------------------------------------------------------------
  // RIGHT PANEL -- equipped overview
  // ---------------------------------------------------------------------------

  private buildRightPanel(): void {
    const c = this.rightContent;
    const w = RIGHT_W;
    let y = 0;

    const weapons = this.gameState.inventory.weapons;
    const { primaryWeaponId, secondaryWeaponId } = this.gameState.equipped;

    const primaryWeapon = primaryWeaponId
      ? weapons.find(ww => ww.id === primaryWeaponId) ?? null
      : null;
    const secondaryWeapon = secondaryWeaponId
      ? weapons.find(ww => ww.id === secondaryWeaponId) ?? null
      : null;

    // Character portrait
    const portraitKey = `portrait_${this.gameState.player.character}`;
    if (this.scene.textures.exists(portraitKey)) {
      const portrait = this.scene.add.image(w / 2, y + 24, portraitKey);
      portrait.setDisplaySize(48, 48);
      c.add(portrait);

      const border = this.scene.add.graphics();
      border.lineStyle(2, 0xC5A030, 1);
      border.strokeRect(w / 2 - 24, y, 48, 48);
      c.add(border);

      const charName = this.gameState.player.character.charAt(0).toUpperCase()
        + this.gameState.player.character.slice(1);
      const nameText = this.scene.add.text(w / 2, y + 52, charName, {
        fontFamily: FONT,
        fontSize: '8px',
        color: '#C5A030',
      }).setOrigin(0.5, 0);
      c.add(nameText);

      y = 68;
    }

    // Thin divider
    const div1 = this.scene.add.graphics();
    div1.lineStyle(1, 0x333333, 1);
    div1.lineBetween(0, y, w, y);
    c.add(div1);
    y += 8;

    // PRIMARY weapon slot
    y = this.buildEquippedWeaponSlot(c, w, y, 'PRIMARY [1]', primaryWeapon, 'primary');
    y += 4;

    // SECONDARY weapon slot
    y = this.buildEquippedWeaponSlot(c, w, y, 'SECONDARY [2]', secondaryWeapon, 'secondary');
    y += 4;

    const div2 = this.scene.add.graphics();
    div2.lineStyle(1, 0x333333, 1);
    div2.lineBetween(0, y, w, y);
    c.add(div2);
    y += 8;

    // Armor slot
    y = this.buildEquippedArmorSlot(c, w, y);
    y += 4;

    // Shield slot
    y = this.buildEquippedShieldSlot(c, w, y);
    y += 4;

    const div3 = this.scene.add.graphics();
    div3.lineStyle(1, 0x333333, 1);
    div3.lineBetween(0, y, w, y);
    c.add(div3);
    y += 8;

    // Stats summary
    this.buildStatsSummary(c, w, y);
  }

  /**
   * Render one equipped weapon slot (PRIMARY or SECONDARY).
   * Shows full stats + UNEQUIP / REPAIR / UPGRADE / SCRAP buttons.
   * Returns new y.
   */
  private buildEquippedWeaponSlot(
    c: Phaser.GameObjects.Container,
    w: number,
    y: number,
    label: string,
    weapon: WeaponInstance | null,
    slot: Slot,
  ): number {
    // Slot label -- clicking it selects this slot as the equip target
    const isThisSlotSelected = this.selectedSlot === slot;
    const slotLabelColor = isThisSlotSelected ? '#E07030' : '#6B6B6B';
    const slotLabel = this.scene.add.text(0, y, `${label}:`, {
      fontFamily: FONT, fontSize: '8px', color: slotLabelColor,
    }).setInteractive({ useHandCursor: true });
    slotLabel.on('pointerdown', () => {
      this.selectedSlot = slot;
      this.rebuild();
    });
    slotLabel.on('pointerover', () => slotLabel.setColor('#FFD700'));
    slotLabel.on('pointerout', () => slotLabel.setColor(slotLabelColor));
    c.add(slotLabel);

    // Show active-slot indicator so player knows which slot receives equip clicks
    if (isThisSlotSelected) {
      const activeIndicator = this.scene.add.text(slotLabel.width + 6, y, '[ACTIVE]', {
        fontFamily: FONT, fontSize: '6px', color: '#E07030',
      });
      c.add(activeIndicator);
    }
    y += 12;

    if (!weapon) {
      const emptyBg = this.scene.add.graphics();
      emptyBg.lineStyle(1, isThisSlotSelected ? 0xE07030 : 0x333333, 1);
      emptyBg.strokeRect(0, y, w, 22);
      c.add(emptyBg);
      c.add(this.scene.add.text(4, y + 7, '(empty -- click slot label to select, then weapon)', {
        fontFamily: FONT, fontSize: '6px', color: isThisSlotSelected ? '#E07030' : '#444444',
      }));
      return y + 24;
    }

    const stats = this.weaponManager.getWeaponStats(weapon);
    const data = WeaponManager.getWeaponData(weapon.weaponId);
    const name = data?.name ?? weapon.weaponId;
    const color = RARITY_COLORS[weapon.rarity] ?? '#E8DCC8';
    const isBroken = this.weaponManager.isBroken(weapon);

    // Name + rarity line -- clamped to right panel width with wordWrap (Fix 8)
    c.add(this.scene.add.text(0, y, `${name} [${weapon.rarity}]`, {
      fontFamily: FONT, fontSize: '7px',
      color: isBroken ? '#F44336' : color,
      wordWrap: { width: w - 2 },
    }));
    y += 11;

    // Upgrade path visualization: 5 boxes in a row
    // [Stock] -> [Modified] -> [Enhanced] -> [Superior] -> [ULTIMATE]
    //  done(green)  done(green)  CURRENT(yellow)  future(gray)  locked(gray/gold)
    y = this.buildUpgradePath(c, w, y, weapon.level);

    // XP progress to next tier (addresses BG5: nunchucks stuck at Lv3).
    // Shows "XP: current/needed" and a thin bar. Lv4+ shows ULTIMATE unlock hint.
    if (weapon.level < 4) {
      const needed = this.weaponManager.getXPForNextLevel(weapon);
      const curr = weapon.xp;
      const ratio = needed > 0 ? Math.min(1, curr / needed) : 0;
      c.add(this.scene.add.text(0, y, `XP ${curr}/${needed}`, {
        fontFamily: FONT, fontSize: '6px', color: '#BDBDBD',
      }));
      const BAR_W = Math.min(120, w - 60);
      const BAR_X = 50;
      const BAR_Y = y + 1;
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x1A1A1A, 1);
      bg.fillRect(BAR_X, BAR_Y, BAR_W, 4);
      bg.fillStyle(0xC5A030, 1);
      bg.fillRect(BAR_X, BAR_Y, Math.floor(BAR_W * ratio), 4);
      bg.lineStyle(1, 0x555555, 1);
      bg.strokeRect(BAR_X, BAR_Y, BAR_W, 4);
      c.add(bg);
      y += 10;
    }

    // If weapon is Lv4, show blinking "ULTIMATE available!" prompt
    if (weapon.level === 4) {
      const weaponData = WeaponManager.getWeaponData(weapon.weaponId);
      if (weaponData?.ultimate) {
        const { parts, scrap } = weaponData.ultimate.cost;
        const ultimatePrompt = this.scene.add.text(0, y, `ULTIMATE available! (${parts}P ${scrap}S)`, {
          fontFamily: FONT, fontSize: '6px', color: '#FFD700',
          wordWrap: { width: w - 2 },
        });
        c.add(ultimatePrompt);
        // Blinking tween on the ultimate prompt text
        this.scene.tweens.add({
          targets: ultimatePrompt,
          alpha: { from: 1, to: 0.2 },
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        y += 10;
      }
    }

    // Stats line: DMG and RNG on left, DUR on right
    // Fix 8: ensure right-aligned DUR text stays within w
    const durColor = weapon.durability < weapon.maxDurability * 0.3 ? '#F44336'
      : weapon.durability < weapon.maxDurability * 0.6 ? '#FFD700' : '#8A8A8A';
    c.add(this.scene.add.text(0, y, `DMG:${stats.damage} RNG:${stats.range}`, {
      fontFamily: FONT, fontSize: '7px', color: '#8A8A8A', fixedWidth: Math.floor(w / 2),
    }));
    c.add(this.scene.add.text(w - 2, y, `DUR:${weapon.durability}/${weapon.maxDurability}`, {
      fontFamily: FONT, fontSize: '7px', color: durColor,
      fixedWidth: w / 2,
    }).setOrigin(1, 0));
    y += 11;

    // Special effect line (if any)
    if (stats.specialEffect) {
      c.add(this.scene.add.text(0, y, `Special: ${stats.specialEffect.type}`, {
        fontFamily: FONT, fontSize: '6px', color: '#AAB8C2',
      }));
      y += 11;
    }

    // Active upgrades summary
    if (weapon.upgrades.length > 0) {
      const upgradeNames = weapon.upgrades.map(u => u.id.replace(/_/g, ' ')).join(', ');
      c.add(this.scene.add.text(0, y, `Mods: ${upgradeNames}`, {
        fontFamily: FONT, fontSize: '6px', color: '#4A90D9',
        wordWrap: { width: w },
      }));
      y += 11;
    }

    // Action buttons row
    let btnX = 0;
    const btnGap = 4;

    const makeBtn = (lbl: string, col: string, cb: () => void): void => {
      const btn = this.scene.add.text(btnX, y, lbl, {
        fontFamily: FONT, fontSize: '6px', color: col,
      }).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setColor('#FFD700'));
      btn.on('pointerout', () => btn.setColor(col));
      btn.on('pointerdown', cb);
      c.add(btn);
      btnX += btn.width + btnGap;
    };

    // UNEQUIP
    makeBtn('[UNEQUIP]', '#E07030', () => {
      if (slot === 'primary') {
        this.gameState.equipped.primaryWeaponId = null;
      } else {
        this.gameState.equipped.secondaryWeaponId = null;
      }
      this.rebuild();
    });

    // REPAIR (only if damaged)
    if (weapon.durability < weapon.maxDurability) {
      const canRepair = this.currentAP() >= 1 && this.gameState.inventory.resources.parts >= 1;
      const repairCol = canRepair ? '#4CAF50' : '#444444';
      const repairBtn = this.scene.add.text(btnX, y, '[REPAIR]', {
        fontFamily: FONT, fontSize: '6px', color: repairCol,
      });
      c.add(repairBtn);
      if (canRepair) {
        repairBtn.setInteractive({ useHandCursor: true });
        repairBtn.on('pointerover', () => repairBtn.setColor('#FFD700'));
        repairBtn.on('pointerout', () => repairBtn.setColor(repairCol));
        repairBtn.on('pointerdown', () => {
          if (this.weaponManager.repair(weapon.id)) {
            this.spendAP(1);
            this.onResourceChange();
            this.rebuild();
          }
        });
        btnX += repairBtn.width + btnGap;
        renderResourceCosts(this.scene, c, { parts: 1 }, btnX, y, repairCol);
        btnX += 28;
      } else {
        btnX += repairBtn.width + btnGap;
      }
    }

    // UPGRADE (if upgrades available)
    const availUpgrades = this.weaponManager.getAvailableUpgradesForWeapon(weapon);
    if (availUpgrades.length > 0) {
      makeBtn('[UPGRADE]', '#4A90D9', () => {
        this.viewState = { mode: 'upgrade', weaponId: weapon.id };
        this.rebuild();
      });
    }

    // SCRAP
    const sv = SCRAP_VALUES[weapon.rarity] ?? { scrap: 2, parts: 1 };
    makeBtn(`[SCRAP +${sv.scrap}S]`, '#AA6633', () => {
      const idx = this.gameState.inventory.weapons.indexOf(weapon);
      if (idx >= 0) {
        this.gameState.inventory.weapons.splice(idx, 1);
        if (this.gameState.equipped.primaryWeaponId === weapon.id) {
          this.gameState.equipped.primaryWeaponId = null;
        }
        if (this.gameState.equipped.secondaryWeaponId === weapon.id) {
          this.gameState.equipped.secondaryWeaponId = null;
        }
        this.gameState.inventory.resources.scrap += sv.scrap;
        this.gameState.inventory.resources.parts += sv.parts;
        this.onResourceChange();
        this.rebuild();
      }
    });

    y += 12;
    return y;
  }

  /**
   * Render a compact upgrade path row for a weapon.
   * Shows 5 tier boxes with arrows: Stock -> Modified -> Enhanced -> Superior -> ULTIMATE
   * Completed tiers are green, current is yellow/highlighted, future are gray, Lv5 is gold.
   * Fits in ~300px width (RIGHT_W).
   * Returns next y after the row.
   */
  private buildUpgradePath(
    c: Phaser.GameObjects.Container,
    w: number,
    y: number,
    currentLevel: number,
  ): number {
    // Tier definitions in order
    const tiers: Array<{ level: number; label: string }> = [
      { level: 1, label: 'Stock' },
      { level: 2, label: 'Modif' },  // truncated to fit narrow box
      { level: 3, label: 'Enhcd' },
      { level: 4, label: 'Supr' },
      { level: 5, label: '★ ULT' },
    ];

    // Calculate box dimensions to fit within w (~300px)
    // 5 boxes + 4 arrows: arrow = 6px, box width varies
    const ARROW_W = 6;
    const totalArrows = 4 * ARROW_W; // 24px
    const boxW = Math.floor((w - totalArrows) / 5); // ~55px each at 300px wide
    const boxH = 18;

    let bx = 0; // current x within container offset

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      if (!tier) continue;
      const isDone = currentLevel > tier.level;
      const isCurrent = currentLevel === tier.level;
      const isUltimate = tier.level === 5;

      // Box background color
      let bgColor = 0x1A1A1A;
      let borderColor = 0x333333;
      let textColor = '#4B4B4B';  // future: dark gray

      if (isDone) {
        bgColor = 0x1A2A1A;
        borderColor = 0x2E6B2E;
        textColor = '#4CAF50';  // green for completed
      } else if (isCurrent) {
        bgColor = isUltimate ? 0x2A2200 : 0x2A2200;
        borderColor = isUltimate ? 0xC5A030 : 0xC5A030;
        textColor = isUltimate ? '#FFD700' : '#FFD700';  // yellow/gold for current
      }

      // Draw box
      const boxBg = this.scene.add.graphics();
      boxBg.fillStyle(bgColor, 1);
      boxBg.fillRect(bx, y, boxW - 1, boxH);
      boxBg.lineStyle(1, borderColor, 1);
      boxBg.strokeRect(bx, y, boxW - 1, boxH);
      // Extra bright border for current level
      if (isCurrent) {
        boxBg.lineStyle(2, isUltimate ? 0xFFD700 : 0xE8C840, 0.9);
        boxBg.strokeRect(bx + 1, y + 1, boxW - 3, boxH - 2);
      }
      c.add(boxBg);

      // Checkmark or level indicator on top line
      let topLabel: string;
      if (isDone) {
        topLabel = '\u2713';  // check mark
      } else if (isCurrent) {
        topLabel = `Lv${tier.level}`;
      } else {
        topLabel = '...';
      }

      const topText = this.scene.add.text(
        bx + Math.floor(boxW / 2) - 1, y + 2,
        topLabel,
        { fontFamily: FONT, fontSize: '5px', color: textColor },
      ).setOrigin(0.5, 0);
      c.add(topText);

      // Tier name on bottom line
      const tierNameText = this.scene.add.text(
        bx + Math.floor(boxW / 2) - 1, y + 9,
        tier.label,
        { fontFamily: FONT, fontSize: '5px', color: textColor },
      ).setOrigin(0.5, 0);
      c.add(tierNameText);

      bx += boxW;

      // Draw arrow between boxes (except after last)
      if (i < tiers.length - 1) {
        const arrowColor = isDone ? '#2E6B2E' : '#333333';
        const arrowY = y + Math.floor(boxH / 2);
        const arrowText = this.scene.add.text(bx + 1, arrowY, '>', {
          fontFamily: FONT, fontSize: '6px', color: arrowColor,
        }).setOrigin(0, 0.5);
        c.add(arrowText);
        bx += ARROW_W;
      }
    }

    return y + boxH + 4;
  }

  /** Render equipped armor slot with UNEQUIP button. Returns new y. */
  private buildEquippedArmorSlot(c: Phaser.GameObjects.Container, _w: number, y: number): number {
    c.add(this.scene.add.text(0, y, 'ARMOR:', {
      fontFamily: FONT, fontSize: '8px', color: '#6B6B6B',
    }));
    y += 12;

    const equippedArmorId = this.gameState.equipped.equippedArmor ?? null;
    const armorInv: ArmorInstance[] = this.gameState.inventory.armorInventory ?? [];
    const armorInst = equippedArmorId
      ? armorInv.find(a => a.id === equippedArmorId) ?? null
      : null;

    if (!armorInst) {
      c.add(this.scene.add.text(0, y, '(none -- select from ARMOR tab)', {
        fontFamily: FONT, fontSize: '6px', color: '#444444',
      }));
      return y + 12;
    }

    const data = getArmorData(armorInst.armorId);
    const name = data?.name ?? armorInst.armorId;
    const reductionPct = data ? Math.round(data.reduction * 100) : 0;

    c.add(this.scene.add.text(0, y, name, {
      fontFamily: FONT, fontSize: '7px', color: RARITY_COLORS[armorInst.rarity] ?? '#E8DCC8',
    }));
    y += 11;

    c.add(this.scene.add.text(0, y, `-${reductionPct}% damage, ${armorInst.nightsRemaining} nights left`, {
      fontFamily: FONT, fontSize: '6px', color: '#8A8A8A',
    }));
    y += 11;

    const unequipBtn = this.scene.add.text(0, y, '[UNEQUIP]', {
      fontFamily: FONT, fontSize: '6px', color: '#E07030',
    }).setInteractive({ useHandCursor: true });
    unequipBtn.on('pointerover', () => unequipBtn.setColor('#FFD700'));
    unequipBtn.on('pointerout', () => unequipBtn.setColor('#E07030'));
    unequipBtn.on('pointerdown', () => {
      this.gameState.equipped.equippedArmor = null;
      this.rebuild();
    });
    c.add(unequipBtn);
    y += 12;

    return y;
  }

  /** Render equipped shield slot with UNEQUIP button. Returns new y. */
  private buildEquippedShieldSlot(c: Phaser.GameObjects.Container, _w: number, y: number): number {
    c.add(this.scene.add.text(0, y, 'SHIELD:', {
      fontFamily: FONT, fontSize: '8px', color: '#6B6B6B',
    }));
    y += 12;

    const equippedShieldId = this.gameState.equipped.equippedShield ?? null;
    const shieldInv: ShieldInstance[] = this.gameState.inventory.shieldInventory ?? [];
    const shieldInst = equippedShieldId
      ? shieldInv.find(s => s.id === equippedShieldId) ?? null
      : null;

    if (!shieldInst) {
      c.add(this.scene.add.text(0, y, '(none -- select from SHIELDS tab)', {
        fontFamily: FONT, fontSize: '6px', color: '#444444',
      }));
      return y + 12;
    }

    const data = getShieldData(shieldInst.shieldId);
    const name = data?.name ?? shieldInst.shieldId;
    const blocks = data?.blockHits ?? 0;
    const cooldownS = data ? (data.cooldownMs / 1000).toFixed(0) : '?';

    c.add(this.scene.add.text(0, y, name, {
      fontFamily: FONT, fontSize: '7px', color: RARITY_COLORS[shieldInst.rarity] ?? '#E8DCC8',
    }));
    y += 11;

    c.add(this.scene.add.text(0, y, `${blocks} block${blocks !== 1 ? 's' : ''}, ${cooldownS}s cooldown`, {
      fontFamily: FONT, fontSize: '6px', color: '#8A8A8A',
    }));
    y += 11;

    const unequipBtn = this.scene.add.text(0, y, '[UNEQUIP]', {
      fontFamily: FONT, fontSize: '6px', color: '#E07030',
    }).setInteractive({ useHandCursor: true });
    unequipBtn.on('pointerover', () => unequipBtn.setColor('#FFD700'));
    unequipBtn.on('pointerout', () => unequipBtn.setColor('#E07030'));
    unequipBtn.on('pointerdown', () => {
      this.gameState.equipped.equippedShield = null;
      this.rebuild();
    });
    c.add(unequipBtn);
    y += 12;

    return y;
  }

  /** Render bottom stats summary. Returns new y. */
  private buildStatsSummary(c: Phaser.GameObjects.Container, _w: number, y: number): number {
    c.add(this.scene.add.text(0, y, 'STATS:', {
      fontFamily: FONT, fontSize: '8px', color: '#6B6B6B',
    }));
    y += 12;

    // Total damage reduction from equipped armor
    const equippedArmorId = this.gameState.equipped.equippedArmor ?? null;
    const armorInv: ArmorInstance[] = this.gameState.inventory.armorInventory ?? [];
    const armorInst = equippedArmorId
      ? armorInv.find(a => a.id === equippedArmorId) ?? null
      : null;
    const armorReduction = armorInst ? (getArmorData(armorInst.armorId)?.reduction ?? 0) : 0;
    const armorSpeed = armorInst ? (getArmorData(armorInst.armorId)?.speedPenalty ?? 0) : 0;

    // Speed penalty from equipped shield
    const equippedShieldId = this.gameState.equipped.equippedShield ?? null;
    const shieldInv: ShieldInstance[] = this.gameState.inventory.shieldInventory ?? [];
    const shieldInst = equippedShieldId
      ? shieldInv.find(s => s.id === equippedShieldId) ?? null
      : null;
    const shieldSpeed = shieldInst ? (getShieldData(shieldInst.shieldId)?.speedPenalty ?? 0) : 0;

    const totalDmgReduce = Math.round(armorReduction * 100);
    const totalSpeedPenalty = Math.round((armorSpeed + shieldSpeed) * 100);

    c.add(this.scene.add.text(0, y, `Total DMG reduction: ${totalDmgReduce}%`, {
      fontFamily: FONT, fontSize: '7px', color: totalDmgReduce > 0 ? '#4CAF50' : '#555555',
    }));
    y += 12;

    c.add(this.scene.add.text(0, y, `Speed penalty: ${totalSpeedPenalty}%`, {
      fontFamily: FONT, fontSize: '7px',
      color: totalSpeedPenalty < 0 ? '#F44336' : '#555555',
    }));
    y += 12;

    c.add(this.scene.add.text(0, y, `AMMO: ${this.gameState.inventory.resources.ammo}`, {
      fontFamily: FONT, fontSize: '7px', color: '#4A90D9',
    }));
    y += 12;

    return y;
  }

  // ---------------------------------------------------------------------------
  // Hover comparison tooltip
  // ---------------------------------------------------------------------------

  /**
   * Show a compact stat comparison overlay ABOVE the hovered inventory item (Bug 14).
   * Previously rendered below the row, overlapping the next row.
   * Now rendered above so it never covers adjacent list items.
   * Compares the hovered weapon against the currently equipped primary weapon.
   * Green = better stat, red = worse stat.
   */
  private showWeaponComparison(
    hovered: WeaponInstance,
    equipped: WeaponInstance | null,
    rowLocalY: number,
  ): void {
    this.tooltipContainer.removeAll(true);

    const hovStats = this.weaponManager.getWeaponStats(hovered);

    const lines: Array<{ text: string; color: string }> = [];

    if (!equipped) {
      lines.push({ text: `DMG: ${hovStats.damage}`, color: '#4CAF50' });
      lines.push({ text: `RNG: ${hovStats.range}`, color: '#4CAF50' });
      lines.push({ text: `DUR: ${hovered.durability}/${hovered.maxDurability}`, color: '#E8DCC8' });
    } else {
      const eqStats = this.weaponManager.getWeaponStats(equipped);
      const dmgDiff = hovStats.damage - eqStats.damage;
      const rngDiff = hovStats.range - eqStats.range;
      const durDiff = hovered.durability - equipped.durability;

      lines.push({
        text: `DMG: ${eqStats.damage} -> ${hovStats.damage} (${dmgDiff >= 0 ? '+' : ''}${dmgDiff})`,
        color: dmgDiff > 0 ? '#4CAF50' : dmgDiff < 0 ? '#F44336' : '#E8DCC8',
      });
      lines.push({
        text: `RNG: ${eqStats.range} -> ${hovStats.range} (${rngDiff >= 0 ? '+' : ''}${rngDiff})`,
        color: rngDiff > 0 ? '#4CAF50' : rngDiff < 0 ? '#F44336' : '#E8DCC8',
      });
      lines.push({
        text: `DUR: ${equipped.durability} -> ${hovered.durability} (${durDiff >= 0 ? '+' : ''}${durDiff})`,
        color: durDiff > 0 ? '#4CAF50' : durDiff < 0 ? '#F44336' : '#E8DCC8',
      });
    }

    const ttH = lines.length * 12 + 8;
    const ttW = 200;

    // Bug 14: Position tooltip ABOVE the hovered row (not below) to avoid overlapping next row.
    // rowLocalY is the row's y within leftContent. Convert to panel-relative coords, then
    // shift upward by ttH so the tooltip box ends exactly at the row's top edge.
    const tx = CONTENT_PAD;
    const rowPanelY = HEADER_H + CONTENT_PAD + rowLocalY;
    // Clamp so tooltip never goes above panel header
    const ty = Math.max(HEADER_H + 4, rowPanelY - ttH);

    const ttBg = this.scene.add.graphics();
    ttBg.fillStyle(0x000000, 0.9);
    ttBg.fillRect(tx, ty, ttW, ttH);
    ttBg.lineStyle(1, 0x555555, 1);
    ttBg.strokeRect(tx, ty, ttW, ttH);
    this.tooltipContainer.add(ttBg);

    lines.forEach((line, idx) => {
      const txt = this.scene.add.text(tx + 4, ty + 4 + idx * 12, line.text, {
        fontFamily: FONT, fontSize: '7px', color: line.color,
      });
      this.tooltipContainer.add(txt);
    });
  }

  private hideTooltip(): void {
    this.tooltipContainer.removeAll(true);
  }

  /**
   * Fix 4: Show armor comparison tooltip ABOVE the hovered row.
   * Compares hovered armor vs currently equipped armor.
   * Green = better, red = worse.
   */
  private showArmorComparison(
    hovered: ArmorData | null,
    equipped: ArmorData | null,
    rowLocalY: number,
  ): void {
    this.tooltipContainer.removeAll(true);

    const lines: Array<{ text: string; color: string }> = [];

    if (!hovered) return;

    const hovReduction = Math.round(hovered.reduction * 100);
    const hovSpeed = Math.round((hovered.speedPenalty ?? 0) * 100);

    if (!equipped) {
      lines.push({ text: `Reduction: ${hovReduction}%`, color: '#4CAF50' });
      lines.push({ text: `Speed: ${hovSpeed}%`, color: hovSpeed < 0 ? '#F44336' : '#E8DCC8' });
    } else {
      const eqReduction = Math.round(equipped.reduction * 100);
      const eqSpeed = Math.round((equipped.speedPenalty ?? 0) * 100);
      const rdDiff = hovReduction - eqReduction;
      const spDiff = hovSpeed - eqSpeed;

      lines.push({
        text: `Reduction: ${eqReduction}% -> ${hovReduction}% (${rdDiff >= 0 ? '+' : ''}${rdDiff}%)`,
        color: rdDiff > 0 ? '#4CAF50' : rdDiff < 0 ? '#F44336' : '#E8DCC8',
      });
      lines.push({
        text: `Speed: ${eqSpeed}% -> ${hovSpeed}% (${spDiff >= 0 ? '+' : ''}${spDiff}%)`,
        // More negative speed penalty is WORSE
        color: spDiff < 0 ? '#F44336' : spDiff > 0 ? '#4CAF50' : '#E8DCC8',
      });
    }

    this.renderTooltipLines(lines, rowLocalY);
  }

  /**
   * Fix 4: Show shield comparison tooltip ABOVE the hovered row.
   * Compares hovered shield vs currently equipped shield.
   */
  private showShieldComparison(
    hovered: ShieldData | null,
    equipped: ShieldData | null,
    rowLocalY: number,
  ): void {
    this.tooltipContainer.removeAll(true);

    if (!hovered) return;

    const lines: Array<{ text: string; color: string }> = [];

    const hovBlocks = hovered.blockHits;
    const hovCooldown = Math.round(hovered.cooldownMs / 100) / 10;
    const hovSpeed = Math.round((hovered.speedPenalty ?? 0) * 100);

    if (!equipped) {
      lines.push({ text: `Block hits: ${hovBlocks}`, color: '#4CAF50' });
      lines.push({ text: `Cooldown: ${hovCooldown}s`, color: '#E8DCC8' });
      lines.push({ text: `Speed: ${hovSpeed}%`, color: hovSpeed < 0 ? '#F44336' : '#E8DCC8' });
    } else {
      const eqBlocks = equipped.blockHits;
      const eqCooldown = Math.round(equipped.cooldownMs / 100) / 10;
      const eqSpeed = Math.round((equipped.speedPenalty ?? 0) * 100);
      const blkDiff = hovBlocks - eqBlocks;
      const cdDiff = hovCooldown - eqCooldown;
      const spDiff = hovSpeed - eqSpeed;

      lines.push({
        text: `Block hits: ${eqBlocks} -> ${hovBlocks} (${blkDiff >= 0 ? '+' : ''}${blkDiff})`,
        color: blkDiff > 0 ? '#4CAF50' : blkDiff < 0 ? '#F44336' : '#E8DCC8',
      });
      lines.push({
        text: `Cooldown: ${eqCooldown}s -> ${hovCooldown}s (${cdDiff >= 0 ? '+' : ''}${cdDiff}s)`,
        // Lower cooldown is BETTER
        color: cdDiff < 0 ? '#4CAF50' : cdDiff > 0 ? '#F44336' : '#E8DCC8',
      });
      lines.push({
        text: `Speed: ${eqSpeed}% -> ${hovSpeed}% (${spDiff >= 0 ? '+' : ''}${spDiff}%)`,
        color: spDiff < 0 ? '#F44336' : spDiff > 0 ? '#4CAF50' : '#E8DCC8',
      });
    }

    this.renderTooltipLines(lines, rowLocalY);
  }

  /** Shared helper: render tooltip lines above a row (Fix 4 shared logic). */
  private renderTooltipLines(
    lines: Array<{ text: string; color: string }>,
    rowLocalY: number,
  ): void {
    const ttH = lines.length * 12 + 8;
    const ttW = 230;
    const tx = CONTENT_PAD;
    const rowPanelY = HEADER_H + CONTENT_PAD + rowLocalY;
    const ty = Math.max(HEADER_H + 4, rowPanelY - ttH);

    const ttBg = this.scene.add.graphics();
    ttBg.fillStyle(0x000000, 0.9);
    ttBg.fillRect(tx, ty, ttW, ttH);
    ttBg.lineStyle(1, 0x555555, 1);
    ttBg.strokeRect(tx, ty, ttW, ttH);
    this.tooltipContainer.add(ttBg);

    lines.forEach((line, idx) => {
      const txt = this.scene.add.text(tx + 4, ty + 4 + idx * 12, line.text, {
        fontFamily: FONT, fontSize: '7px', color: line.color,
      });
      this.tooltipContainer.add(txt);
    });
  }

  // ---------------------------------------------------------------------------
  // Upgrade view (full-width, replaces dual panel for the selected weapon)
  // ---------------------------------------------------------------------------

  private buildUpgradeView(weaponId: string): void {
    this.leftContent.removeAll(true);
    this.rightContent.removeAll(true);

    const weapon = this.gameState.inventory.weapons.find(ww => ww.id === weaponId);
    if (!weapon) {
      this.viewState = { mode: 'default' };
      this.buildDefaultView();
      return;
    }

    // Use leftContent as full-width area; adjust right origin so content spans full width
    const c = this.leftContent;
    // Content width spans from left panel to right edge of the whole panel
    const contentWidth = PANEL_W - CONTENT_PAD * 2;
    const available = this.weaponManager.getAvailableUpgradesForWeapon(weapon);
    const weaponName = WeaponManager.getWeaponData(weapon.weaponId)?.name ?? weapon.weaponId;

    let y = 0;

    c.add(this.scene.add.text(0, y, `Upgrade: ${weaponName}`, {
      fontFamily: FONT, fontSize: '10px', color: '#FFD700',
    }));
    y += 16;

    const slotsUsed = weapon.upgrades.length;
    const slotsTotal = WeaponManager.getMaxUpgradesPerWeapon();
    c.add(this.scene.add.text(0, y, `Slots: ${slotsUsed}/${slotsTotal}  PARTS: ${this.gameState.inventory.resources.parts}`, {
      fontFamily: FONT, fontSize: '8px', color: '#6B6B6B',
    }));
    y += 18;

    const entrySpacing = 58;

    available.forEach((def: UpgradeDefinition, i: number) => {
      const entryY = y + i * entrySpacing;
      const currentLevel = this.weaponManager.getUpgradeLevel(weapon, def.id as WeaponUpgradeType);
      const nextLevel = currentLevel + 1;
      const cost = def.costs[currentLevel] ?? 0;
      const canAfford = this.gameState.inventory.resources.parts >= cost;
      const isMaxed = currentLevel >= def.maxLevel;

      const baseColor = canAfford ? '#E8DCC8' : '#6B6B6B';

      const bg = this.scene.add.graphics();
      bg.fillStyle(0x333333, 0);
      bg.fillRect(-4, entryY - 2, contentWidth + 8, entrySpacing - 4);
      c.add(bg);

      const levelTag = isMaxed
        ? `${def.name} MAX`
        : currentLevel === 0
          ? `${def.name} NEW`
          : `${def.name} [${levelLabel(currentLevel, def.maxLevel)}]`;

      const nameEntry = this.scene.add.text(0, entryY, levelTag, {
        fontFamily: FONT, fontSize: '9px', color: isMaxed ? '#6B6B6B' : baseColor,
      });
      c.add(nameEntry);

      if (!isMaxed) {
        const nextDesc = resolveDescription(def, nextLevel);
        c.add(this.scene.add.text(0, entryY + 13, `-- ${nextDesc}`, {
          fontFamily: FONT, fontSize: '8px', color: '#AAB8C2',
        }));

        c.add(this.scene.add.text(contentWidth, entryY, `${cost} parts`, {
          fontFamily: FONT, fontSize: '8px', color: baseColor,
        }).setOrigin(1, 0));

        if (canAfford) {
          bg.setInteractive(
            new Phaser.Geom.Rectangle(-4, entryY - 2, contentWidth + 8, entrySpacing - 4),
            Phaser.Geom.Rectangle.Contains,
          );
          if (bg.input) bg.input.cursor = 'pointer';
          bg.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0x444444, 0.5);
            bg.fillRect(-4, entryY - 2, contentWidth + 8, entrySpacing - 4);
            nameEntry.setColor('#FFD700');
          });
          bg.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0x333333, 0);
            bg.fillRect(-4, entryY - 2, contentWidth + 8, entrySpacing - 4);
            nameEntry.setColor('#E8DCC8');
          });
          bg.on('pointerdown', () => {
            this.weaponManager.upgradeNew(weapon.id, def.id as WeaponUpgradeType);
            this.onResourceChange();
            this.buildUpgradeView(weaponId);
          });
        }
      }
    });

    // Ultimate unlock section (only shown when weapon is level 4)
    const weaponData = WeaponManager.getWeaponData(weapon.weaponId);
    const ultimateData: WeaponUltimate | undefined = weaponData?.ultimate;
    const ultimateBaseY = y + available.length * entrySpacing + 4;
    let ultimateRowHeight = 0;

    if (ultimateData && weapon.level === 4) {
      const { parts, scrap } = ultimateData.cost;
      const canAffordParts = this.gameState.inventory.resources.parts >= parts;
      const canAffordScrap = this.gameState.inventory.resources.scrap >= scrap;
      const canAfford = canAffordParts && canAffordScrap;

      const divider = this.scene.add.graphics();
      divider.lineStyle(1, 0xFFD700, 0.4);
      divider.lineBetween(0, ultimateBaseY + 2, contentWidth, ultimateBaseY + 2);
      c.add(divider);

      const ultiLabel = this.scene.add.text(0, ultimateBaseY + 8, `ULTIMATE: ${ultimateData.name}`, {
        fontFamily: FONT, fontSize: '9px', color: '#FFD700',
      });
      c.add(ultiLabel);

      c.add(this.scene.add.text(0, ultimateBaseY + 22, ultimateData.description, {
        fontFamily: FONT, fontSize: '7px', color: '#AAB8C2',
        wordWrap: { width: contentWidth - 60 },
      }));

      const costColor = canAfford ? '#FFD700' : '#6B6B6B';
      c.add(this.scene.add.text(contentWidth, ultimateBaseY + 8, `${parts}P + ${scrap}S`, {
        fontFamily: FONT, fontSize: '8px', color: costColor,
      }).setOrigin(1, 0));

      const ultiRowH = 50;
      ultimateRowHeight = ultiRowH + 8;
      const ultiBg = this.scene.add.graphics();
      ultiBg.fillStyle(0x1A1A00, 0);
      ultiBg.fillRect(-4, ultimateBaseY + 2, contentWidth + 8, ultiRowH);
      c.add(ultiBg);

      if (canAfford) {
        ultiBg.setInteractive(
          new Phaser.Geom.Rectangle(-4, ultimateBaseY + 2, contentWidth + 8, ultiRowH),
          Phaser.Geom.Rectangle.Contains,
        );
        if (ultiBg.input) ultiBg.input.cursor = 'pointer';
        ultiBg.on('pointerover', () => {
          ultiBg.clear();
          ultiBg.fillStyle(0x333300, 0.6);
          ultiBg.fillRect(-4, ultimateBaseY + 2, contentWidth + 8, ultiRowH);
          ultiLabel.setColor('#FFFF00');
        });
        ultiBg.on('pointerout', () => {
          ultiBg.clear();
          ultiBg.fillStyle(0x1A1A00, 0);
          ultiBg.fillRect(-4, ultimateBaseY + 2, contentWidth + 8, ultiRowH);
          ultiLabel.setColor('#FFD700');
        });
        ultiBg.on('pointerdown', () => {
          this.weaponManager.unlockUltimate(weapon.id);
          this.onResourceChange();
          this.buildUpgradeView(weaponId);
        });
      }
    } else if (ultimateData && weapon.level >= 5) {
      const divider = this.scene.add.graphics();
      divider.lineStyle(1, 0xFFD700, 0.4);
      divider.lineBetween(0, ultimateBaseY + 2, contentWidth, ultimateBaseY + 2);
      c.add(divider);

      c.add(this.scene.add.text(0, ultimateBaseY + 8, `ULTIMATE ACTIVE: ${ultimateData.name}`, {
        fontFamily: FONT, fontSize: '9px', color: '#FFD700',
      }));
      ultimateRowHeight = 24;
    }

    const backY = ultimateBaseY + ultimateRowHeight + 8;
    const backBtn = this.scene.add.text(0, backY, '[ BACK ]', {
      fontFamily: FONT, fontSize: '9px', color: '#D4620B',
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#FFD700'));
    backBtn.on('pointerout', () => backBtn.setColor('#D4620B'));
    backBtn.on('pointerdown', () => {
      this.viewState = { mode: 'default' };
      this.rebuild();
    });
    c.add(backBtn);
  }

  // ---------------------------------------------------------------------------
  // Static auto-equip helper (called from NightScene / SaveManager)
  // ---------------------------------------------------------------------------

  /**
   * If both equipped slots are null or point to non-existent weapons,
   * auto-populate them with the top-2 weapons by damage.
   * Returns true if any slot was changed.
   */
  static autoEquipIfNeeded(gameState: GameState, manager: WeaponManager): boolean {
    const weapons = gameState.inventory.weapons;
    if (weapons.length === 0) return false;

    const ids = new Set(weapons.map(ww => ww.id));
    const { primaryWeaponId, secondaryWeaponId } = gameState.equipped;

    const primaryOk = primaryWeaponId !== null && ids.has(primaryWeaponId);
    const secondaryOk = secondaryWeaponId !== null && ids.has(secondaryWeaponId);

    if (primaryOk && secondaryOk) return false;
    if (primaryOk && weapons.length <= 1) return false;

    const sorted = [...weapons].sort((a, b) => {
      const da = manager.getWeaponStats(a).damage;
      const db = manager.getWeaponStats(b).damage;
      return db - da;
    });

    let changed = false;

    if (!primaryOk) {
      const pick = sorted.find(ww => ww.id !== gameState.equipped.secondaryWeaponId) ?? sorted[0];
      if (pick) {
        gameState.equipped.primaryWeaponId = pick.id;
        changed = true;
      }
    }

    if (!secondaryOk && sorted.length >= 2) {
      const pick = sorted.find(ww => ww.id !== gameState.equipped.primaryWeaponId);
      if (pick) {
        gameState.equipped.secondaryWeaponId = pick.id;
        changed = true;
      }
    }

    return changed;
  }
}
