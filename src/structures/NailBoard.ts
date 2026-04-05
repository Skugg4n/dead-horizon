import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

/**
 * Nail Board -- a plank studded with nails that damages and cripples zombies.
 * Tier 1 passive trap: no cooldown, no overheat, no mechanical systems.
 *
 * Stats (from structures.json):
 *   - 10 dmg per hit + cripple 2s (-50% speed)
 *   - 30 HP structural durability
 *   - 20 uses before it breaks
 */
export class NailBoard extends Phaser.GameObjects.Graphics {
  public structureInstance: StructureInstance;

  /** Damage per hit (from structures.json). */
  public readonly trapDamage: number;

  /** Cripple duration in ms (from structures.json). */
  public readonly crippleDuration: number;

  /** Remaining uses before the board is destroyed. */
  private usesRemaining: number;

  constructor(
    scene: Phaser.Scene,
    instance: StructureInstance,
    trapDamage: number,
    crippleDuration: number,
    _maxUses: number,
  ) {
    super(scene);
    this.structureInstance = instance;
    this.trapDamage = trapDamage;
    this.crippleDuration = crippleDuration;
    // Store remaining uses in structureInstance.hp so save/load reflects wear
    this.usesRemaining = instance.hp;

    this.setPosition(instance.x, instance.y);
    this.draw();

    scene.add.existing(this);
  }

  private draw(): void {
    this.clear();

    // Worn wooden plank background
    this.fillStyle(0x3D2A0A);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Wood grain lines
    this.lineStyle(1, 0x5A3F12, 0.6);
    for (let i = 4; i < TILE_SIZE; i += 8) {
      this.lineBetween(i, 0, i, TILE_SIZE);
    }

    // Nails: small circles arranged in a grid
    const nailColor = 0xAAAAAA;
    const positions = [
      { x: 8, y: 8 }, { x: 16, y: 14 }, { x: 24, y: 8 },
      { x: 8, y: 24 }, { x: 16, y: 18 }, { x: 24, y: 24 },
      { x: 8, y: 16 }, { x: 24, y: 16 },
    ];
    for (const p of positions) {
      // Nail head
      this.fillStyle(nailColor);
      this.fillCircle(p.x, p.y, 2);
      // Nail point (short line downward)
      this.lineStyle(1, 0x888888);
      this.lineBetween(p.x, p.y + 2, p.x, p.y + 6);
    }

    // Wear indicator: darken when few uses remain
    if (this.usesRemaining <= 5) {
      this.fillStyle(0x000000, 0.3);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    }

    // Border
    this.lineStyle(1, 0xE8DCC8, 0.25);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  /** Consume one use. Returns true if the board is now destroyed. */
  consumeUse(): boolean {
    this.usesRemaining--;
    this.structureInstance.hp = this.usesRemaining;
    // Redraw to show wear
    this.draw();
    if (this.usesRemaining <= 0) {
      this.structureInstance.hp = 0;
      this.destroy();
      return true;
    }
    return false;
  }

  /** Returns true if this board still has uses remaining and is active. */
  isAlive(): boolean {
    return this.active && this.usesRemaining > 0;
  }

  /** Structural damage (e.g. brutes). Returns true if destroyed. */
  takeDamage(amount: number): boolean {
    this.structureInstance.hp -= amount;
    if (this.structureInstance.hp <= 0) {
      this.structureInstance.hp = 0;
      this.destroy();
      return true;
    }
    return false;
  }
}
