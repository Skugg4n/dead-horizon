import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import { WeaponSpecialEffect } from '../config/types';

// Layout constants
const TOP_H = 44;         // height of top HUD bar
const BOTTOM_H = 36;      // height of bottom HUD bar
const BAR_Y = 9;          // y of HP/base bars inside top bar
const BAR_H = 14;         // height of HP/base bar fill
const STAMINA_Y = 27;     // y of stamina bar inside top bar
const STAMINA_H = 7;      // height of stamina bar
const ICON_SIZE = 14;     // display size for sprite icons
const PANEL_ALPHA = 0.62; // background panel alpha
const PANEL_COLOR = 0x0a0a0a;
const BORDER_COLOR = 0x333333;

export class HUD {
  private scene: Phaser.Scene;

  // Top HUD elements -- assigned in buildTopHud(), called from constructor
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;

  private staminaBar!: Phaser.GameObjects.Graphics;
  private staminaBarBg!: Phaser.GameObjects.Graphics;

  private wavePanel!: Phaser.GameObjects.Graphics;
  private waveText!: Phaser.GameObjects.Text;

  private baseHpBar!: Phaser.GameObjects.Graphics;
  private baseHpBarBg!: Phaser.GameObjects.Graphics;
  private baseHpLabel!: Phaser.GameObjects.Text;

  // Bottom HUD elements -- assigned in buildBottomHud(), called from constructor
  private weaponText!: Phaser.GameObjects.Text;
  private weaponDurBar!: Phaser.GameObjects.Graphics;
  private weaponDurBarBg!: Phaser.GameObjects.Graphics;
  private weaponEffectText!: Phaser.GameObjects.Text;
  private ammoText!: Phaser.GameObjects.Text;
  private killText!: Phaser.GameObjects.Text;

  // Wave announcement (centered popup) -- assigned in buildWaveAnnouncement()
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

    // Full-width dark top panel with thin border line
    const topBg = scene.add.graphics();
    topBg.fillStyle(PANEL_COLOR, PANEL_ALPHA);
    topBg.fillRect(0, 0, GAME_WIDTH, TOP_H);
    topBg.lineStyle(1, BORDER_COLOR, 0.8);
    topBg.strokeRect(0, 0, GAME_WIDTH, TOP_H);
    this.container.add(topBg);

    // ---- HP section (left side) ----------------------------------------
    const hpSectionX = 8;
    const hpBarX = hpSectionX + ICON_SIZE + 4; // bar starts after icon
    const hpBarW = 150;

    // Heart icon
    if (scene.textures.exists('icon_heart')) {
      const heartIcon = scene.add.image(hpSectionX, BAR_Y + BAR_H / 2, 'icon_heart')
        .setOrigin(0, 0.5)
        .setDisplaySize(ICON_SIZE, ICON_SIZE);
      this.container.add(heartIcon);
    }

    // HP bar background with border
    this.hpBarBg = scene.add.graphics();
    this.hpBarBg.lineStyle(1, 0x555555, 1);
    this.hpBarBg.fillStyle(0x1a1a1a);
    this.hpBarBg.fillRect(hpBarX, BAR_Y, hpBarW, BAR_H);
    this.hpBarBg.strokeRect(hpBarX, BAR_Y, hpBarW, BAR_H);
    this.container.add(this.hpBarBg);

    // HP bar fill (redrawn on updateHpBar)
    this.hpBar = scene.add.graphics();
    this.container.add(this.hpBar);

