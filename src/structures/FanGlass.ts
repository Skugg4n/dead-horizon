import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/** Damage per second while in glass-shard cone. */
const DAMAGE_PER_SECOND = 15;
/** Cone range in pixels. */
const CONE_RANGE = 80;
/** Half-angle of cone (radians). */
const CONE_HALF_ANGLE = Math.PI / 5; // 36 degrees each side

/**
 * Fan + Glass -- an industrial fan blows glass shards in a cone.
 * Continuous 15 dmg/s to zombies inside the cone. Cooldown 2s between bursts.
 *
 * Costs 6 scrap, 3 parts. Malfunction 12%.
 */
export class FanGlass extends TrapBase {
  public readonly damagePerSecond: number = DAMAGE_PER_SECOND;
  public readonly coneRange: number = CONE_RANGE;
  public readonly coneHalfAngle: number = CONE_HALF_ANGLE;

  /** Fan blade rotation angle. */
  private fanAngle: number = 0;
  /** Active burst flash timer (ms). */
  private burstTimer: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      80,    // maxHp
      2000,  // cooldownMs (2s between bursts)
      0,     // overheatMax
      0,     // recoveryMs
      0.12,  // malfunctionChance
      -1,    // uses: unlimited
      0,     // fuelPerNight
    );
  }

  protected draw(): void {
    this.clear();

    const mid = TILE_SIZE / 2;
    const active = this.isReady() && !this.malfunctioned;

    // Metal housing background
    this.fillStyle(0x1A1A1A);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Fan housing (circular)
    this.fillStyle(0x2A2A2A);
    this.fillCircle(mid, mid, mid - 2);

    // Fan blades (4-blade propeller)
    const bladeColor = active ? 0x888877 : 0x444444;
    for (let i = 0; i < 4; i++) {
      const angle = this.fanAngle + (i / 4) * Math.PI * 2;
      const bx = mid + Math.cos(angle) * 8;
      const by = mid + Math.sin(angle) * 8;
      this.lineStyle(4, bladeColor);
      this.lineBetween(mid, mid, bx, by);
      // Blade tip widened
      this.fillStyle(bladeColor);
      this.fillRect(bx - 2, by - 2, 4, 4);
    }

    // Fan hub
    this.fillStyle(0xAA9966);
    this.fillCircle(mid, mid, 3);

    // Glass shards burst cone (visual indicator of direction: pointing right by default)
    if (active && this.burstTimer > 0) {
      const alpha = (this.burstTimer / 200) * 0.7;
      // Light blue/clear glass fragments
      this.fillStyle(0xAADDEE, alpha);
      // Draw cone to the right
      const steps = 8;
      for (let s = 0; s < steps; s++) {
        const frac = s / steps;
        const spread = (Math.random() - 0.5) * 0.6;
        const px = mid + Math.cos(spread) * CONE_RANGE * 0.4 * frac;
        const py = mid + Math.sin(spread) * CONE_RANGE * 0.3 * frac;
        this.fillRect(px - 1, py - 1, 3, 2);
      }
    }

    // Housing rim
    this.lineStyle(2, 0x444433);
    this.strokeCircle(mid, mid, mid - 2);

    // Grille bars
    this.lineStyle(1, 0x333322, 0.5);
    this.lineBetween(mid - 10, mid, mid + 10, mid);
    this.lineBetween(mid, mid - 10, mid, mid + 10);

    // Border
    this.lineStyle(1, 0x666633, 0.25);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    if (this.isReady() && !this.malfunctioned) {
      this.fanAngle += (delta / 1000) * Math.PI * 6; // 3 rotations/sec
    }

    if (this.burstTimer > 0) {
      this.burstTimer = Math.max(0, this.burstTimer - delta);
    }

    this.clear();
    this.draw();
  }

  /**
   * Trigger a visual burst effect on activation. Called by NightScene.
   */
  triggerActivationEffect(): void {
    this.burstTimer = 200;
  }

  /**
   * Check if a world-space point is inside the glass shard cone.
   * Cone points in the +X direction (right) by default (towards enemy approach).
   */
  containsPoint(wx: number, wy: number): boolean {
    if (!this.isReady() || this.malfunctioned) return false;
    const cx = this.structureInstance.x + TILE_SIZE / 2;
    const cy = this.structureInstance.y + TILE_SIZE / 2;
    const dx = wx - cx;
    const dy = wy - cy;
    const distSq = dx * dx + dy * dy;
    if (distSq > this.coneRange * this.coneRange) return false;
    // Cone angle: we point toward the nearest map edge (away from base center).
    // NightScene handles direction; here we use a wide forward cone.
    const angle = Math.atan2(dy, dx);
    const angleDiff = Math.abs(angle);
    return angleDiff < this.coneHalfAngle;
  }

  onZombieContact(zombie: Zombie): void {
    // Per-frame fractional damage calculated by NightScene using delta.
    zombie.takeDamage(this.damagePerSecond * (16 / 1000));
  }
}
