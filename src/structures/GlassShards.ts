import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

/** Zone radius in pixels -- tile-tight now, no more glow aura. */
export const GLASS_SHARDS_RADIUS = 18;

/**
 * Glass Shards -- broken glass spread across the ground that deals continuous
 * damage to zombies walking over the zone.
 * Tier 1 passive trap: no mechanical systems, no uses limit.
 * The zone persists until the structure is destroyed.
 *
 * Stats (from structures.json):
 *   - 5 dmg/s to zombies in zone (~96px radius)
 *   - 20 HP structural durability (destroyed by brutes stepping on it)
 */
export class GlassShards extends Phaser.GameObjects.Graphics {
  public structureInstance: StructureInstance;

  /** Damage per second (from structures.json). */
  public readonly damagePerSecond: number;

  /** Zone radius in pixels. */
  public readonly zoneRadius: number = GLASS_SHARDS_RADIUS;

  constructor(
    scene: Phaser.Scene,
    instance: StructureInstance,
    damagePerSecond: number,
  ) {
    super(scene);
    this.structureInstance = instance;
    this.damagePerSecond = damagePerSecond;

    this.setPosition(instance.x, instance.y);
    this.draw();

    scene.add.existing(this);
  }

  private draw(): void {
    this.clear();

    // Static glass shards (small irregular shapes) -- no glow, no sparkle.
    // Just dirty broken glass on the ground. The "glow" damage was moved
    // to Floodlight which makes more physical sense.
    const shardColor = 0xC8E0FF;
    const staticPositions = [
      { x: 4, y: 6 }, { x: 20, y: 2 }, { x: 12, y: 18 },
      { x: 26, y: 12 }, { x: 6, y: 24 }, { x: 28, y: 26 },
      { x: 16, y: 8 }, { x: 22, y: 22 }, { x: 10, y: 14 },
      { x: 30, y: 6 }, { x: 2, y: 16 }, { x: 24, y: 30 },
    ];
    for (const p of staticPositions) {
      this.fillStyle(shardColor, 0.85);
      this.fillTriangle(
        p.x, p.y,
        p.x + 3, p.y - 2,
        p.x + 2, p.y + 3,
      );
    }
  }

  /** No-op: glass shards are static visuals now, no animation. */
  animUpdate(_delta: number): void {
    // intentionally empty
  }

  /**
   * Returns true if world-space point (px, py) is within the glass shard zone.
   * Uses the center of the structure tile as zone origin.
   */
  containsPoint(px: number, py: number): boolean {
    const cx = this.structureInstance.x + TILE_SIZE / 2;
    const cy = this.structureInstance.y + TILE_SIZE / 2;
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= this.zoneRadius * this.zoneRadius;
  }

  /** Structural damage (e.g. brutes smashing it). Returns true if destroyed. */
  takeDamage(amount: number): boolean {
    this.structureInstance.hp -= amount;
    if (this.structureInstance.hp <= 0) {
      this.structureInstance.hp = 0;
      this.destroy();
      return true;
    }
    return false;
  }

  /** Returns true if still active. */
  isAlive(): boolean {
    return this.active;
  }
}
