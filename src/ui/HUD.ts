import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants';

export class HUD {
  private scene: Phaser.Scene;
  private hpBar: Phaser.GameObjects.Graphics;
  private hpBarBg: Phaser.GameObjects.Graphics;
  private waveText: Phaser.GameObjects.Text;
  private killText: Phaser.GameObjects.Text;
  private staminaBar: Phaser.GameObjects.Graphics;
  private staminaBarBg: Phaser.GameObjects.Graphics;
  private ammoText: Phaser.GameObjects.Text;
  private waveAnnouncementText: Phaser.GameObjects.Text;
  private container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(100);
    this.container.setScrollFactor(0);

    // HP bar background
    this.hpBarBg = scene.add.graphics();
    this.hpBarBg.fillStyle(0x333333);
    this.hpBarBg.fillRect(16, 16, 200, 16);
    this.container.add(this.hpBarBg);

    // HP bar
    this.hpBar = scene.add.graphics();
    this.container.add(this.hpBar);
    this.updateHpBar(100, 100);

    // Stamina bar background
    this.staminaBarBg = scene.add.graphics();
    this.staminaBarBg.fillStyle(0x333333);
    this.staminaBarBg.fillRect(16, 36, 120, 8);
    this.container.add(this.staminaBarBg);

    // Stamina bar
    this.staminaBar = scene.add.graphics();
    this.container.add(this.staminaBar);
    this.updateStaminaBar(100, 100);

    // Wave text
    this.waveText = scene.add.text(GAME_WIDTH / 2, 16, 'Wave 1/5', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#E8DCC8',
    }).setOrigin(0.5, 0);
    this.container.add(this.waveText);

    // Ammo counter
    this.ammoText = scene.add.text(GAME_WIDTH - 16, 16, 'Ammo: 0', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#FFD700',
    }).setOrigin(1, 0);
    this.container.add(this.ammoText);

    // Kill counter
    this.killText = scene.add.text(GAME_WIDTH - 16, 34, 'Kills: 0', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#E8DCC8',
    }).setOrigin(1, 0);
    this.container.add(this.killText);

    // Wave announcement (centered, hidden by default)
    this.waveAnnouncementText = scene.add.text(GAME_WIDTH / 2, 200, '', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#D4620B',
    }).setOrigin(0.5).setAlpha(0);
    this.container.add(this.waveAnnouncementText);
  }

  updateHpBar(hp: number, maxHp: number): void {
    this.hpBar.clear();
    const ratio = hp / maxHp;
    const color = ratio > 0.5 ? 0x4CAF50 : ratio > 0.25 ? 0xFFD700 : 0xF44336;
    this.hpBar.fillStyle(color);
    this.hpBar.fillRect(16, 16, 200 * ratio, 16);
  }

  updateStaminaBar(stamina: number, maxStamina: number): void {
    this.staminaBar.clear();
    const ratio = stamina / maxStamina;
    this.staminaBar.fillStyle(0x4A90D9);
    this.staminaBar.fillRect(16, 36, 120 * ratio, 8);
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

  updateAmmo(ammo: number): void {
    this.ammoText.setText(`Ammo: ${ammo}`);
    // Flash red when ammo is low
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
