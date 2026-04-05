import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

/**
 * Tar Pit -- a pool of thick tar that slows zombies by 80% while inside the zone.
 * Tier 1 passive trap: no mechanical systems, no uses limit.
 * Lasts 2 nights before drying out (tracked via nightsRemaining in structureInstance data).
 *
 * Stats (from structures.json):
 *   - 80% slow (speedFactor 0.2) to zombies in zone
 *   - 30 HP structural durability
 *   - Lasts 2 nights (set via nightDuration in structures.json)
 */
export class TarPit extends Phaser.GameObjects.Graphics {
  public structureInstance: StructureInstance;

  /** Speed multiplier while inside the tar (from structures.json, default 0.2 = 80% slow). */
  public readonly slowFactor: number;

  /** Width of the slow zone in tiles (matches widthTiles in structures.json). */
  public readonly widthTiles: number;

  /** Animation phase for bubbling tar effect. */
  private bubblePhase: number = 0;

  constructor(
    scene: Phaser.Scene,
    instance: StructureInstance,
    slowFactor: number,
    widthTiles: number,
  ) {
    super(scene);
    this.structureInstance = instance;
    this.slowFactor = slowFactor;
    this.widthTiles = widthTiles;

    this.setPosition(instance.x, instance.y);
    this.draw();

    scene.add.existing(this);
  }

  private draw(): void {
    this.clear();

    const w = TILE_SIZE * this.widthTiles;
    const h = TILE_SIZE;

    // Tar base: very dark brown-black
    this.fillStyle(0x0D0900);
    this.fillRect(0, 0, w, h);

    // Tar surface sheen: slightly lighter patches
    const cx = w / 2;
    const cy = h / 2;
    const bubble = Math.sin(this.bubblePhase) * 3;

    this.fillStyle(0x1A1000, 0.8);
    this.fillEllipse(cx - 8, cy - 2 + bubble, 24, 10);
    this.fillStyle(0x2A1800, 0.6);
    this.fillEllipse(cx + 4, cy + 4 - bubble * 0.5, 18, 8);

    // Bubbles
    const bubbleAlpha = 0.3 + Math.abs(Math.sin(this.bubblePhase * 1.3)) * 0.3;
    this.fillStyle(0x3D2500, bubbleAlpha);
    this.fillCircle(cx - 12, cy, 4 + bubble);
    this.fillCircle(cx + 10, cy - 3, 3 + Math.abs(bubble) * 0.5);

    // Slow indicator: faint amber border
    this.lineStyle(1, 0x886600, 0.4);
    this.strokeRect(0, 0, w, h);
  }

  /**
   * Advance animation. Call from NightScene.update() or per frame update.
   */
  animUpdate(delta: number): void {
    this.bubblePhase += delta * 0.003;
    this.clear();
    this.draw();
  }

  /**
   * Returns true if world-space point (px, py) is within the tar zone.
   */
  containsPoint(px: number, py: number): boolean {
    const x0 = this.structureInstance.x;
    const y0 = this.structureInstance.y;
    const w  = TILE_SIZE * this.widthTiles;
    return px >= x0 && px <= x0 + w && py >= y0 && py <= y0 + TILE_SIZE;
  }

  /** Structural damage (brutes). Returns true if destroyed. */
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
