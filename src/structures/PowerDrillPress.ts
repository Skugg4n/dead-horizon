import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/**
 * Power Drill Press -- a heavy hydraulic drill that slams down onto a single target.
 * Tier 3 single-target machine: 80 damage, 4s cooldown.
 *
 * Stats:
 *   - 80 dmg per activation (single target)
 *   - Cooldown: 4s
 *   - No overheat
 *   - Malfunction chance: 15%
 */
export class PowerDrillPress extends TrapBase {
  /** Damage per activation. */
  public readonly trapDamage: number = 80;

  /** Drill extension animation state (0 = retracted, 1 = extended). */
  private drillExtension: number = 0;

  /** Whether drill is currently pressing down. */
  private pressing: boolean = false;

  /** Impact flash timer. */
  private impactFlashTimer: number = 0;

  /** Drill spin angle for the rotating bit. */
  private drillAngle: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      100,    // maxHp
      4000,   // cooldownMs (4s)
      0,      // overheatMax (no overheat)
      0,      // recoveryMs
      0.15,   // malfunctionChance
      -1,     // uses (unlimited)
      0,      // fuelPerNight
    );
  }

  protected draw(): void {
    this.clear();

    // Dark industrial background
    this.fillStyle(0x0A0A12);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;
    const isActive = this.isReady() && !this.malfunctioned;

    // Mounting column (left side fixed support)
    this.fillStyle(0x444455);
    this.fillRect(3, 0, 6, TILE_SIZE);

    // Horizontal arm that moves up/down based on drillExtension
    const armY = 4 + this.drillExtension * (TILE_SIZE * 0.45);
    this.fillStyle(isActive ? 0x8888AA : 0x555566);
    this.fillRect(3, armY, TILE_SIZE - 6, 5);

    // Drill body
    const drillBodyY = armY + 5;
    const drillBodyHeight = TILE_SIZE - armY - 12;
    this.fillStyle(0x999999);
    this.fillRect(mid - 4, drillBodyY, 8, Math.max(4, drillBodyHeight));

    // Drill bit tip (triangular rotating drill)
    const tipY = drillBodyY + Math.max(4, drillBodyHeight);
    // Rotate drill tip flutes using cos only (sin unused -- flutes are symmetric around vertical axis)
    const cos = Math.cos(this.drillAngle) * 3;

    this.fillStyle(isActive ? 0xCCCCCC : 0x666666);
    // Draw a pointed tip with 2 cutting flutes (mirror symmetric)
    this.fillTriangle(
      mid, tipY + 6,
      mid - 4 + cos, tipY,
      mid + 4 + cos, tipY,
    );
    this.fillTriangle(
      mid, tipY + 6,
      mid - 4 - cos, tipY,
      mid + 4 - cos, tipY,
    );

    // Chuck (collet) holding the bit
    this.fillStyle(0x777788);
    this.fillRect(mid - 5, drillBodyY + Math.max(4, drillBodyHeight) - 4, 10, 5);

    // Impact flash
    if (this.impactFlashTimer > 0) {
      const intensity = this.impactFlashTimer / 200;
      this.fillStyle(0xFFAA00, 0.6 * intensity);
      this.fillCircle(mid, tipY + 6, 8 * intensity + 3);
      this.fillStyle(0xFFFFFF, 0.4 * intensity);
      this.fillCircle(mid, tipY + 6, 4 * intensity);
    }

    // Border
    this.lineStyle(1, isActive ? 0x6677AA : 0x333344, 0.4);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    // Animate drill extension (press down then retract)
    if (this.pressing) {
      this.drillExtension = Math.min(1.0, this.drillExtension + delta * 0.008);
      if (this.drillExtension >= 1.0) {
        this.pressing = false;
      }
    } else if (this.drillExtension > 0) {
      this.drillExtension = Math.max(0, this.drillExtension - delta * 0.005);
    }

    // Spin drill bit when active
    if (!this.malfunctioned && !this.overheated) {
      this.drillAngle += (delta / 1000) * Math.PI * 8; // very fast spin
    }

    // Tick impact flash
    if (this.impactFlashTimer > 0) {
      this.impactFlashTimer = Math.max(0, this.impactFlashTimer - delta);
    }

    this.clear();
    this.draw();
  }

  /** Trigger press animation and impact flash. Called by NightScene on activation. */
  triggerPressEffect(): void {
    this.pressing = true;
    this.drillExtension = 0.3;
    this.impactFlashTimer = 200;
    this.clear();
    this.draw();
  }

  onZombieContact(zombie: Zombie): void {
    zombie.takeDamage(this.trapDamage);
    // Brief stun from the impact force
    zombie.applyStun(500);
    this.triggerPressEffect();
  }
}
