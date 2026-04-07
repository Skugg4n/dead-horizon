import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/**
 * Meat Grinder -- industrial grinding machine that shreds zombies in a 2-tile zone.
 * Tier 3 slaughter machine: horrifying AOE damage to everything nearby.
 *
 * Stats:
 *   - 50 dmg/s in 2-tile AOE zone (continuous, delta-based)
 *   - Cooldown: 6s between activation pulses
 *   - Overheat after 20s of operation
 *   - Malfunction chance: 25%
 *   - Fuel: 2 food/night
 *   - Unlimited uses
 *
 * Visual: rotating chains + saw blades with blood-spray particles on activation
 */
export class MeatGrinder extends TrapBase {
  /** Damage per second applied to zombies in zone (delta-based). */
  public readonly damagePerSecond: number = 50;

  /** Zone radius: 2 tiles (2 * TILE_SIZE). */
  public readonly zoneRadius: number = TILE_SIZE * 2;

  /** Chain rotation angle for animation. */
  private chainAngle: number = 0;

  /** Inner blade rotation (counter-rotating for visual interest). */
  private bladeAngle: number = 0;

  /** Activation gore flash timer (ms). Counts down after each damage pulse. */
  private goreFlashTimer: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      120,    // maxHp -- heavy industrial machine
      6000,   // cooldownMs (6s)
      20000,  // overheatMax (20s)
      15000,  // recoveryMs (15s recovery when overheated)
      0.25,   // malfunctionChance (25%)
      -1,     // uses (-1 = unlimited)
      1,      // fuelPerNight (1 food -- balance v2.5.0: reduced from 2)
    );
  }

  protected draw(): void {
    this.clear();

    // Heavy industrial dark background
    this.fillStyle(0x0D0D0D);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;
    const isActive = this.isReady() && !this.malfunctioned;

    // Outer housing -- chunky metal frame
    this.lineStyle(3, 0x555555);
    this.strokeRect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4);

    // Corner bolts
    this.fillStyle(0x888888);
    this.fillCircle(5, 5, 2);
    this.fillCircle(TILE_SIZE - 5, 5, 2);
    this.fillCircle(5, TILE_SIZE - 5, 2);
    this.fillCircle(TILE_SIZE - 5, TILE_SIZE - 5, 2);

    // Chain links: two rotating chain loops (drawn as segmented arcs)
    const chainColor = isActive ? 0xAA8833 : 0x666644;
    this.lineStyle(2, chainColor, 0.9);

    // Left chain loop
    for (let i = 0; i < 4; i++) {
      const angle = this.chainAngle + (i * Math.PI / 2);
      const lx = mid - 6 + Math.cos(angle) * 5;
      const ly = mid + Math.sin(angle) * 8;
      this.fillStyle(chainColor, 0.9);
      this.fillRect(lx - 1, ly - 1, 3, 2);
    }

    // Right chain loop (counter-rotating)
    for (let i = 0; i < 4; i++) {
      const angle = -this.chainAngle + (i * Math.PI / 2);
      const rx = mid + 6 + Math.cos(angle) * 5;
      const ry = mid + Math.sin(angle) * 8;
      this.fillStyle(chainColor, 0.9);
      this.fillRect(rx - 1, ry - 1, 3, 2);
    }

    // Central blade assembly: two crossed blades
    const bladeColor = isActive ? 0xCCCCCC : 0x666666;
    const bladeLen = 8;
    const cos = Math.cos(this.bladeAngle);
    const sin = Math.sin(this.bladeAngle);

    this.lineStyle(3, bladeColor, 1.0);
    this.lineBetween(
      mid - cos * bladeLen, mid - sin * bladeLen,
      mid + cos * bladeLen, mid + sin * bladeLen,
    );

    // Second perpendicular blade
    this.lineStyle(2, bladeColor, 0.8);
    this.lineBetween(
      mid - sin * bladeLen, mid + cos * bladeLen,
      mid + sin * bladeLen, mid - cos * bladeLen,
    );

    // Central hub
    this.fillStyle(0x884422);
    this.fillCircle(mid, mid, 4);

    // Gore flash: dark red blood splatter when actively grinding
    if (this.goreFlashTimer > 0) {
      const intensity = this.goreFlashTimer / 300;
      this.fillStyle(0x880000, 0.5 * intensity);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

      // Blood drops radiating outward
      const dropCount = 5;
      for (let i = 0; i < dropCount; i++) {
        const a = (i / dropCount) * Math.PI * 2 + this.chainAngle;
        const r = 6 + intensity * 4;
        this.fillStyle(0xCC0000, 0.7 * intensity);
        this.fillCircle(mid + Math.cos(a) * r, mid + Math.sin(a) * r, 2);
      }
    }

    // Border
    this.lineStyle(1, 0xFF4400, isActive ? 0.5 : 0.15);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    // Spin chains and blades when active
    if (!this.malfunctioned && !this.overheated) {
      this.chainAngle += (delta / 1000) * Math.PI * 3;  // 1.5 rotations/s
      this.bladeAngle += (delta / 1000) * Math.PI * 5;  // faster inner blade
    }

    // Tick gore flash
    if (this.goreFlashTimer > 0) {
      this.goreFlashTimer = Math.max(0, this.goreFlashTimer - delta);
    }

    this.clear();
    this.draw();
  }

  /** Trigger blood-spray visual. Called by NightScene when zombie is damaged. */
  triggerGoreEffect(): void {
    this.goreFlashTimer = 300;
    this.clear();
    this.draw();
  }

  onZombieContact(zombie: Zombie): void {
    // Continuous damage handled in NightScene (delta-based).
    // This fallback applies burst damage if called directly.
    zombie.takeDamage(this.damagePerSecond);
  }
}
