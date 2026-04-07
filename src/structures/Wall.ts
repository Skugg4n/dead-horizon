import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

const COLOR = 0x6B6B6B;

/**
 * Wall -- blocks enemy movement entirely. Has high HP.
 * Rendered as a solid grey block with brick pattern.
 */
export class Wall extends Phaser.GameObjects.Graphics {
  public structureInstance: StructureInstance;

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
      const img = this.scene.add.image(this.x + TILE_SIZE / 2, this.y + TILE_SIZE / 2, 'struct_wall');
      img.setDisplaySize(TILE_SIZE, TILE_SIZE);
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
    return false;
  }
}