    // HP numeric label ("HP: 100/100") -- minimum 8px for legibility
    this.hpText = scene.add.text(hpBarX + hpBarW + 5, BAR_Y + BAR_H / 2, 'HP: 100/100', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#cccccc',
    }).setOrigin(0, 0.5);
    this.container.add(this.hpText);

    // ---- Stamina section (below HP) ------------------------------------
    const staminaSectionX = hpSectionX;
    const staminaBarX = staminaSectionX + ICON_SIZE + 4;
    const staminaBarW = 100;

    // Lightning bolt icon drawn programmatically (no dedicated sprite)
    const boltGfx = scene.add.graphics();
    boltGfx.fillStyle(0x4A90D9, 1);
    // Simple triangle-bolt shape: two triangles
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

    // Stamina bar background
    this.staminaBarBg = scene.add.graphics();
    this.staminaBarBg.lineStyle(1, 0x444444, 1);
    this.staminaBarBg.fillStyle(0x1a1a1a);
    this.staminaBarBg.fillRect(staminaBarX, STAMINA_Y, staminaBarW, STAMINA_H);
    this.staminaBarBg.strokeRect(staminaBarX, STAMINA_Y, staminaBarW, STAMINA_H);
    this.container.add(this.staminaBarBg);

    // Stamina bar fill
    this.staminaBar = scene.add.graphics();
    this.container.add(this.staminaBar);
    this.updateStaminaBar(100, 100);

    // ---- Wave panel (centered) -----------------------------------------
    // Background panel -- width adapts to content but fixed here
    const wavePanelW = 140;
    const wavePanelH = TOP_H - 8;
    const wavePanelX = (GAME_WIDTH - wavePanelW) / 2;

    this.wavePanel = scene.add.graphics();
    this.wavePanel.fillStyle(0x111111, 0.75);
    this.wavePanel.lineStyle(1, 0x555555, 1);
    this.wavePanel.fillRoundedRect(wavePanelX, 4, wavePanelW, wavePanelH, 6);
    this.wavePanel.strokeRoundedRect(wavePanelX, 4, wavePanelW, wavePanelH, 6);
    this.container.add(this.wavePanel);

    this.waveText = scene.add.text(GAME_WIDTH / 2, TOP_H / 2, 'Wave 1/5', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '10px',
      color: '#FFFFFF',
    }).setOrigin(0.5, 0.5);
    this.container.add(this.waveText);

    // ---- Base HP section (right side) ----------------------------------
    const baseBarW = 120;
    // Position so the right edge sits 8px from the screen edge
    const baseBarX = GAME_WIDTH - 8 - baseBarW;
    const baseLabelX = baseBarX - 4;

    // Small house icon drawn programmatically
    const houseGfx = scene.add.graphics();
    houseGfx.fillStyle(0x9A9A9A, 1);
    const houseX = baseLabelX - 18;
    const houseY = BAR_Y;
    // Roof triangle
    houseGfx.fillTriangle(houseX + 6, houseY, houseX, houseY + 6, houseX + 12, houseY + 6);
    // Body rectangle
    houseGfx.fillRect(houseX + 2, houseY + 6, 8, 8);
    this.container.add(houseGfx);

    // "BASE" label -- 9px ensures the font renders cleanly at all scale factors
    this.baseHpLabel = scene.add.text(baseLabelX, BAR_Y + BAR_H / 2, 'BASE', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#9A9A9A',
    }).setOrigin(1, 0.5);
    this.container.add(this.baseHpLabel);

    // Base HP bar background
    this.baseHpBarBg = scene.add.graphics();
    this.baseHpBarBg.lineStyle(1, 0x555555, 1);
    this.baseHpBarBg.fillStyle(0x1a1a1a);
    this.baseHpBarBg.fillRect(baseBarX, BAR_Y, baseBarW, BAR_H);
    this.baseHpBarBg.strokeRect(baseBarX, BAR_Y, baseBarW, BAR_H);
    this.container.add(this.baseHpBarBg);

    // Base HP bar fill
    this.baseHpBar = scene.add.graphics();
    this.container.add(this.baseHpBar);
    this.updateBaseHpBar(200, 200);

    // Initial HP bar draw
    this.updateHpBar(100, 100);
  }

  // ---------------------------------------------------------------------------
  // BUILD: bottom HUD
  // ---------------------------------------------------------------------------
  private buildBottomHud(): void {
    const scene = this.scene;
    const barY = GAME_HEIGHT - BOTTOM_H;

    // Full-width dark bottom panel with border
    const bottomBg = scene.add.graphics();
    bottomBg.fillStyle(PANEL_COLOR, PANEL_ALPHA);
    bottomBg.fillRect(0, barY, GAME_WIDTH, BOTTOM_H);
    bottomBg.lineStyle(1, BORDER_COLOR, 0.8);
    bottomBg.strokeRect(0, barY, GAME_WIDTH, BOTTOM_H);
    this.container.add(bottomBg);

    const centerY = barY + BOTTOM_H / 2;

    // ---- Weapon section (left) ----------------------------------------
    const weapX = 10;

    // Weapon name text -- rendered in the dark bottom HUD panel; 8px minimum
    this.weaponText = scene.add.text(weapX, centerY - 8, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#E8DCC8',
    }).setOrigin(0, 0.5);
    this.container.add(this.weaponText);

    // Weapon durability bar (small, below name)
    const durBarW = 80;
    this.weaponDurBarBg = scene.add.graphics();
    this.weaponDurBarBg.lineStyle(1, 0x444444, 1);
    this.weaponDurBarBg.fillStyle(0x1a1a1a);
    this.weaponDurBarBg.fillRect(weapX, centerY + 4, durBarW, 5);
    this.weaponDurBarBg.strokeRect(weapX, centerY + 4, durBarW, 5);
    this.container.add(this.weaponDurBarBg);

    this.weaponDurBar = scene.add.graphics();
    this.container.add(this.weaponDurBar);

    // Special effect label (right of weapon area) -- minimum 8px for legibility
    this.weaponEffectText = scene.add.text(weapX + durBarW + 6, centerY + 4, '', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '8px',
      color: '#c77dff',
    }).setOrigin(0, 0.5);
    this.container.add(this.weaponEffectText);

    // ---- Ammo section (right area) -------------------------------------
    const ammoSectionX = GAME_WIDTH - 250;

    if (scene.textures.exists('icon_ammo')) {
      const ammoIcon = scene.add.image(ammoSectionX, centerY, 'icon_ammo')
        .setOrigin(0, 0.5)
        .setDisplaySize(ICON_SIZE, ICON_SIZE);
      this.container.add(ammoIcon);
    } else {
      // Fallback text label -- 8px minimum for legibility
      const ammoLabel = scene.add.text(ammoSectionX, centerY, 'AMMO', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#9A9A9A',
      }).setOrigin(0, 0.5);
      this.container.add(ammoLabel);
    }

    this.ammoText = scene.add.text(ammoSectionX + ICON_SIZE + 4, centerY, '0', {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '9px',
      color: '#FFD700',
    }).setOrigin(0, 0.5);
    this.container.add(this.ammoText);

    // ---- Kills section (far right) -------------------------------------
    const killSectionX = GAME_WIDTH - 110;

    if (scene.textures.exists('icon_skull')) {
      const skullIcon = scene.add.image(killSectionX, centerY, 'icon_skull')
        .setOrigin(0, 0.5)
        .setDisplaySize(ICON_SIZE, ICON_SIZE);
      this.container.add(skullIcon);
    } else {
      const killLabel = scene.add.text(killSectionX, centerY, 'KILLS', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '8px',
        color: '#9A9A9A',
      }).setOrigin(0, 0.5);
      this.container.add(killLabel);
    }

    this.killText = scene.add.text(killSectionX + ICON_SIZE + 4, centerY, '0', {
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

    // Wave announcement rendered directly on the game world -- needs stroke for readability
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
    // Green -> yellow -> red gradient based on remaining HP
    const color = ratio > 0.5 ? 0x4CAF50 : ratio > 0.25 ? 0xFFD700 : 0xF44336;
    this.hpBar.fillStyle(color);

    const hpBarX = 8 + ICON_SIZE + 4;
    const hpBarW = 150;
    this.hpBar.fillRect(hpBarX, BAR_Y, hpBarW * ratio, BAR_H);

    // Update text label
    this.hpText.setText(`HP: ${Math.ceil(hp)}/${maxHp}`);
    const textColor = ratio > 0.5 ? '#cccccc' : ratio > 0.25 ? '#FFD700' : '#F44336';
    this.hpText.setColor(textColor);
  }

  /**
   * Flash the HP bar briefly to signal player damage.
   * Drops alpha to 0.3 then fades back to 1.
   */
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

  updateWave(wave: number, maxWaves: number = 5): void {
    this.waveText.setText(`Wave ${wave}/${maxWaves}`);
  }

  updateKills(kills: number): void {
    this.killText.setText(`${kills}`);
  }

  /**
   * Update weapon display: name, durability bar, and optional special effect label.
   * specialEffect is optional -- callers that do not pass it show no effect text.
   */
  updateWeapon(
    name: string,
    durability: number,
    maxDurability: number,
    specialEffect?: WeaponSpecialEffect | null
  ): void {
    // Weapon name
    this.weaponText.setText(name);
    this.weaponText.setColor(durability <= 0 ? '#F44336' : '#E8DCC8');

    // Durability fill bar
    const durBarW = 80;
    const centerY = GAME_HEIGHT - BOTTOM_H / 2;
    this.weaponDurBar.clear();
    const ratio = maxDurability > 0 ? durability / maxDurability : 0;
    const durColor = ratio > 0.5 ? 0x4CAF50 : ratio > 0.25 ? 0xFFD700 : 0xF44336;
    this.weaponDurBar.fillStyle(durColor);
    this.weaponDurBar.fillRect(10, centerY + 4, durBarW * ratio, 5);

    // Special effect label (e.g. "BLEED 25%", "KNOCKBACK 30%")
    if (specialEffect) {
      const pct = Math.round(specialEffect.chance * 100);
      this.weaponEffectText.setText(`${specialEffect.type.toUpperCase()} ${pct}%`);
    } else {
      this.weaponEffectText.setText('');
    }
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

    // Draw dark panel behind announcement text
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

    // Scale-up pop animation
    this.scene.tweens.add({
      targets: this.waveAnnouncementText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 150,
      ease: 'Quad.easeOut',
      yoyo: true,
    });

    // Fade out after animation
    this.scene.tweens.add({
      targets: [this.waveAnnouncementText, this.waveAnnouncementBg],
      alpha: 0,
      delay: 300,
      duration: 2000,
      ease: 'Power2',
    });
  }

  showMessage(text: string): void {
    this.waveAnnouncementText.setText(text);
    this.waveAnnouncementText.setAlpha(1);
    this.waveAnnouncementText.setScale(1);

    // Draw dark panel behind message
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
      duration: 2500,
      ease: 'Power2',
    });
  }
}
