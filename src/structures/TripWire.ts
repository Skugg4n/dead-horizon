import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

/**
 * Trip Wire -- a barely visible wire that stuns zombies who cross it.
 * Tier 1 passive trap: no damage, just a stun effect.
 *
 * Stats (from structures.json):
 *   - 0 dmg, stun 1.5s
 *   - 10 HP structural durability
 *   - 15 uses before the wire snaps
 */
export class TripWire extends Phaser.GameObjects.Graphics {
  public structureInstance: StructureInstance;

  /** Stun duration in ms (from structures.json). */
  public readonly stunDuration: number;

  /** Remaining uses before the wire breaks. */
  private usesRemaining: number;

  /** Maximum uses (for alpha calculation). */
  private readonly maxUses: number;

  /**
   * Snap flash timer. When > 0, a bright white "snap" line is rendered.
   * Counts down to zero each frame.
   */
  private snapTimer: number = 0;

  constructor(
    scene: Phaser.Scene,
    instance: StructureInstance,
    stunDuration: number,
    _maxUses: number,
  ) {
    super(scene);
    this.structureInstance = instance;
    this.stunDuration = stunDuration;
    this.maxUses = _maxUses > 0 ? _maxUses : 15;
    // Store remaining uses in structureInstance.hp so save/load reflects wear
    this.usesRemaining = instance.hp;

    this.setPosition(instance.x, instance.y);
    this.draw();

    scene.add.existing(this);
  }

  private draw(): void {
    this.clear();

    // Alpha blekning proportionell mot kvarvarande uses
    const wearAlpha = 0.3 + 0.7 * (this.usesRemaining / this.maxUses);
    this.setAlpha(wearAlpha);

    // Nearly invisible ground (wire blends into terrain)
    this.fillStyle(0x1A1A1A, 0.15);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    if (this.snapTimer > 0) {
      // Snap activation: bright white flash across the entire tile
      // Intensity fades with the timer
      const intensity = this.snapTimer / 150;
      this.fillStyle(0xFFFFFF, 0.5 * intensity);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

      // Bright snap line -- thick and bright to simulate wire snapping
      this.lineStyle(2, 0xFFFFFF, intensity);
      this.lineBetween(0, TILE_SIZE / 2, TILE_SIZE, TILE_SIZE / 2);

      // Vertical snap burst in center
      this.lineStyle(1, 0xEEEEAA, intensity * 0.8);
      this.lineBetween(TILE_SIZE / 2, TILE_SIZE / 2 - 6, TILE_SIZE / 2, TILE_SIZE / 2 + 6);
    } else {
      // The wire itself: thin horizontal line across the tile
      // Slightly visible so experienced players can spot it
      const alpha = 0.5 - (1 - this.usesRemaining / this.maxUses) * 0.3;
      this.lineStyle(1, 0xCCCC88, Math.max(alpha, 0.15));
      this.lineBetween(0, TILE_SIZE / 2, TILE_SIZE, TILE_SIZE / 2);

      // Wire tension anchors at both ends
      this.fillStyle(0x886644, 0.7);
      this.fillCircle(2, TILE_SIZE / 2, 2);
      this.fillCircle(TILE_SIZE - 2, TILE_SIZE / 2, 2);

      // Faint cross-wire
      this.lineStyle(1, 0xCCCC88, alpha * 0.5);
      this.lineBetween(TILE_SIZE / 2, 0, TILE_SIZE / 2, TILE_SIZE);
    }
  }

  /**
   * Call each frame from NightScene to animate snap effect.
   * @param delta Frame time in ms.
   */
  update(delta: number): void {
    if (this.snapTimer > 0) {
      this.snapTimer = Math.max(0, this.snapTimer - delta);
      this.clear();
      this.draw();
    }
  }

  /**
   * Trigger the visible wire-snap effect on activation.
   * Called by NightScene immediately after a zombie is stunned.
   */
  triggerActivationEffect(): void {
    this.snapTimer = 150; // 150ms white flash/snap
    this.clear();
    this.draw();
  }

  /** Consume one use. Returns true if the wire has snapped completely. */
  consumeUse(): boolean {
    this.usesRemaining--;
    this.structureInstance.hp = this.usesRemaining;
    // Redraw: wire fades as it degrades
    this.draw();
    if (this.usesRemaining <= 0) {
      this.structureInstance.hp = 0;
      this.destroy();
      return true;
    }
    return false;
  }

  /** Returns true if this wire still has uses and is active. */
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
