import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/**
 * Belt Sander Gauntlet -- industrial belt grinders lining a 3-tile corridor.
 * Zombies passing through take continuous shredding damage.
 *
 * Stats:
 *   - 30 dmg/s across a 3-tile corridor (continuous, delta-based)
 *   - Cooldown: 4s between activation pulses
 *   - Overheat after 25s of operation
 *   - Unlimited uses
 */
export class BeltSanderGauntlet extends TrapBase {
  /** Damage per second for zombies inside the corridor. */
  public readonly damagePerSecond: number = 30;

  /** Corridor width in pixels: 3 tiles. */
  public readonly corridorWidth: number = TILE_SIZE * 3;

  /** Belt scroll offset for animation. */
  private beltOffset: number = 0;

  /** Spark flash timer after contact. */
  private sparkTimer: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      100,    // maxHp
      4000,   // cooldownMs (4s)
      25000,  // overheatMax (25s)
      12000,  // recoveryMs
      0.15,   // malfunctionChance
      -1,     // uses (unlimited)
      0,      // fuelPerNight (no fuel: purely mechanical)
    );
  }

  protected draw(): void {
    this.clear();

    // Dark steel background
    this.fillStyle(0x111111);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const isActive = this.isReady() && !this.malfunctioned;
    const beltColor = isActive ? 0xBB8833 : 0x554422;

    // Belt surface: scrolling texture represented as diagonal stripes
    this.lineStyle(1, beltColor, 0.7);
    const stripeCount = 6;
    const stripeSpacing = TILE_SIZE / stripeCount;
    for (let i = -1; i < stripeCount + 1; i++) {
      const x = (i * stripeSpacing + this.beltOffset) % TILE_SIZE;
      this.lineBetween(x, 0, x - TILE_SIZE * 0.5, TILE_SIZE);
    }

    // Roller drums on left and right sides
    const rollerColor = 0x888888;
    this.fillStyle(rollerColor);
    this.fillRect(0, 0, 5, TILE_SIZE);      // left roller
    this.fillRect(TILE_SIZE - 5, 0, 5, TILE_SIZE);  // right roller

    // Roller highlights
    this.lineStyle(1, 0xAAAAAA, 0.6);
    this.lineBetween(2, 0, 2, TILE_SIZE);
    this.lineBetween(TILE_SIZE - 3, 0, TILE_SIZE - 3, TILE_SIZE);

    // Grit particles / abrasive surface: small dots
    if (isActive) {
      this.fillStyle(0xFFCC44, 0.4);
      for (let i = 0; i < 4; i++) {
        const px = 8 + i * 8 + (this.beltOffset * 0.3) % 8;
        this.fillCircle(px, TILE_SIZE / 2, 1);
      }
    }

    // Spark flash on contact
    if (this.sparkTimer > 0) {
      const intensity = this.sparkTimer / 200;
      this.fillStyle(0xFFDD55, 0.6 * intensity);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      this.lineStyle(1, 0xFFFFFF, intensity);
      this.lineBetween(TILE_SIZE * 0.2, TILE_SIZE * 0.3, TILE_SIZE * 0.5, TILE_SIZE * 0.6);
      this.lineBetween(TILE_SIZE * 0.6, TILE_SIZE * 0.2, TILE_SIZE * 0.4, TILE_SIZE * 0.7);
    }

    // Border
    this.lineStyle(1, 0x999977, isActive ? 0.4 : 0.15);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    // Scroll belt animation when active
    if (!this.malfunctioned && !this.overheated) {
      this.beltOffset = (this.beltOffset + delta * 0.05) % TILE_SIZE;
    }

    // Tick spark flash
    if (this.sparkTimer > 0) {
      this.sparkTimer = Math.max(0, this.sparkTimer - delta);
    }

    this.clear();
    this.draw();
  }

  /** Trigger spark visual when grinding a zombie. */
  triggerSparkEffect(): void {
    this.sparkTimer = 200;
    this.clear();
    this.draw();
  }

  onZombieContact(zombie: Zombie): void {
    // Continuous damage is handled by NightScene (delta-based).
    zombie.takeDamage(this.damagePerSecond);
  }
}
