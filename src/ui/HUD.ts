import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { WeaponSpecialEffect } from '../config/types';

// Layout constants
const TOP_H = 44;         // height of top HUD bar
const BOTTOM_H = 48;      // height of bottom HUD bar (increased for 2 weapons)
const BAR_Y = 9;          // y of HP/base bars inside top bar
const BAR_H = 14;         // height of HP/base bar fill
const STAMINA_Y = 27;     // y of stamina bar inside top bar
const STAMINA_H = 7;      // height of stamina bar
const ICON_SIZE = 14;     // display size for sprite icons
const PANEL_ALPHA = 0.62; // background panel alpha
const PANEL_COLOR = 0x0a0a0a;
const BORDER_COLOR = 0x333333;
const DUR_BAR_W = 70;     // width of durability bar

// Weapon row layout (two rows in bottom HUD)
const WEAPON1_ROW_Y = 5;  // y offset inside bottom bar for primary weapon row
const WEAPON2_ROW_Y = 26; // y offset inside bottom bar for secondary weapon row

export class HUD {
  private scene: Phaser.Scene;

  // Top HUD elements
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;

  private staminaBar!: Phaser.GameObjects.Graphics;
  private staminaBarBg!: Phaser.GameObjects.Graphics;

  private wavePanel!: Phaser.GameObjects.Graphics;
  private waveText!: Phaser.GameObjects.Text;
  private waveSubText!: Phaser.GameObjects.Text;

  private baseHpBar!: Phaser.GameObjects.Graphics;
  private baseHpBarBg!: Phaser.GameObjects.Graphics;
  private baseHpLabel!: Phaser.GameObjects.Text;

  // Bottom HUD elements -- primary weapon (slot 1)
  private weapon1SlotLabel!: Phaser.GameObjects.Text;
  private weapon1Text!: Phaser.GameObjects.Text;
  private weapon1DurBar!: Phaser.GameObjects.Graphics;
  private weapon1DurBarBg!: Phaser.GameObjects.Graphics;
  private weapon1EffectText!: Phaser.GameObjects.Text;
  // Ultimate glow overlay -- shown when weapon is Lv5
  private weapon1UltiGlow!: Phaser.GameObjects.Graphics;

  // Bottom HUD elements -- secondary weapon (slot 2)
  private weapon2SlotLabel!: Phaser.GameObjects.Text;
  private weapon2Text!: Phaser.GameObjects.Text;
  private weapon2DurBar!: Phaser.GameObjects.Graphics;
  private weapon2DurBarBg!: Phaser.GameObjects.Graphics;

  private ammoText!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;

  // Wave announcement (centered popup)
  private waveAnnouncementText!: Phaser.GameObjects.Text;
  private waveAnnouncementBg!: Phaser.GameObjects.Graphics;

  private container!: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(100);
    this.container.setScrollFactor(0);

