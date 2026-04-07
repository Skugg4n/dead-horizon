import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

/**
 * Car Wreck Barrier -- a smashed vehicle used as a road block.
 * Passive blocker: blocks zombies (physics body added by NightScene via wallBodies group).
 * 300 HP -- the toughest passive barrier.
 * Costs 10 scrap.
 */
export class CarWreckBarrier extends Phaser.GameObjects.Graphics {
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

    const maxHp = 300;
    const hpRatio = this.structureInstance.hp / maxHp;

    // Wrecked car body (dark rust)
    const bodyColor = hpRatio > 0.5 ? 0x5A3A2A : 0x3A2A1A;
    this.fillStyle(bodyColor);
    this.fillRect(2, 8, TILE_SIZE - 4, TILE_SIZE - 14);

    // Windshield remnants
    this.fillStyle(0x334455, 0.5);
    this.fillRect(5, 9, TILE_SIZE - 10, 7);

    // Shattered glass streaks
    this.lineStyle(1, 0x889AA8, 0.7);
    this.lineBetween(6, 9, 14, 15);
    this.lineBetween(20, 10, 15, 15);
    this.lineBetween(11, 9, 11, 16);

    // Car roof crumple
    this.fillStyle(0x4A2A1A);
    this.fillRect(6, 5, TILE_SIZE - 12, 5);

    // Wheels (flattened)
    this.fillStyle(0x111111);
    this.fillRect(0, 20, 4, 6);   // front-left wheel
    this.fillRect(TILE_SIZE - 4, 20, 4, 6); // front-right wheel
    this.fillRect(0, TILE_SIZE - 10, 4, 6);   // rear-left wheel
    this.fillRect(TILE_SIZE - 4, TILE_SIZE - 10, 4, 6); // rear-right wheel

    // Rust spots
    this.fillStyle(0x8B4513, 0.6);
    this.fillRect(8, 14, 4, 3);
    this.fillRect(18, 18, 5, 2);
    this.fillRect(10, 22, 3, 3);

    // Exhaust hole
    this.fillStyle(0x1A0A00);
    this.fillCircle(TILE_SIZE - 5, TILE_SIZE - 6, 2);

    // Heavy damage: broken frame, dark gashes
    if (hpRatio < 0.4) {
      this.lineStyle(2, 0x1A0A00, 0.8);
      this.lineBetween(3, 12, TILE_SIZE - 3, 12);
      this.lineBetween(TILE_SIZE / 2, 8, TILE_SIZE / 2, TILE_SIZE - 6);
      this.fillStyle(0x000000, 0.35);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    }

    // HP bar on the left edge
    const barH = Math.round(TILE_SIZE * hpRatio);
    this.fillStyle(0x44AA44, 0.45);
    this.fillRect(0, TILE_SIZE - barH, 3, barH);

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
