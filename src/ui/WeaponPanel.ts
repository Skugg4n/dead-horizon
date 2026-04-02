// DayScene UI panel showing equipped weapons with stats, repair, and upgrade options
import Phaser from 'phaser';
import { WeaponManager } from '../systems/WeaponManager';
import { UIPanel } from './UIPanel';
import { renderResourceCosts } from './resourceIcons';
import type { WeaponInstance, WeaponUpgradeType, UpgradeDefinition, GameState } from '../config/types';

const PANEL_WIDTH = 360;

// Build a clear level label, e.g. "Lv 2/3" -- replaces the old [*oo] star notation
function levelLabel(current: number, max: number): string {
  return `Lv ${current}/${max}`;
}

// Resolve the description template with the actual value at a given level
function resolveDescription(def: UpgradeDefinition, level: number): string {
  const val = def.values[level - 1] ?? 0;
  return def.description
    .replace('{percent}', String(val))
    .replace('{value}', String(val));
}

export class WeaponPanel {
  private scene: Phaser.Scene;
  private weaponManager: WeaponManager;
  private gameState: GameState;
  private panel: UIPanel;
  private currentAP: () => number;
  private spendAP: (cost: number) => void;
  private onResourceChange: () => void;

  constructor(
    scene: Phaser.Scene,
    weaponManager: WeaponManager,
    gameState: GameState,
    currentAP: () => number,
    spendAP: (cost: number) => void,
    onResourceChange: () => void,
  ) {
    this.scene = scene;
    this.weaponManager = weaponManager;
    this.gameState = gameState;
    this.currentAP = currentAP;
    this.spendAP = spendAP;
    this.onResourceChange = onResourceChange;

    this.panel = new UIPanel(scene, 'WEAPONS', 360, 400);

    this.rebuild();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.panel.getContainer();
  }

  toggle(): void {
    this.panel.toggle();
    if (this.panel.isVisible()) this.rebuild();
  }

  isVisible(): boolean {
    return this.panel.isVisible();
  }

  private rebuild(): void {
    const content = this.panel.getContentContainer();
    content.removeAll(true);

    const weapons = this.weaponManager.getWeapons();
    const equippedIdx = this.weaponManager.getEquippedIndex();

    if (weapons.length === 0) {
      const noWeapons = this.scene.add.text(0, 0, 'No weapons', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#6B6B6B',
      });
      content.add(noWeapons);
      return;
    }

