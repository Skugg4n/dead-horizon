import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

const COLOR = 0xCC3333;

/**
 * Trap -- damages enemies that walk over it.
 * Rendered as a red-tinted tile with spike pattern.
 * trapDamage value comes from structures.json.
 */
export class Trap extends Phaser.GameObjects.Graphics {
  public structureInstance: StructureInstance;
  public trapDamage: number;

  constructor(scene: Phaser.Scene, instance: StructureInstance, trapDamage: number) {
    super(scene);
    this.structureInstance = instance;
    this.trapDamage = trapDamage;

    this.setPosition(instance.x, instance.y);
    this.draw();

    scene.add.existing(this);
  }

  private draw(): void {
    this.clear();
    this.fillStyle(0x2D1A1A);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Spike pattern (X marks)
    this.lineStyle(2, COLOR);
    const margin = 6;
    const mid = TILE_SIZE / 2;
    // Top-left spike
    this.lineBetween(margin, margin, mid - 2, mid - 2);
    // Top-right spike
    this.lineBetween(TILE_SIZE - margin, margin, mid + 2, mid - 2);
    // Bottom-left spike
    this.lineBetween(margin, TILE_SIZE - margin, mid - 2, mid + 2);
    // Bottom-right spike
    this.lineBetween(TILE_SIZE - margin, TILE_SIZE - margin, mid + 2, mid + 2);

    this.lineStyle(1, 0xE8DCC8, 0.3);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  getDamage(): number {
    return this.trapDamage;
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
