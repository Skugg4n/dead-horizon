import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

const COLOR = 0x6B6B6B;

/**
 * Wall -- blocks enemy movement entirely. Has high HP.
 * Rendered as a solid grey block with brick pattern.
 *
 * Damage feedback: a small HP bar appears above the wall when damaged,
 * plus a crack overlay scales with HP.
 */
export class Wall extends Phaser.GameObjects.Graphics {
  public structureInstance: StructureInstance;
  private spriteImg: Phaser.GameObjects.Image | null = null;
  private crackGfx: Phaser.GameObjects.Graphics | null = null;
  private hpBar: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(scene);
    this.structureInstance = instance;

    this.setPosition(instance.x, instance.y);
    this.draw();

    scene.add.existing(this);

    // Subtle idle alpha pulse for visual consistency
    scene.tweens.add({
      targets: this,
      alpha: { from: 0.88, to: 1.0 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private draw(): void {
    if (this.scene.textures.exists('struct_wall')) {
      this.spriteImg = this.scene.add.image(this.structureInstance.x + TILE_SIZE / 2, this.structureInstance.y + TILE_SIZE / 2, 'struct_wall');
      this.spriteImg.setDisplaySize(TILE_SIZE, TILE_SIZE);
      return;
    }
    this.clear();
    this.fillStyle(COLOR);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Brick pattern
    this.lineStyle(1, 0x555555);
    this.lineBetween(0, TILE_SIZE / 3, TILE_SIZE, TILE_SIZE / 3);
    this.lineBetween(0, (TILE_SIZE * 2) / 3, TILE_SIZE, (TILE_SIZE * 2) / 3);
    this.lineBetween(TILE_SIZE / 2, 0, TILE_SIZE / 2, TILE_SIZE / 3);
    this.lineBetween(TILE_SIZE / 4, TILE_SIZE / 3, TILE_SIZE / 4, (TILE_SIZE * 2) / 3);
    this.lineBetween((TILE_SIZE * 3) / 4, (TILE_SIZE * 2) / 3, (TILE_SIZE * 3) / 4, TILE_SIZE);

    this.lineStyle(1, 0xE8DCC8, 0.4);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  takeDamage(amount: number): boolean {
    this.structureInstance.hp -= amount;
    if (this.structureInstance.hp <= 0) {
      this.structureInstance.hp = 0;
      this.destroy();
      return true; // destroyed
    }
    this.updateDamageVisuals();
    return false;
  }

  /**
   * Draw an HP bar above the wall and a crack overlay proportional to damage.
   * Both are drawn on their own Graphics so they can be cleared and redrawn
   * cheaply on every hit.
   */
  private updateDamageVisuals(): void {
    const hpRatio = this.structureInstance.hp / this.structureInstance.maxHp;
    const px = this.structureInstance.x;
    const py = this.structureInstance.y;

    // --- HP bar above the wall ---
    if (!this.hpBar) {
      this.hpBar = this.scene.add.graphics();
      this.hpBar.setDepth(6);
    }
    const BAR_W = TILE_SIZE - 6;
    const BAR_H = 3;
    const BAR_X = px + 3;
    const BAR_Y = py - 5;
    this.hpBar.clear();
    // Background
    this.hpBar.fillStyle(0x000000, 0.7);
    this.hpBar.fillRect(BAR_X - 1, BAR_Y - 1, BAR_W + 2, BAR_H + 2);
    // Fill color shifts from green -> yellow -> red
    let fillColor = 0x4CAF50;
    if (hpRatio < 0.66) fillColor = 0xFFC107;
    if (hpRatio < 0.33) fillColor = 0xF44336;
    this.hpBar.fillStyle(fillColor, 1);
    this.hpBar.fillRect(BAR_X, BAR_Y, Math.floor(BAR_W * hpRatio), BAR_H);

    // --- Crack overlay on the wall itself ---
    if (!this.crackGfx) {
      this.crackGfx = this.scene.add.graphics();
      this.crackGfx.setDepth(5);
    }
    this.crackGfx.clear();
    // More cracks at lower HP
    const crackCount = hpRatio < 0.33 ? 5 : hpRatio < 0.66 ? 3 : 1;
    this.crackGfx.lineStyle(1, 0x1A0A04, 0.85);
    for (let i = 0; i < crackCount; i++) {
      const x1 = px + 4 + (i * 7) % (TILE_SIZE - 8);
      const y1 = py + 4;
      const x2 = x1 + ((i % 2 === 0) ? 6 : -4);
      const y2 = py + TILE_SIZE - 4;
      this.crackGfx.lineBetween(x1, y1, x2, y2);
    }
  }

  destroy(fromScene?: boolean): void {
    if (this.spriteImg) this.spriteImg.destroy();
    if (this.crackGfx) this.crackGfx.destroy();
    if (this.hpBar) this.hpBar.destroy();
    super.destroy(fromScene);
  }
}
