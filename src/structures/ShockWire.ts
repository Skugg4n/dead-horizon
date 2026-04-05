import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/**
 * Shock Wire -- an electrified wire that stuns and damages zombies on contact.
 * Tier 2 mechanical trap: extends TrapBase (cooldown, malfunction support).
 *
 * Stats (from structures.json):
 *   - 15 dmg + stun 3s per activation
 *   - 10 uses before the wire burns out
 *   - Cooldown: 8s between shocks
 *   - 60 HP structural durability
 *   - Malfunction chance: 10%
 */
export class ShockWire extends TrapBase {
  /** Damage per activation (from structures.json). */
  public readonly trapDamage: number;

  /** Stun duration in ms (from structures.json). */
  public readonly stunDuration: number;

  /** Spark phase for animated electric effect. */
  private sparkPhase: number = 0;

  /**
   * Discharge flash timer. Active immediately after activation.
   * While > 0, a bright blue/white arc flash is rendered.
   */
  private dischargeTimer: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      60,     // maxHp
      8000,   // cooldownMs (8s)
      0,      // overheatMax (no overheat)
      0,      // recoveryMs
      0.10,   // malfunctionChance
      10,     // uses (10 shocks before burnout)
      0,      // fuelPerNight
    );
    // Values match structures.json; kept here as class constants for easy access
    this.trapDamage = 15;
    this.stunDuration = 3000;
  }

  protected draw(): void {
    this.clear();

    // Dark metallic background
    this.fillStyle(0x0A0A18);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;
    const isActive = this.isReady() && !this.malfunctioned;

    // Wire posts on left and right
    this.fillStyle(0x666688);
    this.fillRect(2, mid - 6, 4, 12);  // left post
    this.fillRect(TILE_SIZE - 6, mid - 6, 4, 12);  // right post

    // Insulators (white caps)
    this.fillStyle(0xCCCCDD);
    this.fillCircle(4, mid, 3);
    this.fillCircle(TILE_SIZE - 4, mid, 3);

    if (this.dischargeTimer > 0) {
      // Discharge flash: bright white/blue blast across the entire tile
      const intensity = this.dischargeTimer / 200;
      this.fillStyle(0xAADDFF, 0.4 * intensity);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

      // Bright central arc -- thicker and brighter than normal
      this.lineStyle(3, 0xFFFFFF, intensity);
      this.lineBetween(6, mid, TILE_SIZE - 6, mid);

      // Branch arcs radiating from center
      const branchY = mid + Math.sin(this.sparkPhase * 4) * 6;
      this.lineStyle(1, 0x88CCFF, intensity * 0.8);
      this.lineBetween(TILE_SIZE / 2, mid, TILE_SIZE / 2 - 4, branchY);
      this.lineBetween(TILE_SIZE / 2, mid, TILE_SIZE / 2 + 3, branchY - 4);

      // Glow corona
      this.lineStyle(4, 0x2266CC, 0.2 * intensity);
      this.lineBetween(4, mid, TILE_SIZE - 4, mid);

    } else if (isActive) {
      // Animated arc: zigzag lightning between posts
      const spark = Math.sin(this.sparkPhase) * 5;
      this.lineStyle(1, 0x44AAFF, 0.9);
      this.lineBetween(6, mid, 10, mid + spark);
      this.lineBetween(10, mid + spark, 14, mid - spark * 0.7);
      this.lineBetween(14, mid - spark * 0.7, 18, mid + spark * 0.5);
      this.lineBetween(18, mid + spark * 0.5, 22, mid - spark);
      this.lineBetween(22, mid - spark, 26, mid);

      // Outer glow
      this.lineStyle(2, 0x2266CC, 0.3);
      this.lineBetween(6, mid, 26, mid + spark * 0.3);
    } else {
      // Inactive: grey wire
      this.lineStyle(1, 0x444444, 0.6);
      this.lineBetween(6, mid, TILE_SIZE - 6, mid);
    }

    // Uses remaining indicator: small dots below the wire
    if (this.uses > 0 && this.uses <= 10) {
      for (let i = 0; i < this.uses; i++) {
        const dotX = 3 + i * 3;
        this.fillStyle(isActive ? 0x44AAFF : 0x444444, 0.7);
        this.fillCircle(dotX, TILE_SIZE - 4, 1);
      }
    }

    // Border
    this.lineStyle(1, 0x3344AA, 0.3);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    // Count down discharge flash
    if (this.dischargeTimer > 0) {
      this.dischargeTimer = Math.max(0, this.dischargeTimer - delta);
    }

    // Animate spark effect when active
    if (this.isReady() && !this.malfunctioned) {
      this.sparkPhase += delta * 0.015;
    }

    this.clear();
    this.draw();
  }

  /**
   * Trigger the electric discharge visual effect.
   * Called by NightScene immediately after a zombie is shocked.
   */
  triggerActivationEffect(): void {
    this.dischargeTimer = 200; // 200ms bright discharge flash
    this.clear();
    this.draw();
  }

  onZombieContact(zombie: Zombie): void {
    zombie.takeDamage(this.trapDamage);
    zombie.applyStun(this.stunDuration);
  }
}
