import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/** AOE ring radius for the razor wire carousel. */
const AOE_RADIUS = 48;

/**
 * Razor Wire Carousel -- a rotating pole with razor blades extending outward
 * that continuously damages all zombies within its AOE ring.
 *
 * Stats (structures.json):
 *   - 15 dmg/s continuous AOE (applied per frame proportional to delta)
 *   - No discrete cooldown (cooldownMs 0 = always active while not overheated)
 *   - Overheat after 25s of operation, 15s recovery
 *   - 100 HP
 *   - Malfunction chance: 15%
 *   - Fuel: 1 food/night
 */
export class RazorWireCarousel extends TrapBase {
  /** Damage per second to zombies in range. */
  public readonly damagePerSecond: number = 15;

  /** AOE radius in pixels. */
  public readonly aoeRadius: number = AOE_RADIUS;

  /** Rotation angle in radians -- advances each frame. */
  private spinAngle: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      100,    // maxHp
      0,      // cooldownMs (0 = always active)
      25000,  // overheatMax (25s)
      15000,  // recoveryMs (15s recovery)
      0.15,   // malfunctionChance
      -1,     // uses (-1 = unlimited)
      1,      // fuelPerNight
    );
  }

  protected draw(): void {
    this.clear();

    // Dark background
    this.fillStyle(0x111111);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;
    const isActive = !this.malfunctioned && !this.overheated;

    // AOE ring indicator (faint outer ring showing reach)
    this.lineStyle(1, isActive ? 0xFF3322 : 0x444444, 0.2);
    this.strokeCircle(mid, mid, AOE_RADIUS);

    // Central post
    this.fillStyle(0x666666);
    this.fillCircle(mid, mid, 4);

    // Three extending arms with razor wire segments
    const armCount = 3;
    const armLength = 14;
    for (let i = 0; i < armCount; i++) {
      const angle = this.spinAngle + (i / armCount) * Math.PI * 2;
      const tipX = mid + Math.cos(angle) * armLength;
      const tipY = mid + Math.sin(angle) * armLength;

      // Arm rod
      this.lineStyle(2, isActive ? 0xBBBBBB : 0x444444, 0.9);
      this.lineBetween(mid, mid, tipX, tipY);

      // Razor blade at tip: short perpendicular line
      const perpAngle = angle + Math.PI / 2;
      const bladeLen = 5;
      this.lineStyle(2, isActive ? 0xEEEEEE : 0x333333, 0.8);
      this.lineBetween(
        tipX - Math.cos(perpAngle) * bladeLen,
        tipY - Math.sin(perpAngle) * bladeLen,
        tipX + Math.cos(perpAngle) * bladeLen,
        tipY + Math.sin(perpAngle) * bladeLen,
      );
    }

    // Center cap
    this.fillStyle(0x994422);
    this.fillCircle(mid, mid, 3);

    // Border
    this.lineStyle(1, 0xE8DCC8, 0.15);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    // Spin when active
    if (!this.malfunctioned && !this.overheated) {
      this.spinAngle += (delta / 1000) * Math.PI * 3; // ~1.5 full spins per second
    }

    this.clear();
    this.draw();
  }

  /**
   * Continuous damage: called every frame by NightScene for zombies in range.
   * tryActivate() is not used here since this is always-on (no discrete trigger).
   */
  onZombieContact(zombie: Zombie): void {
    // Delta-based damage is applied externally by NightScene (same pattern as FirePit).
    zombie.takeDamage(this.damagePerSecond);
  }
}