    const weaponHeight = 80;
    weapons.forEach((weapon, i) => {
      const y = i * weaponHeight;
      this.renderWeaponEntry(content, weapon, y, i === equippedIdx);
    });
  }

  private renderWeaponEntry(
    content: Phaser.GameObjects.Container,
    weapon: WeaponInstance,
    y: number,
    isEquipped: boolean,
  ): void {
    const stats = this.weaponManager.getWeaponStats(weapon);
    const data = WeaponManager.getWeaponData(weapon.weaponId);
    if (!data) return;

    const contentWidth = PANEL_WIDTH - 24;
    const xpNeeded = this.weaponManager.getXPForNextLevel(weapon);
    const isBroken = this.weaponManager.isBroken(weapon);

    // Hover background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x333333, 0);
    bg.fillRect(-4, y - 2, contentWidth + 8, 76);
    content.add(bg);

    const nameColor = isBroken ? '#F44336' : (isEquipped ? '#FFD700' : '#E8DCC8');

    // Name + class + rarity (10px title)
    const nameText = this.scene.add.text(0, y, `${stats.name} [${weapon.rarity}]`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: nameColor,
    });
    content.add(nameText);

    // [EQUIPPED] badge shown next to the active weapon for clarity
    if (isEquipped) {
      const equippedBadge = this.scene.add.text(contentWidth, y, '[EQUIPPED]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#FFD700',
      }).setOrigin(1, 0);
      content.add(equippedBadge);
    }

    // Stats line (9px body)
    const brokenTag = isBroken ? ' BROKEN' : '';
    const statsLine = `DMG:${stats.damage} RNG:${stats.range} Dur:${weapon.durability}/${weapon.maxDurability}${brokenTag}`;
    const statsText = this.scene.add.text(0, y + 14, statsLine, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: isBroken ? '#F44336' : '#E8DCC8',
    });
    content.add(statsText);

    // Level + XP (8px label)
    const lvlLine = weapon.level >= 5
      ? `Lv${weapon.level} MAX`
      : `Lv${weapon.level} XP:${weapon.xp}/${xpNeeded}`;
    const lvlText = this.scene.add.text(0, y + 27, lvlLine, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#6B6B6B',
    });
    content.add(lvlText);

    // Installed upgrades with star-level indicators (8px label)
    if (weapon.upgrades.length > 0) {
      const slotsFree = WeaponManager.getMaxUpgradesPerWeapon() - weapon.upgrades.length;
      const upgradeStrs = weapon.upgrades.map(u => {
        const def = WeaponManager.getUpgradeDef(u.id);
        if (!def) return u.id;
        return `${def.name}[${levelLabel(u.level, def.maxLevel)}]`;
      });
      const slotsTag = slotsFree > 0 ? ` +${slotsFree}` : ' FULL';
      const upgText = this.scene.add.text(0, y + 39, upgradeStrs.join(' ') + slotsTag, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#7B9FCF',
        wordWrap: { width: contentWidth - 80 },
      });
      content.add(upgText);
    }

    // Repair button with resource icon (costs 1 AP, 1 Parts)
    if (weapon.durability < weapon.maxDurability) {
      const canRepair = this.currentAP() >= 1 && this.gameState.inventory.resources.parts >= 1;
      const repairColor = canRepair ? '#4CAF50' : '#6B6B6B';
      const repairBtn = this.scene.add.text(contentWidth - 70, y, '[REPAIR]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: repairColor,
      });
      // Show cost with icon
      renderResourceCosts(this.scene, content, { parts: 1 }, contentWidth - 70, y + 12, repairColor);
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
      content.add(repairBtn);
    }

    // Upgrade button (opens inline upgrade list)
    const availableUpgrades = this.weaponManager.getAvailableUpgradesForWeapon(weapon);
    if (availableUpgrades.length > 0) {
      const btnY = weapon.durability < weapon.maxDurability ? y + 28 : y + 14;
      const upgradeBtn = this.scene.add.text(contentWidth - 70, btnY, '[UPGRADE]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#4A90D9',
      }).setInteractive({ useHandCursor: true });

      upgradeBtn.on('pointerover', () => upgradeBtn.setColor('#FFD700'));
      upgradeBtn.on('pointerout', () => upgradeBtn.setColor('#4A90D9'));
      upgradeBtn.on('pointerdown', () => {
        this.showUpgradeOptions(weapon);
      });
      content.add(upgradeBtn);
    }

    // Make the whole entry hoverable
    bg.setInteractive(
      new Phaser.Geom.Rectangle(-4, y - 2, contentWidth + 8, 76),
      Phaser.Geom.Rectangle.Contains,
    );
    bg.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x444444, 0.5);
      bg.fillRect(-4, y - 2, contentWidth + 8, 76);
    });
    bg.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x333333, 0);
      bg.fillRect(-4, y - 2, contentWidth + 8, 76);
    });
  }

  private showUpgradeOptions(weapon: WeaponInstance): void {
    const content = this.panel.getContentContainer();
    content.removeAll(true);

    const contentWidth = PANEL_WIDTH - 24;
    const available = this.weaponManager.getAvailableUpgradesForWeapon(weapon);
    const weaponName = WeaponManager.getWeaponData(weapon.weaponId)?.name ?? weapon.weaponId;

    // Title for upgrade mode (10px)
    const title = this.scene.add.text(0, 0, `Upgrade ${weaponName}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#FFD700',
    });
    content.add(title);

    // Slot usage summary (8px label)
    const slotsUsed = weapon.upgrades.length;
    const slotsTotal = WeaponManager.getMaxUpgradesPerWeapon();
    const slotSummary = this.scene.add.text(0, 14, `Slots: ${slotsUsed}/${slotsTotal}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#6B6B6B',
    });
    content.add(slotSummary);

    const entrySpacing = 58;

    available.forEach((def: UpgradeDefinition, i: number) => {
      const y = 28 + i * entrySpacing;
      const currentLevel = this.weaponManager.getUpgradeLevel(weapon, def.id as WeaponUpgradeType);
      const nextLevel = currentLevel + 1;
      const cost = def.costs[currentLevel] ?? 0;
      const canAfford = this.gameState.inventory.resources.parts >= cost;
      const isMaxed = currentLevel >= def.maxLevel;

      const baseColor = canAfford ? '#E8DCC8' : '#6B6B6B';

      // Hover background
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x333333, 0);
      bg.fillRect(-4, y - 2, contentWidth + 8, entrySpacing - 4);
      content.add(bg);

      // Upgrade name + level indicator (9px body).
      // If not yet installed (level 0) show "NEW" -- avoids confusing [Lv 0/X] display.
      const levelTag = isMaxed
        ? `${def.name} MAX`
        : currentLevel === 0
          ? `${def.name} NEW`
          : `${def.name} [${levelLabel(currentLevel, def.maxLevel)}]`;
      const nameEntry = this.scene.add.text(0, y, levelTag, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: isMaxed ? '#6B6B6B' : baseColor,
      });
      content.add(nameEntry);

      if (!isMaxed) {
        // Next level description (8px body)
        const nextDesc = resolveDescription(def, nextLevel);
        const descText = this.scene.add.text(0, y + 13, `> ${nextDesc}`, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '8px',
          color: '#AAB8C2',
        });
        content.add(descText);

        // Cost display (8px, right-aligned)
        const costLabel = `${cost} parts`;
        const costText = this.scene.add.text(contentWidth, y, costLabel, {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '8px',
          color: baseColor,
        });
        costText.setOrigin(1, 0);
        content.add(costText);

        if (canAfford) {
          bg.setInteractive(
            new Phaser.Geom.Rectangle(-4, y - 2, contentWidth + 8, entrySpacing - 4),
            Phaser.Geom.Rectangle.Contains,
          );
          if (bg.input) bg.input.cursor = 'pointer';
          bg.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0x444444, 0.5);
            bg.fillRect(-4, y - 2, contentWidth + 8, entrySpacing - 4);
            nameEntry.setColor('#FFD700');
          });
          bg.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0x333333, 0);
            bg.fillRect(-4, y - 2, contentWidth + 8, entrySpacing - 4);
            nameEntry.setColor('#E8DCC8');
          });
          bg.on('pointerdown', () => {
            this.weaponManager.upgradeNew(weapon.id, def.id as WeaponUpgradeType);
            this.onResourceChange();
            // Re-open upgrade list so player can keep upgrading
            this.showUpgradeOptions(weapon);
          });
        }
      }
    });

    // Back button (9px body)
    const backY = 28 + available.length * entrySpacing + 8;
    const backBtn = this.scene.add.text(0, backY, '[ BACK ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#D4620B',
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.rebuild());
    content.add(backBtn);
  }

  /** Handle keyboard input. Returns true if handled. */
  handleKey(key: string): boolean {
    if (!this.panel.isVisible()) return false;

    if (key === 'Escape') {
      this.panel.hide();
      return true;
    }

    // Number keys select weapons (equip)
    const num = parseInt(key, 10);
    if (num >= 1 && num <= 9) {
      const weapons = this.weaponManager.getWeapons();
      const weapon = weapons[num - 1];
      if (weapon) {
        this.weaponManager.equip(weapon.id);
        this.rebuild();
        return true;
      }
    }

    return false;
  }

  getPanel(): UIPanel {
    return this.panel;
  }
}
