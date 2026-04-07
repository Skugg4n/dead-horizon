import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/** 3x3 zone side length in pixels. */
const ZONE_SIZE = TILE_SIZE * 3;

/**
 * Car Battery Grid -- a buried network of car batteries connected by copper wire
 * that discharges a high-voltage shock across a 3x3 tile zone.
 * All zombies in the zone are stunned simultaneously.
 *
 * Stats (structures.json):
 *   - Stun 2s for all zombies in 3x3 zone
 *   - Cooldown: 10s
 *   - 100 HP
 *   - Malfunction chance: 15%
 *   - Fuel: 0 (batteries pre-charged)
 */
export class CarBatteryGrid extends TrapBase {
  /** Stun duration in ms applied to all zombies in zone. */
  public readonly stunDuration: number = 2000;

  /** Zone width/height in pixels (3x3 tiles). */
  public readonly zoneSize: number = ZONE_SIZE;

  /** Discharge flash timer in ms. */
  private dischargeTimer: number = 0;

  /** Animated spark phase. */
  private sparkPhase: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      100,    // maxHp
      10000,  // cooldownMs (10s)
      0,      // overheatMax (no overheat)
      0,      // recoveryMs
      0.15,   // malfunctionChance
      -1,     // uses (-1 = unlimited)
      0,      // fuelPerNight (battery pre-charged)
    );
  }

  protected draw(): void {
    this.clear();

    // Dark asphalt background for 3x3 zone
    this.fillStyle(0x111118);
    this.fillRect(0, 0, ZONE_SIZE, TILE_SIZE);

    const isReady = this.isReady() && !this.malfunctioned;

    // Battery cells -- 3 visible units across the tile
    const batteryWidth = (ZONE_SIZE - 8) / 3;
    for (let b = 0; b < 3; b++) {
      const bx = 4 + b * batteryWidth;
      const battColor = isReady ? 0x224411 : 0x222222;
      this.fillStyle(battColor);
      this.fillRect(bx, 4, batteryWidth - 2, TILE_SIZE - 8);

      // Battery terminal
      this.fillStyle(0x888866);
      this.fillCircle(bx + (batteryWidth - 2) / 2, 5, 3);

      // Charge indicator bar
      const chargeColor = isReady ? 0x44FF44 : 0x333333;
      const chargeHeight = isReady ? TILE_SIZE - 16 : 0;
      this.fillStyle(chargeColor, 0.4);
      this.fillRect(bx + 3, TILE_SIZE - 6 - chargeHeight, batteryWidth - 8, chargeHeight);
    }

    // Wire grid pattern connecting batteries
    if (isReady) {
      // Animated sparks on the wire grid
      const spark = Math.sin(this.sparkPhase) * 3;
      this.lineStyle(1, 0x44AAFF, 0.5);
      const mid = TILE_SIZE / 2;
      // Horizontal wire
      this.lineBetween(4, mid + spark, ZONE_SIZE - 4, mid - spark);
      // Connecting nodes
      for (let i = 1; i < 3; i++) {
        const nx = 4 + i * batteryWidth;
        this.fillStyle(0x44FFAA, 0.6);
        this.fillCircle(nx, mid, 2);
      }
    }

    // Discharge flash when activated
    if (this.dischargeTimer > 0) {
      const intensity = this.dischargeTimer / 300;
      // Full zone shock flash
      this.fillStyle(0x44AAFF, 0.35 * intensity);
      this.fillRect(0, 0, ZONE_SIZE, TILE_SIZE);
      // Bright arc lines across zone
      this.lineStyle(2, 0xFFFFFF, 0.7 * intensity);
      this.lineBetween(0, TILE_SIZE / 2, ZONE_SIZE, TILE_SIZE / 2);
      this.lineStyle(1, 0x88CCFF, 0.5 * intensity);
      this.lineBetween(ZONE_SIZE / 2, 0, ZONE_SIZE / 2, TILE_SIZE);
    }

    // Zone boundary indicator
    this.lineStyle(1, isReady ? 0x2244AA : 0x222233, 0.3);
    this.strokeRect(0, 0, ZONE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    if (this.dischargeTimer > 0) {
      this.dischargeTimer = Math.max(0, this.dischargeTimer - delta);
    }

    if (!this.malfunctioned && this.isReady()) {
      this.sparkPhase += delta * 0.010;
    }

    this.clear();
    this.draw();
  }

  /** Trigger the discharge flash. Called by NightScene after activation. */
  triggerDischargeEffect(): void {
    this.dischargeTimer = 300;
    this.clear();
    this.draw();
  }

  /**
   * Stun the zombie. NightScene calls this for ALL zombies in the 3x3 zone
   * after a single tryActivate() succeeds.
   */
  onZombieContact(zombie: Zombie): void {
    zombie.applyStun(this.stunDuration);
    this.dischargeTimer = 300;
  }

  /**
   * Check if a world-space point is inside the 3x3 zone.
   * The zone extends 3 tiles wide and 1 tile tall (horizontal layout).
   */
  containsPoint(wx: number, wy: number): boolean {
    const x0 = this.structureInstance.x;
    const y0 = this.structureInstance.y;
    return wx >= x0 && wx <= x0 + ZONE_SIZE &&
           wy >= y0 && wy <= y0 + TILE_SIZE;
  }
}
