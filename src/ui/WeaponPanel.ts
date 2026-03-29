// DayScene UI panel showing equipped weapons with stats, repair, and upgrade options
import Phaser from 'phaser';
import { WeaponManager } from '../systems/WeaponManager';
import { UIPanel } from './UIPanel';
import type { WeaponInstance, WeaponUpgradeType, GameState } from '../config/types';

const PANEL_WIDTH = 380;

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

    this.panel = new UIPanel(scene, 'WEAPONS', PANEL_WIDTH, 400);

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

    const weaponHeight = 70;
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

    const contentWidth = PANEL_WIDTH - 24; // account for UIPanel padding
    const xpNeeded = this.weaponManager.getXPForNextLevel(weapon);
    const isBroken = this.weaponManager.isBroken(weapon);

    // Equipped indicator
    const prefix = isEquipped ? '> ' : '  ';
    const nameColor = isBroken ? '#F44336' : (isEquipped ? '#FFD700' : '#E8DCC8');

    // Name + class + rarity
    const nameText = this.scene.add.text(0, y, `${prefix}${stats.name} [${weapon.rarity}]`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: nameColor,
    });
    content.add(nameText);

    // Stats line
    const brokenTag = isBroken ? ' BROKEN' : '';
    const statsLine = `DMG:${stats.damage} RNG:${stats.range} Dur:${weapon.durability}/${weapon.maxDurability}${brokenTag}`;
    const statsText = this.scene.add.text(0, y + 13, statsLine, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: isBroken ? '#F44336' : '#AAAAAA',
    });
    content.add(statsText);

    // Level + XP
    const lvlLine = weapon.level >= 5
      ? `Lv${weapon.level} MAX`
      : `Lv${weapon.level} XP:${weapon.xp}/${xpNeeded}`;
    const lvlText = this.scene.add.text(0, y + 25, lvlLine, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#AAAAAA',
    });
    content.add(lvlText);

    // Upgrades display
    if (weapon.upgrades.length > 0) {
      const upgradeStr = weapon.upgrades.join(', ');
      const upgText = this.scene.add.text(0, y + 37, `Mods: ${upgradeStr}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#7B9FCF',
      });
      content.add(upgText);
    }

    // Repair button (costs 1 AP, 1 Parts)
    if (weapon.durability < weapon.maxDurability) {
      const canRepair = this.currentAP() >= 1 && this.gameState.inventory.resources.parts >= 1;
      const repairColor = canRepair ? '#4CAF50' : '#6B6B6B';
      const repairBtn = this.scene.add.text(contentWidth - 70, y, '[REPAIR]', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: repairColor,
      });
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
    const availableUpgrades = this.getAvailableUpgrades(weapon);
    if (availableUpgrades.length > 0) {
      const upgradeBtn = this.scene.add.text(contentWidth - 70, y + 13, '[UPGRADE]', {
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
  }

  private getAvailableUpgrades(weapon: WeaponInstance): WeaponUpgradeType[] {
    const allUpgrades: WeaponUpgradeType[] = ['damage_boost', 'suppressor', 'extended_mag', 'scope', 'reinforcement'];
    return allUpgrades.filter(u => !weapon.upgrades.includes(u));
  }

  private showUpgradeOptions(weapon: WeaponInstance): void {
    const content = this.panel.getContentContainer();
    content.removeAll(true);

    const contentWidth = PANEL_WIDTH - 24;
    const available = this.getAvailableUpgrades(weapon);

    // Title for upgrade mode
    const title = this.scene.add.text(0, 0, `Upgrade ${WeaponManager.getWeaponData(weapon.weaponId)?.name ?? weapon.weaponId}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#FFD700',
    });
    content.add(title);

    available.forEach((upgradeType, i) => {
      const y = 20 + i * 24;
      const upgradeData = WeaponManager.getUpgradeData(upgradeType);
      if (!upgradeData) return;

      const canAfford = this.gameState.inventory.resources.parts >= upgradeData.partsCost;
      const color = canAfford ? '#E8DCC8' : '#6B6B6B';

      const entry = this.scene.add.text(0, y, `${upgradeData.name} (${upgradeData.partsCost}P) - ${upgradeData.description}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color,
        wordWrap: { width: contentWidth },
      });

      if (canAfford) {
        entry.setInteractive({ useHandCursor: true });
        entry.on('pointerover', () => entry.setColor('#FFD700'));
        entry.on('pointerout', () => entry.setColor('#E8DCC8'));
        entry.on('pointerdown', () => {
          this.weaponManager.upgrade(weapon.id, upgradeType);
          this.onResourceChange();
          this.rebuild();
        });
      }
      content.add(entry);
    });

    // Back button
    const backY = 20 + available.length * 24 + 8;
    const backBtn = this.scene.add.text(0, backY, '[ BACK ]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#D4620B',
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.rebuild());
    content.add(backBtn);
  }
}
