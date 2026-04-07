import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/** AOE radius for zapper damage and attraction. */
const ZAPPER_RADIUS = 56;

/**
 * Bug Zapper XL -- a UV light tube that both attracts nearby zombies toward it
 * (they cannot resist the light) and electrocutes them while they stand in range.
 *
 * Stats (structures.json):
 *   - 20 dmg/s continuous AOE (delta-based, applied to zombies in range)
 *   - Attracts zombies: overrides their target toward this trap
 *   - No discrete cooldown (cd 0 = always active)
 *   - Overheat after 20s, 10s recovery
 *   - 80 HP
 *   - Malfunction chance: 15%
 *   - Fuel: 1 food/night
 */
export class BugZapperXL extends TrapBase {
  /** Damage per second to zombies in range. */
  public readonly damagePerSecond: number = 20;

  /** Attraction radius (same as AOE -- zombies in range get pulled toward zapper). */
  public readonly aoeRadius: number = ZAPPER_RADIUS;

  /** UV flicker phase for animation. */
  private flickerPhase: number = 0;

  /** Zap flash timer in ms. Active briefly after a zombie is in range. */
  private zapFlashTimer: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      80,     // maxHp
      0,      // cooldownMs (0 = always active)
      20000,  // overheatMax (20s)
      10000,  // recoveryMs (10s)
      0.15,   // malfunctionChance
      -1,     // uses (-1 = unlimited)
      1,      // fuelPerNight
    );
  }

  protected draw(): void {
    this.clear();

    // Dark housing
    this.fillStyle(0x0D0D1A);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;
    const isActive = !this.malfunctioned && !this.overheated;
    const flicker = Math.sin(this.flickerPhase) * 0.3 + 0.7; // 0.4 - 1.0

    // UV glow ring (attraction indicator)
    if (isActive) {
      this.lineStyle(1, 0x8833FF, 0.12 * flicker);
      this.strokeCircle(mid, mid, ZAPPER_RADIUS);
    }

    // Outer housing box
    this.fillStyle(0x333355);
    this.fillRect(4, 4, TILE_SIZE - 8, TILE_SIZE - 8);

    // UV tube -- vertical purple/blue glowing rod
    const tubeColor = isActive ? 0x9944FF : 0x333355;
    const tubeGlow  = isActive ? flicker : 0.4;
    this.fillStyle(tubeColor, tubeGlow);
    this.fillRect(mid - 2, 8, 4, TILE_SIZE - 16);

    // Glow corona around tube when active
    if (isActive) {
      this.lineStyle(4, 0x6622EE, 0.15 * flicker);
      this.lineBetween(mid, 8, mid, TILE_SIZE - 8);
      this.lineStyle(8, 0x4411AA, 0.08 * flicker);
      this.lineBetween(mid, 8, mid, TILE_SIZE - 8);
    }

    // Zap grid wires (horizontal metal bars)
    const gridColor = isActive ? 0x5566AA : 0x333344;
    const gridCount = 4;
    for (let i = 0; i < gridCount; i++) {
      const gy = 10 + (i / (gridCount - 1)) * (TILE_SIZE - 20);
      this.lineStyle(1, gridColor, 0.6);
      this.lineBetween(5, gy, TILE_SIZE - 5, gy);
    }

    // Zap flash when hitting a zombie
    if (this.zapFlashTimer > 0) {
      const intensity = this.zapFlashTimer / 120;
      this.fillStyle(0xCCAAFF, 0.3 * intensity);
      this.fillRect(4, 4, TILE_SIZE - 8, TILE_SIZE - 8);
    }

    // Border
    this.lineStyle(1, 0x5533AA, 0.3);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    if (!this.malfunctioned && !this.overheated) {
      this.flickerPhase += delta * 0.012;
    }

    if (this.zapFlashTimer > 0) {
      this.zapFlashTimer = Math.max(0, this.zapFlashTimer - delta);
    }

    this.clear();
    this.draw();
  }

  /** Trigger brief zap flash. Called by NightScene when a zombie is in range. */
  triggerZapEffect(): void {
    this.zapFlashTimer = 120;
  }

  /**
   * Damage applied by NightScene per frame (delta-based, like FirePit).
   * The attraction effect is handled separately in NightScene.
   */
  onZombieContact(zombie: Zombie): void {
    zombie.takeDamage(this.damagePerSecond);
  }
}
