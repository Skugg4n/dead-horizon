import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

const COLOR = 0x8B6914;

/**
 * Barricade -- slows enemies that pass through it.
 * Rendered as a brown wooden fence graphic.
 */
export class Barricade extends Phaser.GameObjects.Graphics {
  public structureInstance: StructureInstance;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(scene);
    this.structureInstance = instance;

    this.setPosition(instance.x, instance.y);
    this.draw();

    scene.add.existing(this);
  }

  private draw(): void {
    this.clear();
    this.fillStyle(COLOR);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Horizontal slats to indicate barricade
    this.lineStyle(2, 0xA07820);
    this.lineBetween(2, 8, TILE_SIZE - 2, 8);
    this.lineBetween(2, TILE_SIZE / 2, TILE_SIZE - 2, TILE_SIZE / 2);
    this.lineBetween(2, TILE_SIZE - 8, TILE_SIZE - 2, TILE_SIZE - 8);

    this.lineStyle(1, 0xE8DCC8, 0.4);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  /** Slow factor applied to enemies passing through (0.5 = half speed) */
  getSlowFactor(): number {
    // Scales slightly with level
    return 0.5 - (this.structureInstance.level - 1) * 0.1;
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
