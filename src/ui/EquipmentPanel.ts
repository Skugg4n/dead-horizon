// EquipmentPanel -- choose which 2 weapons to carry into the night, and manage all weapons.
// PRIMARY slot = key 1 in NightScene, SECONDARY slot = key 2.
// Open with Q in DayScene toolbar.
// Includes repair and upgrade functionality (replaces separate WeaponPanel).

import Phaser from 'phaser';
import { UIPanel } from './UIPanel';
import { WeaponManager } from '../systems/WeaponManager';
import { renderResourceCosts } from './resourceIcons';
import type { GameState, WeaponInstance, WeaponUpgradeType, UpgradeDefinition, WeaponUltimate } from '../config/types';

const PANEL_WIDTH = 360; // must match UIPanel max width

// Rarity color mapping
const RARITY_COLORS: Record<string, string> = {
  common: '#E8DCC8',
  uncommon: '#4CAF50',
  rare: '#4A90D9',
  legendary: '#FFD700',
};

// Build level label e.g. "Lv 2/3"
function levelLabel(current: number, max: number): string {
  return `Lv ${current}/${max}`;
}

// Resolve upgrade description template
function resolveDescription(def: UpgradeDefinition, level: number): string {
  const val = def.values[level - 1] ?? 0;
  return def.description
    .replace('{percent}', String(val))
    .replace('{value}', String(val));
}

type Slot = 'primary' | 'secondary';

/**
 * View state machine:
 *  - default: shows slots + storage list
 *  - picker: choose weapon for a slot
 *  - upgrade: inline upgrade options for a specific weapon
 */
type ViewState =
  | { mode: 'default' }
  | { mode: 'picker'; slot: Slot }
  | { mode: 'upgrade'; weaponId: string };

export class EquipmentPanel {
  private scene: Phaser.Scene;
  private weaponManager: WeaponManager;
  private gameState: GameState;
  private panel: UIPanel;
  private viewState: ViewState = { mode: 'default' };
  private storageScrollOffset: number = 0;
  private pickerPage: number = 0;
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

