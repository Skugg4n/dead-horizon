// Dead Horizon -- Achievement manager
// Tracks and awards achievements based on game state conditions

import Phaser from 'phaser';
import type { GameState, AchievementData } from '../config/types';
import achievementsJson from '../data/achievements.json';

const achievementList = achievementsJson.achievements as unknown as AchievementData[];

export class AchievementManager {
  private scene: Phaser.Scene;
  private gameState: GameState;

  constructor(scene: Phaser.Scene, gameState: GameState) {
    this.scene = scene;
    this.gameState = gameState;
  }

  /** Check all achievements and unlock any newly met conditions */
  checkAll(): void {
    for (const achievement of achievementList) {
      if (this.gameState.achievements.includes(achievement.id)) continue;
      if (this.checkCondition(achievement)) {
        this.unlock(achievement);
      }
    }
  }

  /** Check a specific achievement condition against current state */
  private checkCondition(achievement: AchievementData): boolean {
    const cond = achievement.condition;
    switch (cond.type) {
      case 'total_kills':
        return this.gameState.progress.totalKills >= cond.target;
      case 'highest_wave':
        return this.gameState.progress.highestWave >= cond.target;
      case 'structures_placed':
        return this.gameState.stats.structuresPlaced >= cond.target;
      case 'loot_runs':
        return this.gameState.stats.lootRunsCompleted >= cond.target;
      case 'refugees':
        return this.gameState.refugees.length >= cond.target;
      case 'weapons':
        return this.gameState.inventory.weapons.length >= cond.target;
      case 'items_crafted':
        return this.gameState.stats.itemsCrafted >= cond.target;
      case 'base_level':
        return this.gameState.base.level >= cond.target;
      // 'no_damage_night' is checked manually after a night with no damage
      default:
        return false;
    }
  }

  /** Unlock an achievement and show notification */
  private unlock(achievement: AchievementData): void {
    this.gameState.achievements.push(achievement.id);
    this.scene.events.emit('achievement-unlocked', achievement);
    this.showToast(achievement);
  }

  /** Unlock the "Untouchable" achievement (called from NightScene) */
  unlockNoDamage(): void {
    const id = 'untouchable';
    if (this.gameState.achievements.includes(id)) return;
    const achievement = achievementList.find(a => a.id === id);
    if (achievement) {
      this.unlock(achievement);
    }
  }

  /** Show a toast notification at the top of the screen */
  private showToast(achievement: AchievementData): void {
    const cam = this.scene.cameras.main;
    const x = cam.width / 2;
    const y = 30;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1A1A2E, 0.95);
    bg.fillRect(x - 120, y - 12, 240, 40);
    bg.lineStyle(1, 0xC5A030);
    bg.strokeRect(x - 120, y - 12, 240, 40);
    bg.setDepth(200).setScrollFactor(0);

    const text = this.scene.add.text(x, y, `Achievement: ${achievement.name}`, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '11px',
      color: '#C5A030',
    }).setOrigin(0.5, 0).setDepth(201).setScrollFactor(0);

    const desc = this.scene.add.text(x, y + 14, achievement.description, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#E8DCC8',
    }).setOrigin(0.5, 0).setDepth(201).setScrollFactor(0);

    this.scene.tweens.add({
      targets: [bg, text, desc],
      alpha: 0,
      delay: 4000,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => {
        bg.destroy();
        text.destroy();
        desc.destroy();
      },
    });
  }

  /** Get all achievements with their unlock status */
  getAllWithStatus(): Array<{ data: AchievementData; unlocked: boolean }> {
    return achievementList.map(a => ({
      data: a,
      unlocked: this.gameState.achievements.includes(a.id),
    }));
  }
}
