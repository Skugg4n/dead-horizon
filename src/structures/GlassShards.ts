import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

/** Zone radius in pixels (~3 tiles). */
export const GLASS_SHARDS_RADIUS = 96;

/** Number of sparkle points that animate independently. */
const SPARKLE_COUNT = 8;

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

  /** Animation phase for continuous sparkle effect. */
  private sparklePhase: number = 0;

  /**
   * Individual phase offsets for each sparkle point so they twinkle independently.
   * Pre-computed in constructor to avoid allocating each frame.
   */
  private readonly sparkleOffsets: number[];

  /** Pre-computed random sparkle positions within the tile. */
  private readonly sparklePositions: Array<{ x: number; y: number }>;

  constructor(
    scene: Phaser.Scene,
    instance: StructureInstance,
    damagePerSecond: number,
  ) {
    super(scene);
    this.structureInstance = instance;
    this.damagePerSecond = damagePerSecond;

    // Pre-compute sparkle offsets (stable per instance, no per-frame allocation)
    this.sparkleOffsets = Array.from({ length: SPARKLE_COUNT }, (_, i) =>
      (i / SPARKLE_COUNT) * Math.PI * 2,
    );

    // Pre-compute sparkle positions spread across the tile
    this.sparklePositions = [
      { x: 4, y: 6 }, { x: 20, y: 2 }, { x: 12, y: 18 },
      { x: 26, y: 12 }, { x: 6, y: 24 }, { x: 28, y: 26 },
      { x: 16, y: 8 }, { x: 22, y: 22 },
    ];

    this.setPosition(instance.x, instance.y);
    this.draw();

    scene.add.existing(this);
  }

  private draw(): void {
    this.clear();

    const cx = TILE_SIZE / 2;
    const cy = TILE_SIZE / 2;

    // Subtle zone indicator: faint circle on ground
    this.fillStyle(0xDDDDFF, 0.04);
    this.fillCircle(cx, cy, this.zoneRadius);

    // Static glass shards (small irregular shapes)
    const shardColor = 0xC8E0FF;
    const staticPositions = [
      { x: 4, y: 6 }, { x: 20, y: 2 }, { x: 12, y: 18 },
      { x: 26, y: 12 }, { x: 6, y: 24 }, { x: 28, y: 26 },
      { x: 16, y: 8 }, { x: 22, y: 22 }, { x: 10, y: 14 },
      { x: 30, y: 6 }, { x: 2, y: 16 }, { x: 24, y: 30 },
    ];
    for (const p of staticPositions) {
      this.fillStyle(shardColor, 0.7);
      // Small irregular triangle-like shard
      this.fillTriangle(
        p.x, p.y,
        p.x + 3, p.y - 2,
        p.x + 2, p.y + 3,
      );
    }

    // Animated sparkles: glittering white/blue points that blink on/off
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const offset = this.sparkleOffsets[i] ?? 0;
      const phase = this.sparklePhase + offset;
      // Each sparkle pulses in and out using a sine wave
      const brightness = (Math.sin(phase * 3) + 1) / 2; // 0..1
      if (brightness > 0.4) {
        const pos = this.sparklePositions[i];
        if (!pos) continue; // guard against noUncheckedIndexedAccess
        // Cross/star shaped sparkle: dimmer blue instead of bright white
        this.lineStyle(1, 0x4488AA, brightness * 0.5);
        this.lineBetween(pos.x - 2, pos.y, pos.x + 2, pos.y);
        this.lineBetween(pos.x, pos.y - 2, pos.x, pos.y + 2);
      }
    }

    // Border
    this.lineStyle(1, 0x8899BB, 0.2);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  /**
   * Advance sparkle animation. Call from NightScene.update() each frame.
   * @param delta Frame time in ms.
   */
  animUpdate(delta: number): void {
    this.sparklePhase += delta * 0.004; // slow twinkle rate
    this.clear();
    this.draw();
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
