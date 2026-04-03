import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

/**
 * Shopping Cart Wall -- a pile of shopping carts used as a cheap barrier.
 *
 * Passive structure: blocks zombies (via physics body added by NightScene).
 * 80 HP, no cooldown, no overheat, no malfunction.
 * Brutes can damage it over time.
 */
export class CartWall extends Phaser.GameObjects.Graphics {
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

    // Rusty metal background
    this.fillStyle(0x3A2A1A);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;

    // Cart outlines -- draw 2-3 overlapping cart silhouettes
    this.lineStyle(2, 0xAA8855);

    // Left cart
    this.strokeRect(2, 10, 12, 14);
    this.lineBetween(2, 14, 14, 14); // basket divider
    this.lineBetween(4, 24, 3, 28);  // front wheel
    this.lineBetween(12, 24, 13, 28); // back wheel

    // Right cart (offset)
    this.strokeRect(16, 8, 12, 14);
    this.lineBetween(16, 12, 28, 12);
    this.lineBetween(18, 22, 17, 26);
    this.lineBetween(26, 22, 27, 26);

    // Handle rails
    this.lineStyle(1, 0xCC9966);
    this.lineBetween(2, 10, 14, 10);  // left handle
    this.lineBetween(16, 8, 28, 8);   // right handle

    // HP damage tint (lighter when nearly destroyed)
    const hpRatio = this.structureInstance.hp / 80;
    if (hpRatio < 0.5) {
      // Cracks: darker overlay
      this.fillStyle(0x000000, 0.3);
      this.fillRect(mid - 4, mid - 4, 8, 8);
    }

    // Border
    this.lineStyle(1, 0xE8DCC8, 0.3);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  /**
   * Take damage from brutes or other sources.
   * Returns true if the wall is destroyed.
   */
  takeDamage(amount: number): boolean {
    this.structureInstance.hp -= amount;
    if (this.structureInstance.hp <= 0) {
      this.structureInstance.hp = 0;
      this.destroy();
      return true;
    }
    // Redraw to reflect damage state
    this.draw();
    return false;
  }

  isAlive(): boolean {
    return this.active && this.structureInstance.hp > 0;
  }
}
