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

  /**
   * Secondary bubble phase offset for the second bubble to desynchronise them.
   * Pre-computed to avoid allocation each frame.
   */
  private readonly bubble2Offset: number = Math.PI * 0.7;

  /**
   * Whether at least one zombie is currently in the zone.
   * Used to speed up bubble animation when active.
   */
  private zombieInZone: boolean = false;

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

    const cx = w / 2;
    const cy = h / 2;

    // Surface sheen patches that undulate slowly
    const bubble = Math.sin(this.bubblePhase) * 3;
    const bubble2 = Math.sin(this.bubblePhase + this.bubble2Offset) * 2;

    this.fillStyle(0x1A1000, 0.8);
    this.fillEllipse(cx - 8, cy - 2 + bubble, 24, 10);
    this.fillStyle(0x2A1800, 0.6);
    this.fillEllipse(cx + 4, cy + 4 - bubble * 0.5, 18, 8);

    // Bubbles rising -- more pronounced when zombie is in zone
    const baseAlpha = this.zombieInZone ? 0.5 : 0.3;
    const bubbleAlpha = baseAlpha + Math.abs(Math.sin(this.bubblePhase * 1.3)) * 0.3;
    const bubble2Alpha = baseAlpha + Math.abs(Math.sin(this.bubblePhase * 1.7)) * 0.25;

    // Bubble 1: left side
    const b1Size = 4 + Math.abs(bubble);
    this.fillStyle(0x3D2500, bubbleAlpha);
    this.fillCircle(cx - 12, cy + bubble2, b1Size);

    // Bubble 2: right side, offset timing
    const b2Size = 3 + Math.abs(bubble2) * 0.5;
    this.fillStyle(0x3D2500, bubble2Alpha);
    this.fillCircle(cx + 10, cy - 3 + bubble * 0.3, b2Size);

    // Third small bubble for depth
    const b3Phase = Math.sin(this.bubblePhase * 2.1 + 1.2);
    if (b3Phase > 0) {
      this.fillStyle(0x2E1C00, b3Phase * 0.35);
      this.fillCircle(cx - 2, cy - 5 + bubble * 0.7, 2 + b3Phase);
    }

    // Slow indicator: faint amber border -- brighter when zombie is caught
    const borderAlpha = this.zombieInZone ? 0.7 : 0.4;
    this.lineStyle(1, 0x886600, borderAlpha);
    this.strokeRect(0, 0, w, h);

    // Reset per-frame zombie flag (updated again if zombie is found in zone)
    this.zombieInZone = false;
  }

  /**
   * Advance animation. Call from NightScene.update() once per frame.
   * @param delta Frame time in ms.
   */
  animUpdate(delta: number): void {
    // Slightly faster animation when zombie is actively stuck in tar
    const speed = this.zombieInZone ? 0.005 : 0.003;
    this.bubblePhase += delta * speed;
    this.clear();
    this.draw();
  }

  /**
   * Signal that at least one zombie is currently in the zone this frame.
   * Call from NightScene before animUpdate() each frame.
   * Increases bubble animation intensity.
   */
  markZombieInZone(): void {
    this.zombieInZone = true;
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
