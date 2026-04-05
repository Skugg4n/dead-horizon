import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/** Knockback force in pixels per second (applied as impulse). */
const KNOCKBACK_DISTANCE = 80;

/**
 * Spring Launcher -- a coiled spring mechanism that launches zombies away on contact.
 * Tier 2 mechanical trap: extends TrapBase (cooldown, malfunction).
 *
 * Stats (from structures.json):
 *   - 40 dmg + knockback 80px from center
 *   - Cooldown: 5s
 *   - 80 HP structural durability
 *   - Malfunction chance: 10%
 *   - Unlimited uses
 */
export class SpringLauncher extends TrapBase {
  /** Damage per activation (from structures.json). */
  public readonly trapDamage: number;

  /** Knockback distance in pixels. */
  public readonly knockbackDistance: number = KNOCKBACK_DISTANCE;

  /** Spring compression animation phase. */
  private springPhase: number = 0;

  /** Launch animation timer in ms. Counts down from 250 to 0 after activation. */
  private launchAnimTimer: number = 0;

  /**
   * Orange burst flash timer. Separate from launchAnimTimer -- used for
   * the bright impact flash that is more visible than the spring animation.
   */
  private flashTimer: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      80,     // maxHp
      5000,   // cooldownMs (5s)
      0,      // overheatMax (no overheat)
      0,      // recoveryMs
      0.10,   // malfunctionChance
      -1,     // uses (-1 = unlimited)
      0,      // fuelPerNight
    );
    this.trapDamage = 40;
  }

  protected draw(): void {
    this.clear();

    // Metal base background
    this.fillStyle(0x1A1200);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;
    const isLaunching = this.launchAnimTimer > 0;

    // Base plate (metallic)
    this.fillStyle(0x777755);
    this.fillRect(4, TILE_SIZE - 8, TILE_SIZE - 8, 6);

    // Spring coils: stack of horizontal lines with slight compression when cd active
    const compression = this.cooldownTimer > 0 ? 0.6 : (isLaunching ? 0.3 : 1.0);
    const springHeight = (TILE_SIZE - 16) * compression;
    const springBottom = TILE_SIZE - 10;
    const coilCount = 5;
    const coilSpacing = springHeight / coilCount;
    const springColor = this.isReady() && !this.malfunctioned ? 0xBBAA44 : 0x666655;

    for (let i = 0; i <= coilCount; i++) {
      const y = springBottom - i * coilSpacing;
      const wobble = (i % 2 === 0) ? 2 : -2;
      this.lineStyle(2, springColor);
      this.lineBetween(mid - 8 + wobble, y, mid + 8 - wobble, y);
    }

    // Launch plate on top of spring
    const plateY = springBottom - springHeight - 4;
    this.fillStyle(0x999966);
    this.fillRect(mid - 9, plateY, 18, 4);

    // Launch animation: bright flash at top (builtin spring anim)
    if (isLaunching) {
      this.fillStyle(0xFFFF88, 0.8);
      this.fillCircle(mid, plateY - 2, 6);
    }

    // Orange burst flash overlay on activation
    if (this.flashTimer > 0) {
      const intensity = this.flashTimer / 180;
      // Bright orange/yellow radial burst from center
      this.fillStyle(0xFF8800, 0.5 * intensity);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      // Brighter core
      this.fillStyle(0xFFCC00, 0.7 * intensity);
      this.fillCircle(mid, mid, 8 * intensity + 4);
      // Radiating lines suggesting impact force
      const lineAlpha = 0.8 * intensity;
      this.lineStyle(1, 0xFFAA22, lineAlpha);
      this.lineBetween(mid, mid, mid - 10, mid - 8);
      this.lineBetween(mid, mid, mid + 10, mid - 8);
      this.lineBetween(mid, mid, mid, mid - 12);
    }

    // Border
    this.lineStyle(1, 0xBBAA44, 0.25);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    // Tick launch animation timer
    if (this.launchAnimTimer > 0) {
      this.launchAnimTimer = Math.max(0, this.launchAnimTimer - delta);
    }

    // Tick flash timer
    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - delta);
    }

    // Animate spring oscillation when ready
    this.springPhase += delta * 0.008;
    this.clear();
    this.draw();
  }

  /**
   * Trigger the orange burst flash on activation.
   * Called by NightScene immediately after a zombie is launched.
   */
  triggerActivationEffect(): void {
    this.flashTimer = 180; // 180ms orange burst
    this.launchAnimTimer = 250; // spring animation continues a bit longer
    this.clear();
    this.draw();
  }

  onZombieContact(zombie: Zombie): void {
    zombie.takeDamage(this.trapDamage);

    // Apply knockback: push zombie away from trap center
    const cx = this.structureInstance.x + TILE_SIZE / 2;
    const cy = this.structureInstance.y + TILE_SIZE / 2;
    const dx = zombie.x - cx;
    const dy = zombie.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len > 0 && zombie.body) {
      // Normalised direction * knockback force (applied as velocity impulse)
      const nx = dx / len;
      const ny = dy / len;
      // Set velocity to represent a strong launch (fades naturally via Phaser physics drag)
      zombie.setVelocity(nx * KNOCKBACK_DISTANCE * 10, ny * KNOCKBACK_DISTANCE * 10);
    }

    // Trigger brief launch animation
    this.launchAnimTimer = 200;
  }
}
