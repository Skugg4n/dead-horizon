// EquipmentPanel -- lets the player choose which 2 weapons to carry into the night.
// PRIMARY slot = key 1 in NightScene, SECONDARY slot = key 2.
// Open with Q in DayScene toolbar.

import Phaser from 'phaser';
import { UIPanel } from './UIPanel';
import { WeaponManager } from '../systems/WeaponManager';
import type { GameState, WeaponInstance } from '../config/types';

const PANEL_WIDTH = 360;

// Rarity color mapping -- matches WeaponPanel style
const RARITY_COLORS: Record<string, string> = {
  common: '#E8DCC8',
  uncommon: '#4CAF50',
  rare: '#4A90D9',
  legendary: '#FFD700',
};

/**
 * Build a compact one-line summary for a weapon slot row.
 * Example: "Rusty Knife [common] DMG:15"
 */
function weaponSummary(weapon: WeaponInstance, manager: WeaponManager): string {
  const stats = manager.getWeaponStats(weapon);
  const data = WeaponManager.getWeaponData(weapon.weaponId);
  const name = data?.name ?? weapon.weaponId;
  return `${name} [${weapon.rarity}] DMG:${stats.damage}`;
}

type Slot = 'primary' | 'secondary';

/** Internal view state: either the default two-slot view or the picker for one slot. */
type ViewState =
  | { mode: 'default' }
  | { mode: 'picker'; slot: Slot };

export class EquipmentPanel {
  private scene: Phaser.Scene;
  private weaponManager: WeaponManager;
  private gameState: GameState;
  private panel: UIPanel;
  private viewState: ViewState = { mode: 'default' };

  constructor(scene: Phaser.Scene, weaponManager: WeaponManager, gameState: GameState) {
    this.scene = scene;
    this.weaponManager = weaponManager;
    this.gameState = gameState;

    this.panel = new UIPanel(scene, 'EQUIPMENT', PANEL_WIDTH, 420);
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
      if (this.viewState.mode === 'picker') {
        // Back to default view on Escape inside picker
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
  // Internal rebuild -- renders either the two-slot overview or the weapon picker
  // ---------------------------------------------------------------------------

  private rebuild(): void {
    if (this.viewState.mode === 'default') {
      this.buildDefaultView();
    } else {
      this.buildPickerView(this.viewState.slot);
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

    // ---- PRIMARY slot ----
    y = this.renderSlotRow(content, 'PRIMARY', primaryWeapon, 'primary', y);
    y += 16;

    // ---- SECONDARY slot ----
    y = this.renderSlotRow(content, 'SECONDARY', secondaryWeapon, 'secondary', y);
    y += 20;

    // ---- Divider ----
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, 0x444444, 1);
    divider.lineBetween(0, y, PANEL_WIDTH - 24, y);
    content.add(divider);
    y += 8;

    // ---- Storage list (weapons not equipped) ----
    const storageWeapons = weapons.filter(
      w => w.id !== primaryWeaponId && w.id !== secondaryWeaponId
    );

    const storageHeader = this.scene.add.text(
      0, y,
      `STORAGE: (${storageWeapons.length} weapon${storageWeapons.length !== 1 ? 's' : ''})`,
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
        color: '#6B6B6B',
      });
      content.add(emptyText);
    } else {
      for (const w of storageWeapons) {
        const data = WeaponManager.getWeaponData(w.weaponId);
        const name = data?.name ?? w.weaponId;
        const color = RARITY_COLORS[w.rarity] ?? '#E8DCC8';
        const entry = this.scene.add.text(0, y, `  - ${name} [${w.rarity}]`, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '8px',
          color,
        });
        content.add(entry);
        y += 14;
      }
    }
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
    const boxH = 26;
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

      const nameText = this.scene.add.text(4, y + 4, `${name} [${weapon.rarity}]`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color,
      });
      content.add(nameText);

      const dmgText = this.scene.add.text(4, y + 16, `DMG:${stats.damage}  RNG:${stats.range}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#8A8A8A',
      });
      content.add(dmgText);
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

    const btnLabel = this.scene.add.text(btnX + 14, y + 13, '[>]', {
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
      this.rebuild();
    });

    return y + boxH;
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

    // Header
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

    // Option to clear the slot (set to null)
    y = this.renderPickerEntry(content, null, slot, otherSlotId, y);
    y += 4;

    // All weapons
    for (const w of weapons) {
      y = this.renderPickerEntry(content, w, slot, otherSlotId, y);
    }

    y += 8;

    // Back button
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

  /**
   * Render one entry in the picker list.
   * weapon=null means "clear slot".
   * otherSlotId: the weapon id currently equipped in the other slot (shown grayed).
   * Returns new y.
   */
  private renderPickerEntry(
    content: Phaser.GameObjects.Container,
    weapon: WeaponInstance | null,
    targetSlot: Slot,
    otherSlotId: string | null,
    y: number,
  ): number {
    const contentWidth = PANEL_WIDTH - 24;
    const rowH = 28;

    // Gray out if this weapon is already equipped in the OTHER slot
    const isBlockedByOther = weapon !== null && weapon.id === otherSlotId;

    // Determine current text
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
      rowText = `  ${weaponSummary(weapon, this.weaponManager)}`;
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

    // Only interactive if not blocked
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
  // Equip logic
  // ---------------------------------------------------------------------------

  /**
   * Assign a weapon instance id (or null) to the given slot in gameState.equipped.
   * The change is persisted when DayScene saves at end of day.
   */
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
   *
   * This ensures backward-compatible saves (which have no equipped field)
   * still work on the first night.
   */
  static autoEquipIfNeeded(gameState: GameState, manager: WeaponManager): boolean {
    const weapons = gameState.inventory.weapons;
    if (weapons.length === 0) return false;

    const ids = new Set(weapons.map(w => w.id));
    const { primaryWeaponId, secondaryWeaponId } = gameState.equipped;

    // Check if current equipped ids are still valid
    const primaryOk = primaryWeaponId !== null && ids.has(primaryWeaponId);
    const secondaryOk = secondaryWeaponId !== null && ids.has(secondaryWeaponId);

    if (primaryOk && secondaryOk) return false; // both already set
    if (primaryOk && weapons.length <= 1) return false; // only one weapon and it is equipped

    // Sort weapons by effective damage descending
    const sorted = [...weapons].sort((a, b) => {
      const da = manager.getWeaponStats(a).damage;
      const db = manager.getWeaponStats(b).damage;
      return db - da;
    });

    let changed = false;

    if (!primaryOk) {
      // Pick the best weapon not already in secondary
      const pick = sorted.find(w => w.id !== gameState.equipped.secondaryWeaponId) ?? sorted[0];
      if (pick) {
        gameState.equipped.primaryWeaponId = pick.id;
        changed = true;
      }
    }

    if (!secondaryOk && sorted.length >= 2) {
      // Pick the best weapon not in primary
      const pick = sorted.find(w => w.id !== gameState.equipped.primaryWeaponId);
      if (pick) {
        gameState.equipped.secondaryWeaponId = pick.id;
        changed = true;
      }
    }

    return changed;
  }
}