    this.panel = new UIPanel(scene, 'EQUIPMENT', PANEL_WIDTH, 480);
    this.rebuild();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.panel.getContainer();
  }

  getPanel(): UIPanel {
    return this.panel;
  }

  toggle(): void {
    this.panel.toggle();
    if (this.panel.isVisible()) {
      this.viewState = { mode: 'default' };
      this.rebuild();
    }
  }

  isVisible(): boolean {
    return this.panel.isVisible();
  }

  /** Handle keyboard input. Returns true if the key was consumed. */
  handleKey(key: string): boolean {
    if (!this.panel.isVisible()) return false;
    if (key === 'Escape') {
      if (this.viewState.mode !== 'default') {
        this.viewState = { mode: 'default' };
        this.rebuild();
      } else {
        this.panel.hide();
      }
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Internal rebuild -- renders current viewState
  // ---------------------------------------------------------------------------

  private rebuild(): void {
    this.panel.resetScroll();
    switch (this.viewState.mode) {
      case 'default':
        this.buildDefaultView();
        break;
      case 'picker':
        this.buildPickerView(this.viewState.slot);
        break;
      case 'upgrade':
        this.buildUpgradeView(this.viewState.weaponId);
        break;
    }
  }

  private buildDefaultView(): void {
    const content = this.panel.getContentContainer();
    content.removeAll(true);

    const weapons = this.gameState.inventory.weapons;
    const { primaryWeaponId, secondaryWeaponId } = this.gameState.equipped;

    const primaryWeapon = primaryWeaponId
      ? weapons.find(w => w.id === primaryWeaponId) ?? null
      : null;
    const secondaryWeapon = secondaryWeaponId
      ? weapons.find(w => w.id === secondaryWeaponId) ?? null
      : null;

    let y = 0;

    // ---- Character portrait ----
    const portraitKey = `portrait_${this.gameState.player.character}`;
    if (this.scene.textures.exists(portraitKey)) {
      const portrait = this.scene.add.image(PANEL_WIDTH / 2 - 12, 32, portraitKey);
      portrait.setDisplaySize(48, 48);
      content.add(portrait);
      const border = this.scene.add.graphics();
      border.lineStyle(2, 0xC5A030);
      border.strokeRect(PANEL_WIDTH / 2 - 12 - 24, 32 - 24, 48, 48);
      content.add(border);
      const charName = this.gameState.player.character.charAt(0).toUpperCase()
        + this.gameState.player.character.slice(1);
      const nameText = this.scene.add.text(PANEL_WIDTH / 2 - 12, 62, charName, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#C5A030',
      }).setOrigin(0.5, 0);
      content.add(nameText);
      y = 82;
    }

    // ---- PRIMARY slot ----
    y = this.renderSlotRow(content, 'PRIMARY [1]', primaryWeapon, 'primary', y);
    y += 12;

    // ---- SECONDARY slot ----
    y = this.renderSlotRow(content, 'SECONDARY [2]', secondaryWeapon, 'secondary', y);
    y += 16;

    // ---- Divider ----
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, 0x444444, 1);
    divider.lineBetween(0, y, PANEL_WIDTH - 24, y);
    content.add(divider);
    y += 10;

    // ---- Storage list (weapons not equipped) ----
    const storageWeapons = weapons.filter(
      w => w.id !== primaryWeaponId && w.id !== secondaryWeaponId
    );

    const storageHeader = this.scene.add.text(
      0, y,
      `STORAGE (${storageWeapons.length} weapon${storageWeapons.length !== 1 ? 's' : ''})`,
      {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#6B6B6B',
      }
    );
    content.add(storageHeader);
    y += 16;

    if (storageWeapons.length === 0) {
      const emptyText = this.scene.add.text(0, y, '  (all weapons equipped)', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#555555',
      });
      content.add(emptyText);
    } else {
      // Paginate: show max 3 storage weapons at a time
      const MAX_STORAGE_VISIBLE = 3;
      const total = storageWeapons.length;
      const endIdx = Math.min(this.storageScrollOffset + MAX_STORAGE_VISIBLE, total);

      if (this.storageScrollOffset > 0) {
        const upBtn = this.scene.add.text(0, y, '[ ^ UP ]', {
          fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color: '#FFD700',
        }).setInteractive({ useHandCursor: true });
        upBtn.on('pointerdown', () => { this.storageScrollOffset = Math.max(0, this.storageScrollOffset - 1); this.rebuild(); });
        content.add(upBtn);
        y += 12;
      }

      for (let i = this.storageScrollOffset; i < endIdx; i++) {
        const weapon = storageWeapons[i];
        if (weapon) y = this.renderStorageEntry(content, weapon, y);
      }

      if (endIdx < total) {
        const downBtn = this.scene.add.text(0, y, `[ v ${total - endIdx} MORE ]`, {
          fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color: '#FFD700',
        }).setInteractive({ useHandCursor: true });
        downBtn.on('pointerdown', () => { this.storageScrollOffset = Math.min(total - MAX_STORAGE_VISIBLE, this.storageScrollOffset + 1); this.rebuild(); });
        content.add(downBtn);
        y += 12;
      }
    }

    // ---- Stats footer ----
    y += 8;
    const ammoInfo = this.scene.add.text(0, y, `AMMO: ${this.gameState.inventory.resources.ammo}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#4A90D9',
      wordWrap: { width: PANEL_WIDTH - 24 },
    });
    content.add(ammoInfo);
  }

  /**
   * Render one slot row (PRIMARY or SECONDARY).
   * Returns the new y after the row.
   */
  private renderSlotRow(
    content: Phaser.GameObjects.Container,
    label: string,
    weapon: WeaponInstance | null,
    slot: Slot,
    y: number,
  ): number {
    const contentWidth = PANEL_WIDTH - 24;

    // Slot label
    const labelText = this.scene.add.text(0, y, `${label}:`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#6B6B6B',
    });
    content.add(labelText);
    y += 14;

    // Weapon info box
    const boxH = weapon ? 44 : 26;
    const boxW = contentWidth - 32; // leave room for [>] button

    const boxBg = this.scene.add.graphics();
    boxBg.fillStyle(0x2A2A2A, 1);
    boxBg.fillRect(0, y, boxW, boxH);
    boxBg.lineStyle(1, 0x444444, 1);
    boxBg.strokeRect(0, y, boxW, boxH);
    content.add(boxBg);

    if (weapon) {
      const stats = this.weaponManager.getWeaponStats(weapon);
      const data = WeaponManager.getWeaponData(weapon.weaponId);
      const name = data?.name ?? weapon.weaponId;
      const color = RARITY_COLORS[weapon.rarity] ?? '#E8DCC8';
      const isBroken = this.weaponManager.isBroken(weapon);

      const nameText = this.scene.add.text(4, y + 3, `${name} [${weapon.rarity}]`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: isBroken ? '#F44336' : color,
      });
      content.add(nameText);

      const dmgText = this.scene.add.text(4, y + 15, `DMG:${stats.damage} RNG:${stats.range} DUR:${weapon.durability}/${weapon.maxDurability}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: isBroken ? '#F44336' : '#8A8A8A',
      });
      content.add(dmgText);

      // Repair button (if damaged)
      if (weapon.durability < weapon.maxDurability) {
        const canRepair = this.currentAP() >= 1 && this.gameState.inventory.resources.parts >= 1;
        const repairColor = canRepair ? '#4CAF50' : '#555555';
        const repairBtn = this.scene.add.text(4, y + 28, '[REPAIR]', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '7px',
          color: repairColor,
        });
        content.add(repairBtn);
        if (canRepair) {
          repairBtn.setInteractive({ useHandCursor: true });
          repairBtn.on('pointerover', () => repairBtn.setColor('#FFD700'));
          repairBtn.on('pointerout', () => repairBtn.setColor('#4CAF50'));
          repairBtn.on('pointerdown', () => {
            if (this.weaponManager.repair(weapon.id)) {
              this.spendAP(1);
              this.onResourceChange();
              this.rebuild();
            }
          });
        }
        // Cost hint
        renderResourceCosts(this.scene, content, { parts: 1 }, 68, y + 28, repairColor);
      }

      // Upgrade button
      const availableUpgrades = this.weaponManager.getAvailableUpgradesForWeapon(weapon);
      if (availableUpgrades.length > 0) {
        const upgBtnX = weapon.durability < weapon.maxDurability ? 140 : 4;
        const upgBtnY = weapon.durability < weapon.maxDurability ? y + 28 : y + 28;
        const upgradeBtn = this.scene.add.text(upgBtnX, upgBtnY, '[UPGRADE]', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '7px',
          color: '#4A90D9',
        }).setInteractive({ useHandCursor: true });
        upgradeBtn.on('pointerover', () => upgradeBtn.setColor('#FFD700'));
        upgradeBtn.on('pointerout', () => upgradeBtn.setColor('#4A90D9'));
        upgradeBtn.on('pointerdown', () => {
          this.viewState = { mode: 'upgrade', weaponId: weapon.id };
          this.rebuild();
        });
        content.add(upgradeBtn);
      }
    } else {
      const emptyText = this.scene.add.text(4, y + 9, '(empty)', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#555555',
      });
      content.add(emptyText);
    }

    // [>] button to open weapon picker for this slot
    const btnX = contentWidth - 28;
    const btnBg = this.scene.add.graphics();
    btnBg.fillStyle(0x333333, 1);
    btnBg.fillRect(btnX, y, 28, boxH);
    btnBg.lineStyle(1, 0x4A90D9, 1);
    btnBg.strokeRect(btnX, y, 28, boxH);
    btnBg.setInteractive(
      new Phaser.Geom.Rectangle(btnX, y, 28, boxH),
      Phaser.Geom.Rectangle.Contains,
    );
    if (btnBg.input) btnBg.input.cursor = 'pointer';
    content.add(btnBg);

    const btnLabel = this.scene.add.text(btnX + 14, y + boxH / 2, '[>]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#4A90D9',
    }).setOrigin(0.5);
    content.add(btnLabel);

    btnBg.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0x4A90D9, 0.3);
      btnBg.fillRect(btnX, y, 28, boxH);
      btnBg.lineStyle(1, 0x4A90D9, 1);
      btnBg.strokeRect(btnX, y, 28, boxH);
      btnLabel.setColor('#FFD700');
    });
    btnBg.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0x333333, 1);
      btnBg.fillRect(btnX, y, 28, boxH);
      btnBg.lineStyle(1, 0x4A90D9, 1);
      btnBg.strokeRect(btnX, y, 28, boxH);
      btnLabel.setColor('#4A90D9');
    });
    btnBg.on('pointerdown', () => {
      this.viewState = { mode: 'picker', slot };
      this.pickerPage = 0;
      this.rebuild();
    });

    return y + boxH;
  }

  /**
   * Render one storage entry row with EQUIP and UPGRADE buttons.
   * Returns new y.
   */
  private renderStorageEntry(
    content: Phaser.GameObjects.Container,
    w: WeaponInstance,
    y: number,
  ): number {
    const contentWidth = PANEL_WIDTH - 24;

    const data = WeaponManager.getWeaponData(w.weaponId);
    const name = data?.name ?? w.weaponId;
    const color = RARITY_COLORS[w.rarity] ?? '#E8DCC8';
    const stats = this.weaponManager.getWeaponStats(w);
    const isBroken = this.weaponManager.isBroken(w);

    // Separator line
    const sep = this.scene.add.graphics();
    sep.lineStyle(1, 0x333333, 0.5);
    sep.lineBetween(0, y, contentWidth, y);
    content.add(sep);
    y += 3;

    // Name
    const nameText = this.scene.add.text(0, y, `${name} [${w.rarity}]`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: isBroken ? '#F44336' : color,
    });
    content.add(nameText);
    y += 14;

    // Stats on own line
    const statsText = this.scene.add.text(0, y, `DMG:${stats.damage} DUR:${w.durability}/${w.maxDurability}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#6B6B6B',
    });
    content.add(statsText);

    y += 12;

    // Action buttons on their own line, spaced horizontally
    let btnX = 0;
    const btnGap = 8;

    const makeBtn = (label: string, col: string, cb: () => void) => {
      const btn = this.scene.add.text(btnX, y, label, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: col,
      }).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setColor('#FFD700'));
      btn.on('pointerout', () => btn.setColor(col));
      btn.on('pointerdown', cb);
      content.add(btn);
      btnX += btn.width + btnGap;
    };

    // EQUIP (disabled with [BROKEN] label when weapon durability is zero)
    if (isBroken) {
      // Show a non-interactive broken indicator instead of the equip button
      const brokenLabel = this.scene.add.text(btnX, y, '[BROKEN]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#F44336',
      });
      content.add(brokenLabel);
      btnX += brokenLabel.width + btnGap;
    } else {
      makeBtn('[EQUIP]', '#E07030', () => {
        const { primaryWeaponId, secondaryWeaponId } = this.gameState.equipped;
        if (!primaryWeaponId) {
          this.gameState.equipped.primaryWeaponId = w.id;
        } else if (!secondaryWeaponId) {
          this.gameState.equipped.secondaryWeaponId = w.id;
        } else {
          this.gameState.equipped.primaryWeaponId = w.id;
        }
        this.rebuild();
      });
    }

    // REPAIR (if damaged)
    if (w.durability < w.maxDurability) {
      const canRepair = this.currentAP() >= 1 && this.gameState.inventory.resources.parts >= 1;
      if (canRepair) {
        makeBtn('[REPAIR]', '#4CAF50', () => {
          if (this.weaponManager.repair(w.id)) {
            this.spendAP(1);
            this.onResourceChange();
            this.rebuild();
          }
        });
      }
    }

    // UPGRADE
    const availUpgrades = this.weaponManager.getAvailableUpgradesForWeapon(w);
    if (availUpgrades.length > 0) {
      makeBtn('[UPGRADE]', '#4A90D9', () => {
        this.viewState = { mode: 'upgrade', weaponId: w.id };
        this.rebuild();
      });
    }

    // SCRAP button on the same line
    const scrapValues: Record<string, { scrap: number; parts: number }> = {
      common:    { scrap: 2, parts: 1 },
      uncommon:  { scrap: 3, parts: 2 },
      rare:      { scrap: 5, parts: 3 },
      legendary: { scrap: 8, parts: 5 },
    };
    const sv = scrapValues[w.rarity] ?? { scrap: 2, parts: 1 };
    makeBtn(`[SCRAP +${sv.scrap}S +${sv.parts}P]`, '#AA6633', () => {
      const idx = this.gameState.inventory.weapons.indexOf(w);
      if (idx >= 0) {
        this.gameState.inventory.weapons.splice(idx, 1);
        // Unequip if equipped
        if (this.gameState.equipped.primaryWeaponId === w.id) {
          this.gameState.equipped.primaryWeaponId = null;
        }
        if (this.gameState.equipped.secondaryWeaponId === w.id) {
          this.gameState.equipped.secondaryWeaponId = null;
        }
        // Add resources
        this.gameState.inventory.resources.scrap += sv.scrap;
        this.gameState.inventory.resources.parts += sv.parts;
        this.onResourceChange();
        this.rebuild();
      }
    });

    y += 12; // button row height
    return y + 4;
  }

  // ---------------------------------------------------------------------------
  // Picker view: shows all weapons, click one to equip it in the selected slot
  // ---------------------------------------------------------------------------

  private buildPickerView(slot: Slot): void {
    const content = this.panel.getContentContainer();
    content.removeAll(true);

    const { primaryWeaponId, secondaryWeaponId } = this.gameState.equipped;
    const otherSlotId = slot === 'primary' ? secondaryWeaponId : primaryWeaponId;
    const weapons = this.gameState.inventory.weapons;

    let y = 0;

    const header = this.scene.add.text(
      0, y,
      `Select ${slot.toUpperCase()} weapon:`,
      {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#FFD700',
      }
    );
    content.add(header);
    y += 18;

    // Option to clear the slot
    y = this.renderPickerEntry(content, null, slot, otherSlotId, y);
    y += 4;

    // Sort weapons: highest damage first, then by rarity
    const rarityOrder: Record<string, number> = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
    const sorted = [...weapons].sort((a, b) => {
      const aDmg = this.weaponManager.getWeaponStats(a).damage;
      const bDmg = this.weaponManager.getWeaponStats(b).damage;
      if (bDmg !== aDmg) return bDmg - aDmg;
      return (rarityOrder[a.rarity] ?? 4) - (rarityOrder[b.rarity] ?? 4);
    });

    // Paginate: show 8 weapons per page
    const PAGE_SIZE = 8;
    const totalWeapons = sorted.length;
    const totalPages = Math.ceil(totalWeapons / PAGE_SIZE);
    const currentPage = Math.min(this.pickerPage, totalPages - 1);
    const startIdx = currentPage * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, totalWeapons);

    // Page indicator
    if (totalPages > 1) {
      const pageText = this.scene.add.text(0, y, `Page ${currentPage + 1}/${totalPages}  (${totalWeapons} weapons)`, {
        fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color: '#6B6B6B',
      });
      content.add(pageText);
      y += 12;
    }

    // Previous page button
    if (currentPage > 0) {
      const prevBtn = this.scene.add.text(0, y, '[ << PREV PAGE ]', {
        fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#FFD700',
      }).setInteractive({ useHandCursor: true });
      prevBtn.on('pointerdown', () => { this.pickerPage = currentPage - 1; this.rebuild(); });
      content.add(prevBtn);
      y += 14;
    }

    for (let i = startIdx; i < endIdx; i++) {
      const w = sorted[i];
      if (w) y = this.renderPickerEntry(content, w, slot, otherSlotId, y);
    }

    // Next page button
    if (endIdx < totalWeapons) {
      const nextBtn = this.scene.add.text(0, y, `[ NEXT PAGE >> ] (${totalWeapons - endIdx} more)`, {
        fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#FFD700',
      }).setInteractive({ useHandCursor: true });
      nextBtn.on('pointerdown', () => { this.pickerPage = currentPage + 1; this.rebuild(); });
      content.add(nextBtn);
      y += 14;
    }

    // Scrap all common button (bulk cleanup)
    const commonCount = weapons.filter(w => w.rarity === 'common' && w.id !== this.gameState.equipped.primaryWeaponId && w.id !== this.gameState.equipped.secondaryWeaponId).length;
    if (commonCount > 2) {
      y += 4;
      const scrapAllBtn = this.scene.add.text(0, y, `[ SCRAP ALL COMMON (${commonCount}) +${commonCount * 2}S +${commonCount}P ]`, {
        fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color: '#AA4433',
      }).setInteractive({ useHandCursor: true });
      scrapAllBtn.on('pointerdown', () => {
        const toScrap = weapons.filter(w => w.rarity === 'common' && w.id !== this.gameState.equipped.primaryWeaponId && w.id !== this.gameState.equipped.secondaryWeaponId);
        for (const w of toScrap) {
          const idx = this.gameState.inventory.weapons.indexOf(w);
          if (idx >= 0) this.gameState.inventory.weapons.splice(idx, 1);
          this.gameState.inventory.resources.scrap += 2;
          this.gameState.inventory.resources.parts += 1;
        }
        this.onResourceChange();
        this.rebuild();
      });
      content.add(scrapAllBtn);
      y += 14;
    }

    y += 8;

    const backBtn = this.scene.add.text(0, y, '[ BACK ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#D4620B',
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#FFD700'));
    backBtn.on('pointerout', () => backBtn.setColor('#D4620B'));
    backBtn.on('pointerdown', () => {
      this.viewState = { mode: 'default' };
      this.rebuild();
    });
    content.add(backBtn);
  }

  private renderPickerEntry(
    content: Phaser.GameObjects.Container,
    weapon: WeaponInstance | null,
    targetSlot: Slot,
    otherSlotId: string | null,
    y: number,
  ): number {
    const contentWidth = PANEL_WIDTH - 24;
    const rowH = 28;

    const isBlockedByOther = weapon !== null && weapon.id === otherSlotId;

    let rowText: string;
    let rowColor: string;

    if (weapon === null) {
      rowText = '  (clear slot)';
      rowColor = '#6B6B6B';
    } else if (isBlockedByOther) {
      const data = WeaponManager.getWeaponData(weapon.weaponId);
      rowText = `  ${data?.name ?? weapon.weaponId} [${weapon.rarity}] -- IN OTHER SLOT`;
      rowColor = '#444444';
    } else {
      const stats = this.weaponManager.getWeaponStats(weapon);
      const data = WeaponManager.getWeaponData(weapon.weaponId);
      const name = data?.name ?? weapon.weaponId;
      const cls = stats.weaponClass === 'melee' ? 'M' : 'R';
      const dur = `${weapon.durability}/${weapon.maxDurability}`;
      const spec = stats.specialEffect ? ` ${stats.specialEffect.type}` : '';
      rowText = `  ${name} [${weapon.rarity[0]?.toUpperCase() ?? ''}] ${cls} D:${stats.damage} RNG:${stats.range} DUR:${dur}${spec}`;
      rowColor = RARITY_COLORS[weapon.rarity] ?? '#E8DCC8';
    }

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x2A2A2A, 0);
    bg.fillRect(0, y, contentWidth, rowH);
    content.add(bg);

    const txt = this.scene.add.text(0, y + 8, rowText, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: rowColor,
    });
    content.add(txt);

    if (!isBlockedByOther) {
      bg.setInteractive(
        new Phaser.Geom.Rectangle(0, y, contentWidth, rowH),
        Phaser.Geom.Rectangle.Contains,
      );
      if (bg.input) bg.input.cursor = 'pointer';

      bg.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(0x3A3A3A, 1);
        bg.fillRect(0, y, contentWidth, rowH);
        txt.setColor('#FFD700');
      });
      bg.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(0x2A2A2A, 0);
        bg.fillRect(0, y, contentWidth, rowH);
        txt.setColor(rowColor);
      });
      bg.on('pointerdown', () => {
        this.equipWeaponInSlot(targetSlot, weapon ? weapon.id : null);
        this.viewState = { mode: 'default' };
        this.rebuild();
      });
    }

    return y + rowH;
  }

  // ---------------------------------------------------------------------------
  // Upgrade view: inline upgrade options for a specific weapon
  // ---------------------------------------------------------------------------

  private buildUpgradeView(weaponId: string): void {
    const content = this.panel.getContentContainer();
    content.removeAll(true);

    const weapon = this.gameState.inventory.weapons.find(w => w.id === weaponId);
    if (!weapon) {
      this.viewState = { mode: 'default' };
      this.rebuild();
      return;
    }

    const contentWidth = PANEL_WIDTH - 24;
    const available = this.weaponManager.getAvailableUpgradesForWeapon(weapon);
    const weaponName = WeaponManager.getWeaponData(weapon.weaponId)?.name ?? weapon.weaponId;

    let y = 0;

    const title = this.scene.add.text(0, y, `Upgrade: ${weaponName}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#FFD700',
    });
    content.add(title);
    y += 16;

    const slotsUsed = weapon.upgrades.length;
    const slotsTotal = WeaponManager.getMaxUpgradesPerWeapon();
    const slotSummary = this.scene.add.text(0, y, `Slots: ${slotsUsed}/${slotsTotal}  PARTS: ${this.gameState.inventory.resources.parts}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#6B6B6B',
    });
    content.add(slotSummary);
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
      content.add(bg);

      const levelTag = isMaxed
        ? `${def.name} MAX`
        : currentLevel === 0
          ? `${def.name} NEW`
          : `${def.name} [${levelLabel(currentLevel, def.maxLevel)}]`;

      const nameEntry = this.scene.add.text(0, entryY, levelTag, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: isMaxed ? '#6B6B6B' : baseColor,
      });
      content.add(nameEntry);

      if (!isMaxed) {
        const nextDesc = resolveDescription(def, nextLevel);
        const descText = this.scene.add.text(0, entryY + 13, `-- ${nextDesc}`, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '8px',
          color: '#AAB8C2',
        });
        content.add(descText);

        const costLabel = `${cost} parts`;
        const costText = this.scene.add.text(contentWidth, entryY, costLabel, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '8px',
          color: baseColor,
        });
        costText.setOrigin(1, 0);
        content.add(costText);

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

    // --- Ultimate unlock section (only shown when weapon is level 4) ---
    const weaponData = WeaponManager.getWeaponData(weapon.weaponId);
    const ultimateData: WeaponUltimate | undefined = weaponData?.ultimate;
    const ultimateBaseY = y + available.length * entrySpacing + 4;
    let ultimateRowHeight = 0;

    if (ultimateData && weapon.level === 4) {
      // Show the ultimate upgrade option
      const { parts, scrap } = ultimateData.cost;
      const canAffordParts = this.gameState.inventory.resources.parts >= parts;
      const canAffordScrap = this.gameState.inventory.resources.scrap >= scrap;
      const canAfford = canAffordParts && canAffordScrap;

      const divider = this.scene.add.graphics();
      divider.lineStyle(1, 0xFFD700, 0.4);
      divider.lineBetween(0, ultimateBaseY + 2, contentWidth, ultimateBaseY + 2);
      content.add(divider);

      const ultiLabel = this.scene.add.text(0, ultimateBaseY + 8, `ULTIMATE: ${ultimateData.name}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#FFD700',
      });
      content.add(ultiLabel);

      const ultiDesc = this.scene.add.text(0, ultimateBaseY + 22, ultimateData.description, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#AAB8C2',
        wordWrap: { width: contentWidth - 60 },
      });
      content.add(ultiDesc);

      const costLabel = `${parts}P + ${scrap}S`;
      const costColor = canAfford ? '#FFD700' : '#6B6B6B';
      const ultiCostText = this.scene.add.text(contentWidth, ultimateBaseY + 8, costLabel, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: costColor,
      });
      ultiCostText.setOrigin(1, 0);
      content.add(ultiCostText);

      // Clickable upgrade button
      const ultiRowH = 50;
      ultimateRowHeight = ultiRowH + 8;
      const ultiBg = this.scene.add.graphics();
      ultiBg.fillStyle(0x1A1A00, 0);
      ultiBg.fillRect(-4, ultimateBaseY + 2, contentWidth + 8, ultiRowH);
      content.add(ultiBg);

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
      // Weapon already has ultimate unlocked -- show status
      const divider = this.scene.add.graphics();
      divider.lineStyle(1, 0xFFD700, 0.4);
      divider.lineBetween(0, ultimateBaseY + 2, contentWidth, ultimateBaseY + 2);
      content.add(divider);

      const ultiActiveLabel = this.scene.add.text(0, ultimateBaseY + 8, `ULTIMATE ACTIVE: ${ultimateData.name}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#FFD700',
      });
      content.add(ultiActiveLabel);
      ultimateRowHeight = 24;
    }

    const backY = ultimateBaseY + ultimateRowHeight + 8;
    const backBtn = this.scene.add.text(0, backY, '[ BACK ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#D4620B',
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setColor('#FFD700'));
    backBtn.on('pointerout', () => backBtn.setColor('#D4620B'));
    backBtn.on('pointerdown', () => {
      this.viewState = { mode: 'default' };
      this.rebuild();
    });
    content.add(backBtn);
  }

  // ---------------------------------------------------------------------------
  // Equip logic
  // ---------------------------------------------------------------------------

  private equipWeaponInSlot(slot: Slot, weaponId: string | null): void {
    if (slot === 'primary') {
      this.gameState.equipped.primaryWeaponId = weaponId;
    } else {
      this.gameState.equipped.secondaryWeaponId = weaponId;
    }
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

    const ids = new Set(weapons.map(w => w.id));
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
      const pick = sorted.find(w => w.id !== gameState.equipped.secondaryWeaponId) ?? sorted[0];
      if (pick) {
        gameState.equipped.primaryWeaponId = pick.id;
        changed = true;
      }
    }

    if (!secondaryOk && sorted.length >= 2) {
      const pick = sorted.find(w => w.id !== gameState.equipped.primaryWeaponId);
      if (pick) {
        gameState.equipped.secondaryWeaponId = pick.id;
        changed = true;
      }
    }

    return changed;
  }
}
