import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/** AOE radius of the axe swing in pixels. */
const SWING_RADIUS = 48;

/**
 * Pendulum Axe -- a fire axe on a rope that swings back and forth.
 * Triggered by zombie proximity: the axe sweeps through a wide arc
 * dealing high single-hit damage to all zombies caught in the swing.
 *
 * Stats (structures.json):
 *   - 45 dmg per swing
 *   - Cooldown: 5s
 *   - Swing AOE radius: 48px
 *   - 100 HP
 *   - Malfunction chance: 15%
 *   - No fuel
 */
export class PendulumAxe extends TrapBase {
  /** Damage per activation (swing). */
  public readonly trapDamage: number = 45;

  /** Swing AOE radius in pixels. */
  public readonly swingRadius: number = SWING_RADIUS;

  /** Current pendulum angle in radians. Oscillates between -PI/2 and +PI/2. */
  private pendulumAngle: number = 0;

  /** Swing animation direction: +1 or -1. */
  private swingDir: number = 1;

  /** Swing animation active timer in ms. */
  private swingTimer: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      100,   // maxHp
      5000,  // cooldownMs (5s)
      0,     // overheatMax (no overheat)
      0,     // recoveryMs
      0.15,  // malfunctionChance
      -1,    // uses (-1 = unlimited)
      0,     // fuelPerNight
    );
  }

  protected draw(): void {
    this.clear();

    // Wooden post background
    this.fillStyle(0x1A1208);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;
    const isActive = this.isReady() && !this.malfunctioned;
    const isSwigging = this.swingTimer > 0;

    // Pivot mount at top center
    this.fillStyle(0x888866);
    this.fillCircle(mid, 5, 4);

    // Rope
    const ropeLength = 20;
    const ropeEndX = mid + Math.sin(this.pendulumAngle) * ropeLength;
    const ropeEndY = 5 + Math.cos(this.pendulumAngle) * ropeLength;

    this.lineStyle(1, 0xBBAA77, 0.8);
    this.lineBetween(mid, 5, ropeEndX, ropeEndY);

    // Axe head at end of rope
    const axeColor = isActive ? 0xCCCCCC : 0x555555;

    // Axe handle (small rod beyond rope end)
    const handleLen = 6;
    const handleAngle = this.pendulumAngle;
    const hx1 = ropeEndX - Math.sin(handleAngle) * 3;
    const hy1 = ropeEndY - Math.cos(handleAngle) * 3;
    const hx2 = ropeEndX + Math.sin(handleAngle) * handleLen;
    const hy2 = ropeEndY + Math.cos(handleAngle) * handleLen;

    this.lineStyle(2, 0x997744, 0.9);
    this.lineBetween(hx1, hy1, hx2, hy2);

    // Axe blade: perpendicular shape
    const perpAngle = this.pendulumAngle + Math.PI / 2;
    this.fillStyle(axeColor, 0.9);
    const bladeX = hx1 + Math.sin(handleAngle) * 2;
    const bladeY = hy1 + Math.cos(handleAngle) * 2;
    this.lineStyle(3, axeColor, 0.9);
    this.lineBetween(
      bladeX - Math.cos(perpAngle) * 5,
      bladeY - Math.sin(perpAngle) * 5,
      bladeX + Math.cos(perpAngle) * 5,
      bladeY + Math.sin(perpAngle) * 5,
    );

    // Swing arc indicator (faint semicircle showing sweep)
    if (isActive) {
      this.lineStyle(1, 0xFF4444, 0.15);
      this.strokeCircle(mid, 5, ropeLength + handleLen);
    }

    // Flash on swing
    if (isSwigging) {
      const intensity = this.swingTimer / 300;
      this.lineStyle(2, 0xFF8800, 0.4 * intensity);
      this.strokeCircle(mid, 5, ropeLength + handleLen);
    }

    // Border
    this.lineStyle(1, 0xE8DCC8, 0.15);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    // Tick swing animation
    if (this.swingTimer > 0) {
      this.swingTimer = Math.max(0, this.swingTimer - delta);
    }

    // Pendulum idle sway (slow when ready, frozen when on cooldown)
    const swaySpeed = this.cooldownTimer > 0 ? 0.5 : 1.5;
    this.pendulumAngle += this.swingDir * (delta / 1000) * swaySpeed;
    if (Math.abs(this.pendulumAngle) > Math.PI * 0.4) {
      this.swingDir = -this.swingDir;
    }

    this.clear();
    this.draw();
  }

  /** Trigger fast swing animation on activation. */
  triggerActivationEffect(): void {
    this.swingTimer = 300;
    this.swingDir = this.swingDir * -1; // reverse direction on hit
    this.clear();
    this.draw();
  }

  onZombieContact(zombie: Zombie): void {
    zombie.takeDamage(this.trapDamage);
    this.swingTimer = 300;
  }
}
