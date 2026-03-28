// DayScene UI panel showing equipped weapons with stats, repair, and upgrade options
import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants';
import { WeaponManager } from '../systems/WeaponManager';
import type { WeaponInstance, WeaponUpgradeType, GameState } from '../config/types';

const PANEL_WIDTH = 240;
const PANEL_X = GAME_WIDTH - PANEL_WIDTH - 8;
const PANEL_Y = 60;

export class WeaponPanel {
  private scene: Phaser.Scene;
  private weaponManager: WeaponManager;
  private gameState: GameState;
  private container: Phaser.GameObjects.Container;
  private visible: boolean = false;
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

    this.container = scene.add.container(PANEL_X, PANEL_Y);
    this.container.setDepth(110);
    this.container.setVisible(false);

    this.rebuild();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  toggle(): void {
    this.visible = !this.visible;
    if (this.visible) this.rebuild();
    this.container.setVisible(this.visible);
  }

  isVisible(): boolean {
    return this.visible;
  }

  private rebuild(): void {
    this.container.removeAll(true);

    const weapons = this.weaponManager.getWeapons();
    const equippedIdx = this.weaponManager.getEquippedIndex();

    // Calculate panel height based on content
    const weaponHeight = 70;
    const totalHeight = Math.max(100, weapons.length * weaponHeight + 16);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1A1A2E, 0.92);
    bg.fillRect(0, 0, PANEL_WIDTH, totalHeight);
    bg.lineStyle(1, 0x6B6B6B);
    bg.strokeRect(0, 0, PANEL_WIDTH, totalHeight);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(PANEL_WIDTH / 2, 6, 'WEAPONS', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#FFD700',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    if (weapons.length === 0) {
      const noWeapons = this.scene.add.text(PANEL_WIDTH / 2, 40, 'No weapons', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#6B6B6B',
      }).setOrigin(0.5, 0);
      this.container.add(noWeapons);
      return;
    }

    weapons.forEach((weapon, i) => {
      const y = 22 + i * weaponHeight;
      this.renderWeaponEntry(weapon, y, i === equippedIdx);
    });
  }

  private renderWeaponEntry(weapon: WeaponInstance, y: number, isEquipped: boolean): void {
    const stats = this.weaponManager.getWeaponStats(weapon);
    const data = WeaponManager.getWeaponData(weapon.weaponId);
    if (!data) return;

    const xpNeeded = this.weaponManager.getXPForNextLevel(weapon);
    const isBroken = this.weaponManager.isBroken(weapon);

    // Equipped indicator
    const prefix = isEquipped ? '> ' : '  ';
    const nameColor = isBroken ? '#F44336' : (isEquipped ? '#FFD700' : '#E8DCC8');

    // Name + class + rarity
    const nameText = this.scene.add.text(8, y, `${prefix}${stats.name} [${weapon.rarity}]`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: nameColor,
    });
    this.container.add(nameText);

    // Stats line
    const brokenTag = isBroken ? ' BROKEN' : '';
    const statsLine = `DMG:${stats.damage} RNG:${stats.range} Dur:${weapon.durability}/${weapon.maxDurability}${brokenTag}`;
    const statsText = this.scene.add.text(8, y + 13, statsLine, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: isBroken ? '#F44336' : '#AAAAAA',
    });
    this.container.add(statsText);

    // Level + XP
    const lvlLine = weapon.level >= 5
      ? `Lv${weapon.level} MAX`
      : `Lv${weapon.level} XP:${weapon.xp}/${xpNeeded}`;
    const lvlText = this.scene.add.text(8, y + 25, lvlLine, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#AAAAAA',
    });
    this.container.add(lvlText);

    // Upgrades display
    if (weapon.upgrades.length > 0) {
      const upgradeStr = weapon.upgrades.join(', ');
      const upgText = this.scene.add.text(8, y + 37, `Mods: ${upgradeStr}`, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#7B9FCF',
      });
      this.container.add(upgText);
    }

    // Repair button (costs 1 AP, 1 Parts)
    if (weapon.durability < weapon.maxDurability) {
      const canRepair = this.currentAP() >= 1 && this.gameState.inventory.resources.parts >= 1;
      const repairColor = canRepair ? '#4CAF50' : '#6B6B6B';
      const repairBtn = this.scene.add.text(PANEL_WIDTH - 70, y, '[REPAIR]', {
        fontFamily: 'monospace',
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
      this.container.add(repairBtn);
    }

    // Upgrade button (opens inline upgrade list)
    const availableUpgrades = this.getAvailableUpgrades(weapon);
    if (availableUpgrades.length > 0) {
      const upgradeBtn = this.scene.add.text(PANEL_WIDTH - 70, y + 13, '[UPGRADE]', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#4A90D9',
      }).setInteractive({ useHandCursor: true });

      upgradeBtn.on('pointerover', () => upgradeBtn.setColor('#FFD700'));
      upgradeBtn.on('pointerout', () => upgradeBtn.setColor('#4A90D9'));
      upgradeBtn.on('pointerdown', () => {
        this.showUpgradeOptions(weapon);
      });
      this.container.add(upgradeBtn);
    }
  }

  private getAvailableUpgrades(weapon: WeaponInstance): WeaponUpgradeType[] {
    const allUpgrades: WeaponUpgradeType[] = ['damage_boost', 'suppressor', 'extended_mag', 'scope', 'reinforcement'];
    return allUpgrades.filter(u => !weapon.upgrades.includes(u));
  }

  private showUpgradeOptions(weapon: WeaponInstance): void {
    // Rebuild the panel with upgrade options shown inline
    this.container.removeAll(true);

    const available = this.getAvailableUpgrades(weapon);

    const totalHeight = available.length * 24 + 40;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1A1A2E, 0.95);
    bg.fillRect(0, 0, PANEL_WIDTH, totalHeight);
    bg.lineStyle(1, 0x6B6B6B);
    bg.strokeRect(0, 0, PANEL_WIDTH, totalHeight);
    this.container.add(bg);

    const title = this.scene.add.text(PANEL_WIDTH / 2, 6, `Upgrade ${WeaponManager.getWeaponData(weapon.weaponId)?.name ?? weapon.weaponId}`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#FFD700',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    available.forEach((upgradeType, i) => {
      const y = 24 + i * 24;
      const upgradeData = WeaponManager.getUpgradeData(upgradeType);
      if (!upgradeData) return;

      const canAfford = this.gameState.inventory.resources.parts >= upgradeData.partsCost;
      const color = canAfford ? '#E8DCC8' : '#6B6B6B';

      const entry = this.scene.add.text(8, y, `${upgradeData.name} (${upgradeData.partsCost}P) - ${upgradeData.description}`, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color,
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
      this.container.add(entry);
    });

    // Back button
    const backBtn = this.scene.add.text(8, totalHeight - 16, '[ BACK ]', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#D4620B',
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.rebuild());
    this.container.add(backBtn);
  }
}
