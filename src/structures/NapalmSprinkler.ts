import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/**
 * Napalm Sprinkler -- a rotating sprinkler head that sprays burning napalm in a cone.
 * Covers a wide forward arc with continuous fire damage.
 *
 * Stats:
 *   - 40 dmg/s in a cone (continuous, delta-based)
 *   - Cone range: 100px, angle: 90 degrees (facing toward base)
 *   - Cooldown: 8s between spray bursts
 *   - Fuel: 4 food/night + 5 parts (napalm is expensive)
 *   - Overheat after 15s
 */
export class NapalmSprinkler extends TrapBase {
  /** Damage per second inside the napalm cone. */
  public readonly damagePerSecond: number = 40;

  /** Cone range in pixels. */
  public readonly coneRange: number = 100;

  /** Cone half-angle in radians (45 degrees = 90 degree total cone). */
  public readonly coneHalfAngle: number = Math.PI / 4;

  /** Spray direction angle (facing down/toward enemies by default). */
  public readonly sprayAngle: number = Math.PI / 2; // faces south

  /** Spray rotation for the animated sprinkler head. */
  private headAngle: number = 0;

  /** Whether actively spraying this frame. */
  public isSpraying: boolean = false;

  /** Spray timer: how long the current spray burst lasts. */
  private sprayTimer: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      80,     // maxHp
      8000,   // cooldownMs (8s)
      15000,  // overheatMax (15s)
      10000,  // recoveryMs
      0.15,   // malfunctionChance
      -1,     // uses (unlimited)
      4,      // fuelPerNight (4 food)
    );
  }

  protected draw(): void {
    this.clear();

    // Dark industrial pipe background
    this.fillStyle(0x0A0A0A);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;
    const isActive = this.isReady() && !this.malfunctioned;

    // Pipe body (vertical)
    this.fillStyle(0x666688);
    this.fillRect(mid - 4, 0, 8, TILE_SIZE);

    // Pipe joints
    this.fillStyle(0x888899);
    this.fillRect(mid - 5, 8, 10, 4);
    this.fillRect(mid - 5, TILE_SIZE - 12, 10, 4);

    // Sprinkler head at top: rotates with headAngle
    const headLen = 8;
    const headX1 = mid + Math.cos(this.headAngle) * headLen;
    const headY1 = 6 + Math.sin(this.headAngle) * headLen;
    const headX2 = mid - Math.cos(this.headAngle) * headLen;
    const headY2 = 6 - Math.sin(this.headAngle) * headLen;

    this.lineStyle(3, isActive ? 0xFF8833 : 0x886644, 0.9);
    this.lineBetween(headX1, headY1, headX2, headY2);

    // Nozzle tips
    this.fillStyle(isActive ? 0xFF6600 : 0x885533);
    this.fillCircle(headX1, headY1, 3);
    this.fillCircle(headX2, headY2, 3);

    // Spray effect when active spraying
    if (this.isSpraying && this.sprayTimer > 0) {
      const intensity = Math.min(1.0, this.sprayTimer / 200);

      // Napalm spray: orange/yellow flame cone radiating downward
      for (let i = 0; i < 5; i++) {
        const a = this.sprayAngle + (i - 2) * (this.coneHalfAngle / 2);
        const r = 6 + Math.random() * 10;
        const sx = mid + Math.cos(a) * r;
        const sy = 6 + Math.sin(a) * r;

        this.fillStyle(i % 2 === 0 ? 0xFF6600 : 0xFFAA00, 0.7 * intensity);
        this.fillCircle(sx, sy, 3 + Math.random() * 3);
      }

      // Ambient glow from napalm
      this.fillStyle(0xFF4400, 0.2 * intensity);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    }

    // Fuel level indicator: small orange bar
    const fuelLevel = this.fuelPerNight > 0 ? 1.0 : 0.0;
    if (fuelLevel > 0) {
      this.fillStyle(0xFF6600, 0.7);
      this.fillRect(2, TILE_SIZE - 5, (TILE_SIZE - 4) * fuelLevel, 3);
    }

    // Border
    this.lineStyle(1, isActive ? 0xFF6600 : 0x554422, isActive ? 0.4 : 0.15);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    // Rotate sprinkler head when active
    if (!this.malfunctioned && !this.overheated) {
      this.headAngle += (delta / 1000) * Math.PI * 2; // 1 full rotation/s
    }

    // Tick spray timer
    if (this.sprayTimer > 0) {
      this.sprayTimer = Math.max(0, this.sprayTimer - delta);
      this.isSpraying = this.sprayTimer > 0;
    }

    this.clear();
    this.draw();
  }

  /** Trigger active spray visual. Called by NightScene during spray burst. */
  triggerSpray(): void {
    this.isSpraying = true;
    this.sprayTimer = 300;
    this.clear();
    this.draw();
  }

  /**
   * Check if a point is within the napalm spray cone.
   * Cone origin is at the trap center, faces sprayAngle direction.
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
    // Continuous damage is handled by NightScene (delta-based).
    zombie.takeDamage(this.damagePerSecond);
  }
}
