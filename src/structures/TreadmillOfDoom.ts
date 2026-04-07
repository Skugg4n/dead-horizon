import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/** Pushback force: pixels per second applied as a continuous velocity. */
const PUSHBACK_VELOCITY = 120;

/**
 * Treadmill of Doom -- a motorized treadmill that continuously pushes zombies
 * away from the base while also dealing chip damage from the belt mechanism.
 *
 * Stats (structures.json):
 *   - Pushback: constant velocity push away from trap center
 *   - 10 dmg/s continuous
 *   - cd 0 (always active)
 *   - Overheat after 40s, 15s recovery
 *   - 100 HP
 *   - Malfunction chance: 10%
 *   - Fuel: 2 food/night
 */
export class TreadmillOfDoom extends TrapBase {
  /** Damage per second from belt friction. */
  public readonly damagePerSecond: number = 10;

  /** Pushback velocity in px/s applied to zombies on the belt. */
  public readonly pushbackVelocity: number = PUSHBACK_VELOCITY;

  /** Belt scroll animation phase (0-1). */
  private beltPhase: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      100,    // maxHp
      0,      // cooldownMs (0 = always active)
      40000,  // overheatMax (40s)
      15000,  // recoveryMs (15s)
      0.10,   // malfunctionChance
      -1,     // uses (-1 = unlimited)
      2,      // fuelPerNight
    );
  }

  protected draw(): void {
    this.clear();

    // Dark rubber belt background
    this.fillStyle(0x1A1510);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const isActive = !this.malfunctioned && !this.overheated;
    const beltColor = isActive ? 0x3A3020 : 0x222222;
    const stripeColor = isActive ? 0x666644 : 0x333333;
    const arrowColor = isActive ? 0x99AA33 : 0x444433;

    // Belt surface (dark rubber look)
    this.fillStyle(beltColor);
    this.fillRect(3, 4, TILE_SIZE - 6, TILE_SIZE - 8);

    // Animated belt stripes -- horizontal lines scrolling across the tile
    const stripeCount = 5;
    const stripeSpacing = (TILE_SIZE - 8) / stripeCount;
    for (let i = 0; i < stripeCount + 1; i++) {
      // Phase offset makes stripes scroll
      const yOff = ((this.beltPhase + i / stripeCount) % 1) * (TILE_SIZE - 8);
      const sy = 4 + yOff;
      if (sy > 4 && sy < TILE_SIZE - 4) {
        this.lineStyle(1, stripeColor, 0.7);
        this.lineBetween(4, sy, TILE_SIZE - 4, sy);
      }
      void stripeSpacing; // suppress unused warning
    }

    // Direction arrows showing pushback direction (pointing away from center -- upward)
    if (isActive) {
      const mid = TILE_SIZE / 2;
      this.lineStyle(2, arrowColor, 0.8);
      // Arrow shaft
      this.lineBetween(mid, 20, mid, 8);
      // Arrow head left
      this.lineBetween(mid, 8, mid - 4, 14);
      // Arrow head right
      this.lineBetween(mid, 8, mid + 4, 14);
    }

    // Belt rollers at top and bottom
    this.fillStyle(0x888866);
    this.fillRect(2, 2, TILE_SIZE - 4, 3);
    this.fillRect(2, TILE_SIZE - 5, TILE_SIZE - 4, 3);

    // Border
    this.lineStyle(1, 0xE8DCC8, 0.15);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    if (!this.malfunctioned && !this.overheated) {
      // Scroll belt stripes
      this.beltPhase = (this.beltPhase + delta * 0.001) % 1;
    }

    this.clear();
    this.draw();
  }

  onZombieContact(zombie: Zombie): void {
    // Chip damage (per-second rate; NightScene applies delta scaling)
    zombie.takeDamage(this.damagePerSecond);

    // Pushback: push zombie away from the trap center
    const cx = this.structureInstance.x + TILE_SIZE / 2;
    const cy = this.structureInstance.y + TILE_SIZE / 2;
    const dx = zombie.x - cx;
    const dy = zombie.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len > 0 && zombie.body) {
      const nx = dx / len;
      const ny = dy / len;
      // Persistent pushback velocity (counteracts zombie's own movement toward base)
      zombie.setVelocity(nx * PUSHBACK_VELOCITY * 5, ny * PUSHBACK_VELOCITY * 5);
    }
  }
}
