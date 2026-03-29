import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';

export class HUD {
  private scene: Phaser.Scene;
  private hpBar: Phaser.GameObjects.Graphics;
  private hpBarBg: Phaser.GameObjects.Graphics;
  private waveText: Phaser.GameObjects.Text;
  private killText: Phaser.GameObjects.Text;
  private staminaBar: Phaser.GameObjects.Graphics;
  private staminaBarBg: Phaser.GameObjects.Graphics;
  private ammoText: Phaser.GameObjects.Text;
  private weaponText: Phaser.GameObjects.Text;
  private waveAnnouncementText: Phaser.GameObjects.Text;
  private container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(100);
    this.container.setScrollFactor(0);

    // --- Top HUD bar (y=0, h=32) ---
    const topBg = scene.add.graphics();
    topBg.fillStyle(0x000000, 0.5);
    topBg.fillRect(0, 0, GAME_WIDTH, 32);
    this.container.add(topBg);

    // HP bar background (x=16, y=8, w=180, h=12)
    this.hpBarBg = scene.add.graphics();
    this.hpBarBg.fillStyle(0x333333);
    this.hpBarBg.fillRect(16, 8, 180, 12);
    this.container.add(this.hpBarBg);

    // HP bar
    this.hpBar = scene.add.graphics();
    this.container.add(this.hpBar);
    this.updateHpBar(100, 100);

    // Stamina bar background (x=16, y=22, w=100, h=6)
    this.staminaBarBg = scene.add.graphics();
    this.staminaBarBg.fillStyle(0x333333);
    this.staminaBarBg.fillRect(16, 22, 100, 6);
    this.container.add(this.staminaBarBg);

    // Stamina bar
    this.staminaBar = scene.add.graphics();
    this.container.add(this.staminaBar);
    this.updateStaminaBar(100, 100);

    // Wave text (centered, y=10, 12px)
    this.waveText = scene.add.text(GAME_WIDTH / 2, 10, 'Wave 1/5', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '12px',
      color: '#E8DCC8',
    }).setOrigin(0.5, 0);
    this.container.add(this.waveText);

    // --- Bottom HUD bar (y=GAME_HEIGHT-24, h=24) ---
    const bottomBg = scene.add.graphics();
    bottomBg.fillStyle(0x000000, 0.5);
    bottomBg.fillRect(0, GAME_HEIGHT - 24, GAME_WIDTH, 24);
    this.container.add(bottomBg);

    // Weapon name + durability (left, x=16)
    this.weaponText = scene.add.text(16, GAME_HEIGHT - 18, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#E8DCC8',
    }).setOrigin(0, 0.5);
    this.container.add(this.weaponText);

    // Ammo counter (center-right, x=GAME_WIDTH-200)
    this.ammoText = scene.add.text(GAME_WIDTH - 200, GAME_HEIGHT - 18, 'Ammo: 0', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#FFD700',
    }).setOrigin(0, 0.5);
    this.container.add(this.ammoText);

    // Kill counter (far right, x=GAME_WIDTH-16, origin right)
    this.killText = scene.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 18, 'Kills: 0', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#E8DCC8',
    }).setOrigin(1, 0.5);
    this.container.add(this.killText);

    // Wave announcement (centered, hidden by default)
    this.waveAnnouncementText = scene.add.text(GAME_WIDTH / 2, 200, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '20px',
      color: '#D4620B',
    }).setOrigin(0.5).setAlpha(0);
    this.container.add(this.waveAnnouncementText);
  }

  updateHpBar(hp: number, maxHp: number): void {
    this.hpBar.clear();
    const ratio = hp / maxHp;
    // Green -> Yellow -> Red gradient
    const color = ratio > 0.5 ? 0x4CAF50 : ratio > 0.25 ? 0xFFD700 : 0xF44336;
    this.hpBar.fillStyle(color);
    this.hpBar.fillRect(16, 8, 180 * ratio, 12);
  }

  updateStaminaBar(stamina: number, maxStamina: number): void {
    this.staminaBar.clear();
    const ratio = stamina / maxStamina;
    this.staminaBar.fillStyle(0x4A90D9);
    this.staminaBar.fillRect(16, 22, 100 * ratio, 6);
  }

  updateWave(wave: number): void {
    this.waveText.setText(`Wave ${wave}/5`);
  }

  updateKills(kills: number): void {
    this.killText.setText(`Kills: ${kills}`);
  }

  showWaveAnnouncement(wave: number): void {
    this.waveAnnouncementText.setText(`WAVE ${wave}`);
    this.waveAnnouncementText.setAlpha(1);

    this.scene.tweens.add({
      targets: this.waveAnnouncementText,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
    });
  }

  updateWeapon(name: string, durability: number, maxDurability: number): void {
    const durStr = `${durability}/${maxDurability}`;
    this.weaponText.setText(`${name} [${durStr}]`);
    if (durability <= 0) {
      this.weaponText.setColor('#F44336');
    } else {
      this.weaponText.setColor('#E8DCC8');
    }
  }

  updateAmmo(ammo: number): void {
    this.ammoText.setText(`Ammo: ${ammo}`);
    if (ammo <= 0) {
      this.ammoText.setColor('#F44336');
    } else if (ammo <= 5) {
      this.ammoText.setColor('#FFD700');
    } else {
      this.ammoText.setColor('#FFD700');
    }
  }

  showMessage(text: string): void {
    this.waveAnnouncementText.setText(text);
    this.waveAnnouncementText.setAlpha(1);

    this.scene.tweens.add({
      targets: this.waveAnnouncementText,
      alpha: 0,
      duration: 2500,
      ease: 'Power2',
    });
  }
}
