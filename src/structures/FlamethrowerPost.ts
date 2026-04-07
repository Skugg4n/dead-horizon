import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/**
 * Flamethrower Post -- a mounted flamethrower on a fixed post.
 * Sprays continuous fire in a forward-facing cone.
 *
 * Stats:
 *   - 30 dmg/s in a cone (continuous, delta-based)
 *   - Cone range: 80px, angle: 90 degrees
 *   - Cooldown: 5s between bursts
 *   - Fuel: 3 food/night
 *   - Overheat after 20s
 */
export class FlamethrowerPost extends TrapBase {
  /** Damage per second inside the flame cone. */
  public readonly damagePerSecond: number = 30;

  /** Flame cone range in pixels. */
  public readonly coneRange: number = 80;

  /** Cone half-angle in radians (45 degrees = 90 degree cone). */
  public readonly coneHalfAngle: number = Math.PI / 4;

  /** Spray direction: faces south (toward incoming zombies). */
  public readonly sprayAngle: number = Math.PI / 2;

  /** Whether actively spraying. */
  public isSpraying: boolean = false;

  /** Spray burst timer. */
  private sprayTimer: number = 0;

  /** Flame flicker phase for animation. */
  private flamePhase: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      80,     // maxHp
      5000,   // cooldownMs (5s)
      20000,  // overheatMax (20s)
      12000,  // recoveryMs
      0.12,   // malfunctionChance
      -1,     // uses (unlimited)
      3,      // fuelPerNight (3 food)
    );
  }

  protected draw(): void {
    this.clear();

    // Dark metal post base
    this.fillStyle(0x0D0D0D);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;
    const isActive = this.isReady() && !this.malfunctioned;

    // Post / mounting column
    this.fillStyle(0x555566);
    this.fillRect(mid - 4, TILE_SIZE / 3, 8, TILE_SIZE * 2 / 3);

    // Base flange
    this.fillStyle(0x444455);
    this.fillRect(mid - 8, TILE_SIZE - 7, 16, 6);

    // Fuel tank (cylindrical side-mount)
    this.fillStyle(isActive ? 0x884411 : 0x553311);
    this.fillRect(mid + 4, 6, 8, TILE_SIZE / 2);
    this.fillStyle(0x443322);
    this.fillRect(mid + 4, 6, 8, 3);

    // Tank band
    this.lineStyle(1, 0x666655, 0.6);
    this.lineBetween(mid + 4, TILE_SIZE / 3, mid + 12, TILE_SIZE / 3);

    // Flamethrower nozzle barrel
    const barrelLength = TILE_SIZE / 2 - 4;
    this.fillStyle(isActive ? 0x999988 : 0x666655);
    this.fillRect(mid - 3, 4, 6, barrelLength);

    // Nozzle tip
    this.fillStyle(isActive ? 0xCCCCBB : 0x888877);
    this.fillRect(mid - 2, 4, 4, 4);

    // Trigger/handle
    this.fillStyle(0x554433);
    this.fillRect(mid - 6, TILE_SIZE / 3 - 2, 4, 10);

    // Active flame burst
    if (this.isSpraying && this.sprayTimer > 0) {
      const intensity = Math.min(1.0, this.sprayTimer / 250);
      const flicker = Math.abs(Math.sin(this.flamePhase));

      // Cone of fire above the nozzle (toward the top of tile)
      const flameLayers = [
        { color: 0xFF2200, alpha: 0.8 * intensity, radius: 5 + flicker * 3 },
        { color: 0xFF6600, alpha: 0.6 * intensity, radius: 7 + flicker * 4 },
        { color: 0xFFAA00, alpha: 0.4 * intensity, radius: 9 + flicker * 5 },
        { color: 0xFFFF88, alpha: 0.2 * intensity, radius: 11 + flicker * 6 },
      ];

      for (const layer of flameLayers) {
        this.fillStyle(layer.color, layer.alpha);
        this.fillCircle(mid, 4, layer.radius);
      }
    }

    // Border
    this.lineStyle(1, isActive ? 0xFF6622 : 0x334433, isActive ? 0.4 : 0.15);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    // Animate flame flicker
    this.flamePhase += delta * 0.015;

    // Tick spray timer
    if (this.sprayTimer > 0) {
      this.sprayTimer = Math.max(0, this.sprayTimer - delta);
      this.isSpraying = this.sprayTimer > 0;
    }

    this.clear();
    this.draw();
  }

  /** Trigger active spray visual. Called by NightScene during flame burst. */
  triggerFlame(): void {
    this.isSpraying = true;
    this.sprayTimer = 300;
    this.clear();
    this.draw();
  }

  /**
   * Check if a world point is within the flamethrower cone.
   */
  isInCone(worldX: number, worldY: number): boolean {
    const cx = this.structureInstance.x + TILE_SIZE / 2;
    const cy = this.structureInstance.y + TILE_SIZE / 2;
    const dx = worldX - cx;
    const dy = worldY - cy;
    const distSq = dx * dx + dy * dy;

    if (distSq > this.coneRange * this.coneRange) return false;

    const angle = Math.atan2(dy, dx);
    let angleDiff = Math.abs(angle - this.sprayAngle);
    if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
    return angleDiff <= this.coneHalfAngle;
  }

  onZombieContact(zombie: Zombie): void {
    // Continuous damage handled by NightScene (delta-based).
    zombie.takeDamage(this.damagePerSecond);
  }
}
