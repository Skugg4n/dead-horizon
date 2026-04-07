import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/** AOE radius for the wrecking ball swing. */
const AOE_RADIUS = 64;
/** Damage per activation. */
const DAMAGE = 70;

/**
 * Wrecking Ball -- a demolition crane arm that swings a heavy iron ball
 * in a wide arc, dealing AOE damage to all nearby zombies.
 *
 * Stats: 70 dmg AOE 64px, cd 10s, unlimited uses.
 * Malfunctions 15% of nights. No fuel cost.
 */
export class WreckingBall extends TrapBase {
  public readonly aoeRadius: number = AOE_RADIUS;
  public readonly damage: number = DAMAGE;

  /** Swing animation phase in radians. */
  private swingAngle: number = -Math.PI / 4;
  /** Direction of swing animation. */
  private swingDir: number = 1;
  /** Timer for impact flash (ms). */
  private impactTimer: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      150,   // maxHp
      10000, // cooldownMs (10s)
      0,     // overheatMax
      0,     // recoveryMs
      0.15,  // malfunctionChance
      -1,    // uses: unlimited
      0,     // fuelPerNight
    );
  }

  protected draw(): void {
    this.clear();

    const mid = TILE_SIZE / 2;

    // Crane arm base
    this.fillStyle(0x1A1A0A);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Structural pillar
    this.fillStyle(0x666644);
    this.fillRect(mid - 3, 4, 6, TILE_SIZE - 8);

    // Arm extending from top of pillar
    const armAngle = this.swingAngle;
    const armLen = mid - 4;
    const armEndX = mid + Math.cos(armAngle) * armLen;
    const armEndY = 6 + Math.sin(armAngle) * armLen;

    this.lineStyle(3, 0x888866);
    this.lineBetween(mid, 6, armEndX, armEndY);

    // Chain (dashed line from arm end to ball)
    const chainLen = 8;
    const chainEndX = armEndX + Math.cos(armAngle + Math.PI / 2) * chainLen;
    const chainEndY = armEndY + Math.sin(armAngle + Math.PI / 2) * chainLen;
    this.lineStyle(1, 0x555544);
    this.lineBetween(armEndX, armEndY, chainEndX, chainEndY);

    // Ball
    const ballR = 5;
    this.fillStyle(0x444433);
    this.fillCircle(chainEndX, chainEndY, ballR);
    // Highlight
    this.fillStyle(0x888877, 0.5);
    this.fillCircle(chainEndX - 1, chainEndY - 1, 2);

    // Impact flash
    if (this.impactTimer > 0) {
      const alpha = this.impactTimer / 200;
      this.fillStyle(0xFFCC44, 0.6 * alpha);
      this.fillCircle(mid, mid, AOE_RADIUS / 4);
    }

    // Border
    this.lineStyle(1, 0x888866, 0.2);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    // Animate arm swing when ready
    if (this.isReady()) {
      this.swingAngle += this.swingDir * (delta / 1000) * 2.5;
      if (this.swingAngle > Math.PI / 3) this.swingDir = -1;
      if (this.swingAngle < -Math.PI / 3) this.swingDir = 1;
    }

    // Count down impact flash
    if (this.impactTimer > 0) {
      this.impactTimer = Math.max(0, this.impactTimer - delta);
    }

    this.clear();
    this.draw();
  }

  /**
   * Trigger the impact flash. Called by NightScene after activation.
   */
  triggerImpact(): void {
    this.impactTimer = 200;
  }

  onZombieContact(zombie: Zombie): void {
    zombie.takeDamage(this.damage);
  }
}
