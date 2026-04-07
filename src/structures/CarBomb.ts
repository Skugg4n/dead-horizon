import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/** AOE explosion radius in pixels. */
const EXPLOSION_RADIUS = 120;

/**
 * Car Bomb -- a rigged vehicle loaded with explosives.
 * Detonates on contact for massive AOE damage. One use only.
 *
 * Stats:
 *   - 200 dmg AOE 120px radius
 *   - 1 use (destroyed after detonation)
 *   - No cooldown, no overheat
 */
export class CarBomb extends TrapBase {
  /** Explosion damage. */
  public readonly explosionDamage: number = 200;

  /** Explosion radius in pixels. */
  public readonly explosionRadius: number = EXPLOSION_RADIUS;

  /** Whether the car has been detonated (triggers self-destruction next frame). */
  public detonated: boolean = false;

  /** Detonation animation timer. */
  private detonationTimer: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      80,     // maxHp
      0,      // cooldownMs (no cooldown -- instant detonation)
      0,      // overheatMax
      0,      // recoveryMs
      0.05,   // malfunctionChance (5% -- reliable but not perfect)
      1,      // uses = 1 (single use, destroyed on detonation)
      0,      // fuelPerNight
    );
  }

  protected draw(): void {
    this.clear();

    // Car body -- rusty vehicle shape
    const isActive = !this.malfunctioned && this.uses > 0;

    // Car roof (upper portion)
    this.fillStyle(isActive ? 0x992222 : 0x663333);
    this.fillRect(4, 8, TILE_SIZE - 8, TILE_SIZE / 2 - 4);

    // Car body (wider lower section)
    this.fillStyle(isActive ? 0xBB3333 : 0x774444);
    this.fillRect(2, TILE_SIZE / 2 - 4, TILE_SIZE - 4, TILE_SIZE / 2 - 4);

    // Windows (cracked)
    this.fillStyle(0x334466, 0.6);
    this.fillRect(7, 10, 8, 6);
    this.fillRect(TILE_SIZE - 15, 10, 8, 6);

    // Wheels
    this.fillStyle(0x111111);
    this.fillCircle(7, TILE_SIZE - 7, 5);
    this.fillCircle(TILE_SIZE - 7, TILE_SIZE - 7, 5);
    this.fillStyle(0x444444);
    this.fillCircle(7, TILE_SIZE - 7, 2);
    this.fillCircle(TILE_SIZE - 7, TILE_SIZE - 7, 2);

    // Rust and damage details
    this.lineStyle(1, 0x884422, 0.5);
    this.lineBetween(10, TILE_SIZE / 2, 14, TILE_SIZE / 2 + 3);
    this.lineBetween(TILE_SIZE - 10, TILE_SIZE / 2 - 2, TILE_SIZE - 14, TILE_SIZE / 2 + 2);

    // Explosive indicator: yellow warning stripes on hood
    if (isActive) {
      this.fillStyle(0xFFCC00, 0.6);
      this.fillRect(8, TILE_SIZE / 2 - 2, 3, 8);
      this.fillRect(14, TILE_SIZE / 2 - 2, 3, 8);
      this.fillRect(20, TILE_SIZE / 2 - 2, 3, 8);

      // "BOOM" indicator: small red light
      this.fillStyle(0xFF0000);
      this.fillCircle(TILE_SIZE / 2, 12, 2);
    }

    // Detonation flash
    if (this.detonationTimer > 0) {
      const intensity = this.detonationTimer / 300;
      // Expanding orange/white fireball
      this.fillStyle(0xFFFF00, 0.9 * intensity);
      this.fillCircle(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE * 0.4 * intensity + 4);
      this.fillStyle(0xFF8800, 0.7 * intensity);
      this.fillCircle(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE * 0.6 * intensity + 8);
      this.fillStyle(0xFF2200, 0.5 * intensity);
      this.fillCircle(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE * intensity + 12);
    }

    // Border
    this.lineStyle(2, isActive ? 0xFF4400 : 0x664422, isActive ? 0.6 : 0.2);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    if (this.detonationTimer > 0) {
      this.detonationTimer = Math.max(0, this.detonationTimer - delta);
    }

    this.clear();
    this.draw();
  }

  /** Trigger detonation visual. Called by NightScene before destroying this trap. */
  triggerDetonation(): void {
    this.detonated = true;
    this.detonationTimer = 300;
    this.clear();
    this.draw();
  }

  onZombieContact(zombie: Zombie): void {
    // AOE explosion: NightScene handles all zombies in radius.
    // This method handles the triggering zombie.
    zombie.takeDamage(this.explosionDamage);
  }
}