    this.buildTopHud();
    this.buildBottomHud();
    this.buildWaveAnnouncement();
  }

  // ---------------------------------------------------------------------------
  // BUILD: top HUD
  // ---------------------------------------------------------------------------
  private buildTopHud(): void {
    const scene = this.scene;

    const topBg = scene.add.graphics();
    topBg.fillStyle(PANEL_COLOR, PANEL_ALPHA);
    topBg.fillRect(0, 0, GAME_WIDTH, TOP_H);
    topBg.lineStyle(1, BORDER_COLOR, 0.8);
    topBg.strokeRect(0, 0, GAME_WIDTH, TOP_H);
    this.container.add(topBg);

    // ---- HP section (left side) ----------------------------------------
    const hpSectionX = 8;
    const hpBarX = hpSectionX + ICON_SIZE + 4;
    const hpBarW = 150;

    if (scene.textures.exists('icon_heart')) {
      const heartIcon = scene.add.image(hpSectionX, BAR_Y + BAR_H / 2, 'icon_heart')
        .setOrigin(0, 0.5)
        .setDisplaySize(ICON_SIZE, ICON_SIZE);
      this.container.add(heartIcon);
    }

    this.hpBarBg = scene.add.graphics();
    this.hpBarBg.lineStyle(1, 0x555555, 1);
    this.hpBarBg.fillStyle(0x1a1a1a);
    this.hpBarBg.fillRect(hpBarX, BAR_Y, hpBarW, BAR_H);
    this.hpBarBg.strokeRect(hpBarX, BAR_Y, hpBarW, BAR_H);
    this.container.add(this.hpBarBg);

    this.hpBar = scene.add.graphics();
    this.container.add(this.hpBar);

    this.hpText = scene.add.text(hpBarX + hpBarW + 5, BAR_Y + BAR_H / 2, 'HP: 100/100', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#cccccc',
    }).setOrigin(0, 0.5);
    this.container.add(this.hpText);

    // ---- Stamina section -----------------------------------------------
    const staminaSectionX = hpSectionX;
    const staminaBarX = staminaSectionX + ICON_SIZE + 4;
    const staminaBarW = 100;

    const boltGfx = scene.add.graphics();
    boltGfx.fillStyle(0x4A90D9, 1);
    boltGfx.fillTriangle(
      staminaSectionX + 8, STAMINA_Y,
      staminaSectionX + 3, STAMINA_Y + STAMINA_H,
      staminaSectionX + 6, STAMINA_Y + STAMINA_H
    );
    boltGfx.fillTriangle(
      staminaSectionX + 5, STAMINA_Y + STAMINA_H,
      staminaSectionX + 10, STAMINA_Y + STAMINA_H,
      staminaSectionX + 5, STAMINA_Y + STAMINA_H * 2
    );
    this.container.add(boltGfx);

    this.staminaBarBg = scene.add.graphics();
    this.staminaBarBg.lineStyle(1, 0x444444, 1);
    this.staminaBarBg.fillStyle(0x1a1a1a);
    this.staminaBarBg.fillRect(staminaBarX, STAMINA_Y, staminaBarW, STAMINA_H);
    this.staminaBarBg.strokeRect(staminaBarX, STAMINA_Y, staminaBarW, STAMINA_H);
    this.container.add(this.staminaBarBg);

    this.staminaBar = scene.add.graphics();
    this.container.add(this.staminaBar);
    this.updateStaminaBar(100, 100);

    // ---- Wave panel (centered) -----------------------------------------
    const wavePanelW = 140;
    const wavePanelH = TOP_H - 8;
    const wavePanelX = (GAME_WIDTH - wavePanelW) / 2;

    this.wavePanel = scene.add.graphics();
    this.wavePanel.fillStyle(0x111111, 0.75);
    this.wavePanel.lineStyle(1, 0x555555, 1);
    this.wavePanel.fillRoundedRect(wavePanelX, 4, wavePanelW, wavePanelH, 6);
    this.wavePanel.strokeRoundedRect(wavePanelX, 4, wavePanelW, wavePanelH, 6);
    this.container.add(this.wavePanel);

    this.waveText = scene.add.text(GAME_WIDTH / 2, TOP_H / 2 - 6, 'Night 1/5', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#FFFFFF',
    }).setOrigin(0.5, 0.5);
    this.container.add(this.waveText);

    // Sub-line: wave + enemy count
    this.waveSubText = scene.add.text(GAME_WIDTH / 2, TOP_H / 2 + 8, 'Wave 1/1  --  0 enemies', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#9A9A9A',
    }).setOrigin(0.5, 0.5);
    this.container.add(this.waveSubText);

    // ---- Base HP section (right side) ----------------------------------
    const baseBarW = 120;
    const baseBarX = GAME_WIDTH - 8 - baseBarW;
    const baseLabelX = baseBarX - 4;

    const houseGfx = scene.add.graphics();
    houseGfx.fillStyle(0x9A9A9A, 1);
    const houseX = baseLabelX - 18;
    const houseY = BAR_Y;
    houseGfx.fillTriangle(houseX + 6, houseY, houseX, houseY + 6, houseX + 12, houseY + 6);
    houseGfx.fillRect(houseX + 2, houseY + 6, 8, 8);
    this.container.add(houseGfx);

    this.baseHpLabel = scene.add.text(baseLabelX, BAR_Y + BAR_H / 2, 'BASE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#9A9A9A',
    }).setOrigin(1, 0.5);
    this.container.add(this.baseHpLabel);

    this.baseHpBarBg = scene.add.graphics();
    this.baseHpBarBg.lineStyle(1, 0x555555, 1);
    this.baseHpBarBg.fillStyle(0x1a1a1a);
    this.baseHpBarBg.fillRect(baseBarX, BAR_Y, baseBarW, BAR_H);
    this.baseHpBarBg.strokeRect(baseBarX, BAR_Y, baseBarW, BAR_H);
    this.container.add(this.baseHpBarBg);

    this.baseHpBar = scene.add.graphics();
    this.container.add(this.baseHpBar);
    this.updateBaseHpBar(200, 200);
    this.updateHpBar(100, 100);
  }

  // ---------------------------------------------------------------------------
  // BUILD: bottom HUD -- two weapon rows
  // ---------------------------------------------------------------------------
  private buildBottomHud(): void {
    const scene = this.scene;
    const barY = GAME_HEIGHT - BOTTOM_H;

    const bottomBg = scene.add.graphics();
    bottomBg.fillStyle(PANEL_COLOR, PANEL_ALPHA);
    bottomBg.fillRect(0, barY, GAME_WIDTH, BOTTOM_H);
    bottomBg.lineStyle(1, BORDER_COLOR, 0.8);
    bottomBg.strokeRect(0, barY, GAME_WIDTH, BOTTOM_H);
    this.container.add(bottomBg);

    // ---- Weapon 1 row (top row) ----------------------------------------
    const row1Y = barY + WEAPON1_ROW_Y;
    const weapX = 8;

    // Slot label [1]
    this.weapon1SlotLabel = scene.add.text(weapX, row1Y + 2, '[1]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#FFD700',
    }).setOrigin(0, 0);
    this.container.add(this.weapon1SlotLabel);

    const weapNameX = weapX + 24;

    // Primary weapon name
    this.weapon1Text = scene.add.text(weapNameX, row1Y + 2, '--', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#E8DCC8',
    }).setOrigin(0, 0);
    this.container.add(this.weapon1Text);

    // Primary durability bar (below name)
    this.weapon1DurBarBg = scene.add.graphics();
    this.weapon1DurBarBg.lineStyle(1, 0x444444, 1);
    this.weapon1DurBarBg.fillStyle(0x1a1a1a);
    this.weapon1DurBarBg.fillRect(weapNameX, row1Y + 13, DUR_BAR_W, 5);
    this.weapon1DurBarBg.strokeRect(weapNameX, row1Y + 13, DUR_BAR_W, 5);
    this.container.add(this.weapon1DurBarBg);

    this.weapon1DurBar = scene.add.graphics();
    this.container.add(this.weapon1DurBar);

    // Special effect label for primary
    this.weapon1EffectText = scene.add.text(weapNameX + DUR_BAR_W + 6, row1Y + 13, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#c77dff',
    }).setOrigin(0, 0);
    this.container.add(this.weapon1EffectText);

    // Ultimate glow: gold border around weapon 1 row -- hidden by default
    this.weapon1UltiGlow = scene.add.graphics();
    this.weapon1UltiGlow.setVisible(false);
    this.container.add(this.weapon1UltiGlow);

    // ---- Weapon 2 row (bottom row) ------------------------------------
    const row2Y = barY + WEAPON2_ROW_Y;

    // Slot label [2]
    this.weapon2SlotLabel = scene.add.text(weapX, row2Y + 2, '[2]', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#9A9A9A',
    }).setOrigin(0, 0);
    this.container.add(this.weapon2SlotLabel);

    // Secondary weapon name
    this.weapon2Text = scene.add.text(weapNameX, row2Y + 2, '--', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#6B6B6B',
    }).setOrigin(0, 0);
    this.container.add(this.weapon2Text);

    // Secondary durability bar
    this.weapon2DurBarBg = scene.add.graphics();
    this.weapon2DurBarBg.lineStyle(1, 0x333333, 1);
    this.weapon2DurBarBg.fillStyle(0x1a1a1a);
    this.weapon2DurBarBg.fillRect(weapNameX, row2Y + 13, DUR_BAR_W, 4);
    this.weapon2DurBarBg.strokeRect(weapNameX, row2Y + 13, DUR_BAR_W, 4);
    this.container.add(this.weapon2DurBarBg);

    this.weapon2DurBar = scene.add.graphics();
    this.container.add(this.weapon2DurBar);

    // ---- AMMO section (right area) ------------------------------------
    const ammoSectionX = GAME_WIDTH - 230;
    const ammoCenterY = barY + BOTTOM_H / 2;

    if (scene.textures.exists('icon_ammo')) {
      const ammoIcon = scene.add.image(ammoSectionX, ammoCenterY, 'icon_ammo')
        .setOrigin(0, 0.5)
        .setDisplaySize(ICON_SIZE, ICON_SIZE);
      this.container.add(ammoIcon);
    } else {
      const ammoLabel = scene.add.text(ammoSectionX, ammoCenterY, 'AMMO:', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#9A9A9A',
      }).setOrigin(0, 0.5);
      this.container.add(ammoLabel);
    }

    this.ammoText = scene.add.text(ammoSectionX + ICON_SIZE + 4, ammoCenterY, '0', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#FFD700',
    }).setOrigin(0, 0.5);
    this.container.add(this.ammoText);

    // ---- Kills section (far right) ------------------------------------
    const killSectionX = GAME_WIDTH - 110;

    if (scene.textures.exists('icon_skull')) {
      const skullIcon = scene.add.image(killSectionX, ammoCenterY, 'icon_skull')
        .setOrigin(0, 0.5)
        .setDisplaySize(ICON_SIZE, ICON_SIZE);
      this.container.add(skullIcon);
    } else {
      const killLabel = scene.add.text(killSectionX, ammoCenterY, 'KILLS:', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#9A9A9A',
      }).setOrigin(0, 0.5);
      this.container.add(killLabel);
    }

    this.killText = scene.add.text(killSectionX + ICON_SIZE + 4, ammoCenterY, '0', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#E8DCC8',
    }).setOrigin(0, 0.5);
    this.container.add(this.killText);
  }

  // ---------------------------------------------------------------------------
  // BUILD: wave announcement popup
  // ---------------------------------------------------------------------------
  private buildWaveAnnouncement(): void {
    const scene = this.scene;

    this.waveAnnouncementBg = scene.add.graphics();
    this.waveAnnouncementBg.setAlpha(0);
    this.container.add(this.waveAnnouncementBg);

    this.waveAnnouncementText = scene.add.text(GAME_WIDTH / 2, 200, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '16px',
      color: '#D4620B',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0);
    this.container.add(this.waveAnnouncementText);
  }

  // ---------------------------------------------------------------------------
  // UPDATE METHODS
  // ---------------------------------------------------------------------------

  updateHpBar(hp: number, maxHp: number): void {
    this.hpBar.clear();
    const ratio = maxHp > 0 ? hp / maxHp : 0;
    const color = ratio > 0.5 ? 0x4CAF50 : ratio > 0.25 ? 0xFFD700 : 0xF44336;
    this.hpBar.fillStyle(color);

    const hpBarX = 8 + ICON_SIZE + 4;
    const hpBarW = 150;
    this.hpBar.fillRect(hpBarX, BAR_Y, hpBarW * ratio, BAR_H);

    this.hpText.setText(`HP: ${Math.max(0, Math.ceil(hp))}/${maxHp}`);
    const textColor = ratio > 0.5 ? '#cccccc' : ratio > 0.25 ? '#FFD700' : '#F44336';
    this.hpText.setColor(textColor);
  }

  flashHpBar(): void {
    this.hpBar.setAlpha(0.3);
    this.scene.tweens.add({
      targets: this.hpBar,
      alpha: 1,
      duration: 250,
      ease: 'Power2',
    });
  }

  updateBaseHpBar(hp: number, maxHp: number): void {
    const baseBarW = 120;
    const baseBarX = GAME_WIDTH - 8 - baseBarW;

    this.baseHpBar.clear();
    const ratio = maxHp > 0 ? hp / maxHp : 0;
    const color = ratio > 0.5 ? 0x4CAF50 : ratio > 0.25 ? 0xFFD700 : 0xF44336;
    this.baseHpBar.fillStyle(color);
    this.baseHpBar.fillRect(baseBarX, BAR_Y, baseBarW * ratio, BAR_H);
  }

  updateStaminaBar(stamina: number, maxStamina: number): void {
    this.staminaBar.clear();
    const ratio = maxStamina > 0 ? stamina / maxStamina : 0;
    this.staminaBar.fillStyle(0x4A90D9);
    const staminaBarX = 8 + ICON_SIZE + 4;
    this.staminaBar.fillRect(staminaBarX, STAMINA_Y, 100 * ratio, STAMINA_H);
  }

  /** Set the night number displayed in the main header. */
  setNight(night: number, maxNights: number = 5): void {
    this.waveText.setText(`Night ${night} / ${maxNights}`);
  }

  /** Update wave + enemy count sub-line. */
  updateWave(wave: number, maxWaves: number = 5): void {
    this.waveSubText.setText(`Wave ${wave}/${maxWaves}`);
  }

  /** Update live enemy counter in the wave sub-line. */
  updateEnemyCount(alive: number, wave: number, maxWaves: number): void {
    const enemyStr = alive > 0 ? `${alive} left` : 'cleared!';
    this.waveSubText.setText(`Wave ${wave}/${maxWaves}  --  ${enemyStr}`);
  }

  updateKills(kills: number): void {
    this.killText.setText(`${kills}`);
  }

  /**
   * Update primary weapon display (slot 1).
   * Called whenever the active weapon changes or its stats change.
   * weaponLevel: if >= 5, shows gold ultimate glow around the weapon row.
   */
  updateWeapon(
    name: string,
    durability: number,
    maxDurability: number,
    specialEffect?: WeaponSpecialEffect | null,
    weaponLevel?: number
  ): void {
    this.weapon1Text.setText(name);
    this.weapon1Text.setColor(durability <= 0 ? '#F44336' : '#E8DCC8');

    const barY = GAME_HEIGHT - BOTTOM_H + WEAPON1_ROW_Y;
    const weapNameX = 8 + 24;

    this.weapon1DurBar.clear();
    const ratio = maxDurability > 0 ? durability / maxDurability : 0;
    const durColor = ratio > 0.5 ? 0x4CAF50 : ratio > 0.25 ? 0xFFD700 : 0xF44336;
    this.weapon1DurBar.fillStyle(durColor);
    this.weapon1DurBar.fillRect(weapNameX, barY + 13, DUR_BAR_W * ratio, 5);

    if (specialEffect) {
      const pct = Math.round(specialEffect.chance * 100);
      this.weapon1EffectText.setText(`${specialEffect.type.toUpperCase()} ${pct}%`);
    } else {
      this.weapon1EffectText.setText('');
    }

    // Ultimate glow: draw gold border around the weapon 1 row when Lv5
    const isUltimate = (weaponLevel ?? 0) >= 5;
    this.weapon1UltiGlow.setVisible(isUltimate);
    if (isUltimate) {
      this.weapon1UltiGlow.clear();
      this.weapon1UltiGlow.lineStyle(2, 0xFFD700, 0.85);
      this.weapon1UltiGlow.strokeRect(4, GAME_HEIGHT - BOTTOM_H + 2, 210, BOTTOM_H / 2 - 4);
    }
  }

  /**
   * Update secondary weapon display (slot 2).
   * Call with null name to show empty slot.
   */
  updateSecondaryWeapon(
    name: string | null,
    durability: number = 0,
    maxDurability: number = 1,
  ): void {
    if (name === null) {
      this.weapon2Text.setText('--');
      this.weapon2Text.setColor('#444444');
      this.weapon2DurBar.clear();
      return;
    }

    this.weapon2Text.setText(name);
    this.weapon2Text.setColor(durability <= 0 ? '#F44336' : '#9A9A9A');

    const row2Y = GAME_HEIGHT - BOTTOM_H + WEAPON2_ROW_Y;
    const weapNameX = 8 + 24;

    this.weapon2DurBar.clear();
    const ratio = maxDurability > 0 ? durability / maxDurability : 0;
    const durColor = ratio > 0.5 ? 0x4CAF50 : ratio > 0.25 ? 0xFFD700 : 0xF44336;
    this.weapon2DurBar.fillStyle(durColor);
    this.weapon2DurBar.fillRect(weapNameX, row2Y + 13, DUR_BAR_W * ratio, 4);
  }

  /**
   * Highlight which slot is currently active (1 or 2).
   * Active slot label turns gold, inactive turns grey.
   */
  setActiveSlot(slot: 1 | 2): void {
    this.weapon1SlotLabel.setColor(slot === 1 ? '#FFD700' : '#6B6B6B');
    this.weapon1Text.setColor(slot === 1 ? '#E8DCC8' : '#6B6B6B');
    this.weapon2SlotLabel.setColor(slot === 2 ? '#FFD700' : '#6B6B6B');
    this.weapon2Text.setColor(slot === 2 ? '#9A9A9A' : '#555555');
  }

  updateAmmo(ammo: number): void {
    this.ammoText.setText(`${ammo}`);
    this.ammoText.setColor(ammo <= 0 ? '#F44336' : ammo <= 5 ? '#FF8C00' : '#FFD700');
  }

  showWaveAnnouncement(wave: number): void {
    const text = `WAVE ${wave}`;
    this.waveAnnouncementText.setText(text);
    this.waveAnnouncementText.setAlpha(1);
    this.waveAnnouncementText.setScale(1);

    this.waveAnnouncementBg.clear();
    const bounds = this.waveAnnouncementText.getBounds();
    const pad = 10;
    this.waveAnnouncementBg.fillStyle(0x000000, 0.65);
    this.waveAnnouncementBg.fillRoundedRect(
      bounds.x - pad, bounds.y - pad,
      bounds.width + pad * 2, bounds.height + pad * 2,
      6
    );
    this.waveAnnouncementBg.lineStyle(1, 0x555555, 0.8);
    this.waveAnnouncementBg.strokeRoundedRect(
      bounds.x - pad, bounds.y - pad,
      bounds.width + pad * 2, bounds.height + pad * 2,
      6
    );
    this.waveAnnouncementBg.setAlpha(1);

    this.scene.tweens.add({
      targets: this.waveAnnouncementText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 150,
      ease: 'Quad.easeOut',
      yoyo: true,
    });

    this.scene.tweens.add({
      targets: [this.waveAnnouncementText, this.waveAnnouncementBg],
      alpha: 0,
      delay: 2000,
      duration: 1500,
      ease: 'Power2',
    });
  }

  showMessage(text: string): void {
    this.waveAnnouncementText.setText(text);
    this.waveAnnouncementText.setAlpha(1);
    this.waveAnnouncementText.setScale(1);

    this.waveAnnouncementBg.clear();
    const bounds = this.waveAnnouncementText.getBounds();
    const pad = 10;
    this.waveAnnouncementBg.fillStyle(0x000000, 0.65);
    this.waveAnnouncementBg.fillRoundedRect(
      bounds.x - pad, bounds.y - pad,
      bounds.width + pad * 2, bounds.height + pad * 2,
      6
    );
    this.waveAnnouncementBg.lineStyle(1, 0x555555, 0.8);
    this.waveAnnouncementBg.strokeRoundedRect(
      bounds.x - pad, bounds.y - pad,
      bounds.width + pad * 2, bounds.height + pad * 2,
      6
    );
    this.waveAnnouncementBg.setAlpha(1);

    this.scene.tweens.add({
      targets: [this.waveAnnouncementText, this.waveAnnouncementBg],
      alpha: 0,
      delay: 2500,
      duration: 1500,
      ease: 'Power2',
    });
  }
}
