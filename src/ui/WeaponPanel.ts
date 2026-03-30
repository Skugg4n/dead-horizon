// DayScene UI panel showing equipped weapons with stats, repair, and upgrade options
import Phaser from 'phaser';
import { WeaponManager } from '../systems/WeaponManager';
import { UIPanel } from './UIPanel';
import { renderResourceCosts } from './resourceIcons';
import type { WeaponInstance, WeaponUpgradeType, GameState } from '../config/types';

const PANEL_WIDTH = 360;

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

    const contentWidth = PANEL_WIDTH - 24;
    const xpNeeded = this.weaponManager.getXPForNextLevel(weapon);
    const isBroken = this.weaponManager.isBroken(weapon);

    // Hover background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x333333, 0);
    bg.fillRect(-4, y - 2, contentWidth + 8, 66);
    content.add(bg);

    // Equipped indicator
    const prefix = isEquipped ? '> ' : '  ';
    const nameColor = isBroken ? '#F44336' : (isEquipped ? '#FFD700' : '#E8DCC8');

    // Name + class + rarity (10px title)
    const nameText = this.scene.add.text(0, y, `${prefix}${stats.name} [${weapon.rarity}]`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: nameColor,
    });
    content.add(nameText);

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
    const lvlText = this.scene.add.text(0, y + 28, lvlLine, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#6B6B6B',
    });
    content.add(lvlText);

    // Upgrades display (8px label)
    if (weapon.upgrades.length > 0) {
      const upgradeStr = weapon.upgrades.join(', ');
      const upgText = this.scene.add.text(0, y + 40, `Mods: ${upgradeStr}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#7B9FCF',
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
    const availableUpgrades = this.getAvailableUpgrades(weapon);
    if (availableUpgrades.length > 0) {
      const btnY = weapon.durability < weapon.maxDurability ? y + 26 : y + 14;
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
      new Phaser.Geom.Rectangle(-4, y - 2, contentWidth + 8, 66),
      Phaser.Geom.Rectangle.Contains,
    );
    bg.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x444444, 0.5);
      bg.fillRect(-4, y - 2, contentWidth + 8, 66);
    });
    bg.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x333333, 0);
      bg.fillRect(-4, y - 2, contentWidth + 8, 66);
    });
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

    // Title for upgrade mode (10px)
    const title = this.scene.add.text(0, 0, `Upgrade ${WeaponManager.getWeaponData(weapon.weaponId)?.name ?? weapon.weaponId}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#FFD700',
    });
    content.add(title);

    const entrySpacing = 55;

    available.forEach((upgradeType, i) => {
      const y = 20 + i * entrySpacing;
      const upgradeData = WeaponManager.getUpgradeData(upgradeType);
      if (!upgradeData) return;

      const canAfford = this.gameState.inventory.resources.parts >= upgradeData.partsCost;
      const color = canAfford ? '#E8DCC8' : '#6B6B6B';

      // Hover background
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x333333, 0);
      bg.fillRect(-4, y - 2, contentWidth + 8, entrySpacing - 4);
      content.add(bg);

      // Upgrade name + description with cost on same line (9px body)
      const costLabel = `[${upgradeData.partsCost} parts]`;
      const entry = this.scene.add.text(0, y, `${upgradeData.name} - ${upgradeData.description}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color,
        wordWrap: { width: contentWidth - 10 },
      });
      content.add(entry);

      // Cost label right-aligned on same line as name (9px body)
      const costText = this.scene.add.text(contentWidth, y, costLabel, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color,
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
          entry.setColor('#FFD700');
        });
        bg.on('pointerout', () => {
          bg.clear();
          bg.fillStyle(0x333333, 0);
          bg.fillRect(-4, y - 2, contentWidth + 8, entrySpacing - 4);
          entry.setColor('#E8DCC8');
        });
        bg.on('pointerdown', () => {
          this.weaponManager.upgrade(weapon.id, upgradeType);
          this.onResourceChange();
          this.rebuild();
        });
      }
    });

    // Back button (9px body)
    const backY = 20 + available.length * entrySpacing + 8;
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
