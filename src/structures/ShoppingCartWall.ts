import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

/**
 * Shopping Cart Wall -- tipped-over shopping carts stacked as a cheap barrier.
 * Passive blocker: blocks zombies (physics body added by NightScene via wallBodies group).
 * 80 HP. Brutes can destroy it over time.
 *
 * Note: this is identical in function to CartWall (cart_wall) but with a
 * different appearance and placement cost. Cart_wall is the same thing in
 * structures.json under a slightly different name ("Cart Wall"). This class
 * implements the "Shopping Cart Wall" from the tier 2-3 catalog entry #30.
 */
export class ShoppingCartWall extends Phaser.GameObjects.Graphics {
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

    const hpRatio = this.structureInstance.hp / 80;

    // Rusty metal background
    this.fillStyle(0x2A1A0A);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const cartColor = hpRatio > 0.4 ? 0xBB8844 : 0x775522;

    // Three stacked/tipped carts in a messy pile
    this.lineStyle(2, cartColor);

    // Cart 1 (tipped forward-left)
    this.strokeRect(3, 12, 11, 10);
    this.lineBetween(3, 16, 14, 16); // basket divider
    this.lineBetween(5, 22, 4, 27);  // wheel 1
    this.lineBetween(11, 22, 12, 27); // wheel 2
    this.lineBetween(3, 12, 14, 12);  // handle bar

    // Cart 2 (behind, slightly rotated)
    this.strokeRect(17, 9, 11, 10);
    this.lineBetween(17, 13, 28, 13);
    this.lineBetween(19, 19, 18, 24);
    this.lineBetween(26, 19, 27, 24);
    this.lineBetween(17, 9, 28, 9);

    // Cart 3 fragment (crushed at back)
    this.lineStyle(1, cartColor, 0.65);
    this.strokeRect(8, 4, 16, 7);
    this.lineBetween(8, 7, 24, 7);

    // Scattered debris
    this.fillStyle(cartColor, 0.5);
    this.fillRect(1, 28, 4, 2);
    this.fillRect(25, 26, 5, 2);
    this.fillRect(12, 3, 3, 2);

    // Cracks when damaged
    if (hpRatio < 0.5) {
      this.lineStyle(1, 0x111111, 0.7);
      this.lineBetween(6, 15, 12, 20);
      this.lineBetween(19, 11, 22, 17);
      this.fillStyle(0x000000, 0.25);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    }

    // Border
    this.lineStyle(1, 0xE8DCC8, 0.25);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  takeDamage(amount: number): boolean {
    this.structureInstance.hp -= amount;
    if (this.structureInstance.hp <= 0) {
      this.structureInstance.hp = 0;
      this.destroy();
      return true;
    }
    this.draw();
    return false;
  }

  isAlive(): boolean {
    return this.active && this.structureInstance.hp > 0;
  }
}
