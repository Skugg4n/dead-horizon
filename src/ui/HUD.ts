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
  private waveAnnouncementBg: Phaser.GameObjects.Graphics;
  private container: Phaser.GameObjects.Container;
  // F3: Base health bar
  private baseHpBar: Phaser.GameObjects.Graphics;
  private baseHpBarBg: Phaser.GameObjects.Graphics;
  private baseHpLabel: Phaser.GameObjects.Text;

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

    // Heart icon before HP bar (if texture exists)
    const hpBarX = 16;
    if (scene.textures.exists('icon_heart')) {
      const heartIcon = scene.add.image(hpBarX - 2, 14, 'icon_heart')
        .setOrigin(1, 0.5)
        .setDisplaySize(10, 10);
      this.container.add(heartIcon);
    }

    // HP bar background (x=16, y=8, w=180, h=12)
    this.hpBarBg = scene.add.graphics();
    this.hpBarBg.fillStyle(0x333333);
    this.hpBarBg.fillRect(hpBarX, 8, 180, 12);
    this.container.add(this.hpBarBg);

    // HP bar
    this.hpBar = scene.add.graphics();
    this.container.add(this.hpBar);
    this.updateHpBar(100, 100);

    // Stamina bar background (x=16, y=22, w=100, h=6)
    this.staminaBarBg = scene.add.graphics();
    this.staminaBarBg.fillStyle(0x333333);
    this.staminaBarBg.fillRect(hpBarX, 22, 100, 6);
    this.container.add(this.staminaBarBg);

    // Stamina bar
    this.staminaBar = scene.add.graphics();
    this.container.add(this.staminaBar);
    this.updateStaminaBar(100, 100);

    // F3: Base HP bar -- right side of top HUD bar
    const baseBarX = GAME_WIDTH - 210;
    const baseBarW = 120;

    // "BASE" label
    this.baseHpLabel = scene.add.text(baseBarX - 2, 14, 'BASE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#9A9A9A',
    }).setOrigin(1, 0.5);
    this.container.add(this.baseHpLabel);

    // Background track
    this.baseHpBarBg = scene.add.graphics();
    this.baseHpBarBg.fillStyle(0x333333);
    this.baseHpBarBg.fillRect(baseBarX, 8, baseBarW, 12);
    this.container.add(this.baseHpBarBg);

    // Filled bar
    this.baseHpBar = scene.add.graphics();
    this.container.add(this.baseHpBar);
    this.updateBaseHpBar(200, 200); // default full

    // Wave text (centered, 10px, brighter color)
    this.waveText = scene.add.text(GAME_WIDTH / 2, 10, 'Wave 1/5', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#FFFFFF',
    }).setOrigin(0.5, 0);
    this.container.add(this.waveText);

    // --- Bottom HUD bar (y=GAME_HEIGHT-24, h=24) ---
    const bottomBg = scene.add.graphics();
    bottomBg.fillStyle(0x000000, 0.5);
    bottomBg.fillRect(0, GAME_HEIGHT - 24, GAME_WIDTH, 24);
    this.container.add(bottomBg);

    // Weapon name (left, 9px)
    this.weaponText = scene.add.text(16, GAME_HEIGHT - 18, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#E8DCC8',
    }).setOrigin(0, 0.5);
    this.container.add(this.weaponText);

    // Ammo counter with label
    const ammoX = GAME_WIDTH - 200;
    const ammoLabel = scene.add.text(ammoX, GAME_HEIGHT - 18, 'AMMO:', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#9A9A9A',
    }).setOrigin(0, 0.5);
    this.container.add(ammoLabel);

    this.ammoText = scene.add.text(ammoX + 52, GAME_HEIGHT - 18, '0', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#FFD700',
    }).setOrigin(0, 0.5);
    this.container.add(this.ammoText);

    // Kill counter with label
    const killLabelX = GAME_WIDTH - 100;
    const killLabel = scene.add.text(killLabelX, GAME_HEIGHT - 18, 'KILLS:', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#9A9A9A',
    }).setOrigin(0, 0.5);
    this.container.add(killLabel);

    this.killText = scene.add.text(killLabelX + 56, GAME_HEIGHT - 18, '0', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#E8DCC8',
    }).setOrigin(0, 0.5);
    this.container.add(this.killText);

    // Wave announcement background (hidden by default)
    this.waveAnnouncementBg = scene.add.graphics();
    this.waveAnnouncementBg.setAlpha(0);
    this.container.add(this.waveAnnouncementBg);

    // Wave announcement text (centered, 16px, hidden by default)
    this.waveAnnouncementText = scene.add.text(GAME_WIDTH / 2, 200, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
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

  /** F3: Update base health bar color (green -> yellow -> red) */
  updateBaseHpBar(hp: number, maxHp: number): void {
    const baseBarX = GAME_WIDTH - 210;
    const baseBarW = 120;
    this.baseHpBar.clear();
    const ratio = maxHp > 0 ? hp / maxHp : 0;
    const color = ratio > 0.5 ? 0x4CAF50 : ratio > 0.25 ? 0xFFD700 : 0xF44336;
    this.baseHpBar.fillStyle(color);
    this.baseHpBar.fillRect(baseBarX, 8, baseBarW * ratio, 12);
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
    this.killText.setText(`${kills}`);
  }

  showWaveAnnouncement(wave: number): void {
    const text = `WAVE ${wave}`;
    this.waveAnnouncementText.setText(text);
    this.waveAnnouncementText.setAlpha(1);
    this.waveAnnouncementText.setScale(1);

    // Draw dark background behind text
    this.waveAnnouncementBg.clear();
    const bounds = this.waveAnnouncementText.getBounds();
    const pad = 8;
    this.waveAnnouncementBg.fillStyle(0x000000, 0.6);
    this.waveAnnouncementBg.fillRoundedRect(
      bounds.x - pad, bounds.y - pad,
      bounds.width + pad * 2, bounds.height + pad * 2,
      4
    );
    this.waveAnnouncementBg.setAlpha(1);

    // Scale-up animation: 1.0 -> 1.1 -> 1.0 over 300ms
    this.scene.tweens.add({
      targets: this.waveAnnouncementText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 150,
      ease: 'Quad.easeOut',
      yoyo: true,
    });

    // Fade out after scale animation
    this.scene.tweens.add({
      targets: [this.waveAnnouncementText, this.waveAnnouncementBg],
      alpha: 0,
      delay: 300,
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
    this.ammoText.setText(`${ammo}`);
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
    this.waveAnnouncementText.setScale(1);

    // Draw dark background behind message text
    this.waveAnnouncementBg.clear();
    const bounds = this.waveAnnouncementText.getBounds();
    const pad = 8;
    this.waveAnnouncementBg.fillStyle(0x000000, 0.6);
    this.waveAnnouncementBg.fillRoundedRect(
      bounds.x - pad, bounds.y - pad,
      bounds.width + pad * 2, bounds.height + pad * 2,
      4
    );
    this.waveAnnouncementBg.setAlpha(1);

    this.scene.tweens.add({
      targets: [this.waveAnnouncementText, this.waveAnnouncementBg],
      alpha: 0,
      duration: 2500,
      ease: 'Power2',
    });
  }
}
