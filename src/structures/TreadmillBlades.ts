import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/** Continuous damage per second while zombie is on the belt. */
const DAMAGE_PER_SECOND = 25;
/** Pushback velocity applied each frame. */
const PUSHBACK_VEL = 60;

/**
 * Treadmill Blades -- a conveyor belt lined with blade stubs that drags
 * zombies backward while shredding them.
 *
 * Continuous damage 25 dmg/s + pushback. Unlimited uses.
 * Costs 8 scrap, 5 parts. Malfunction 15%.
 */
export class TreadmillBlades extends TrapBase {
  public readonly damagePerSecond: number = DAMAGE_PER_SECOND;
  public readonly pushbackVel: number = PUSHBACK_VEL;

  /** Belt animation offset (pixels). */
  private beltOffset: number = 0;
  /** Activation flash timer (ms). */
  private flashTimer: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      100,   // maxHp
      0,     // cooldownMs (continuous -- no discrete cooldown)
      0,     // overheatMax
      0,     // recoveryMs
      0.15,  // malfunctionChance
      -1,    // uses: unlimited
      1,     // fuelPerNight (1 food to keep belt running)
    );
  }

  protected draw(): void {
    this.clear();

    // Dark industrial background
    this.fillStyle(0x0A0A0A);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const active = this.isReady() && !this.malfunctioned;
    const beltColor  = active ? 0x443322 : 0x222222;
    const bladeColor = active ? 0xCCCCCC : 0x444444;

    // Belt surface (scrolling horizontal bands)
    this.fillStyle(beltColor);
    this.fillRect(2, 4, TILE_SIZE - 4, TILE_SIZE - 8);

    // Animated belt lines
    const spacing = 6;
    const offset = this.beltOffset % spacing;
    this.lineStyle(1, 0x333322, 0.7);
    for (let x = 2 + offset; x < TILE_SIZE - 2; x += spacing) {
      this.lineBetween(x, 4, x, TILE_SIZE - 4);
    }

    // Blade stubs poking up from belt
    const bladeCount = 5;
    for (let i = 0; i < bladeCount; i++) {
      const bx = 4 + ((i * (TILE_SIZE - 8) / (bladeCount - 1)) + this.beltOffset * 1.5) % (TILE_SIZE - 8);
      this.lineStyle(2, bladeColor);
      this.lineBetween(bx, 8, bx + 2, 4);
      this.lineBetween(bx, TILE_SIZE - 8, bx + 2, TILE_SIZE - 4);
    }

    // End rollers
    this.fillStyle(0x666644);
    this.fillRect(0, 4, 3, TILE_SIZE - 8);
    this.fillRect(TILE_SIZE - 3, 4, 3, TILE_SIZE - 8);

    // Active flash
    if (this.flashTimer > 0) {
      const alpha = (this.flashTimer / 120) * 0.6;
      this.fillStyle(0xFF4422, alpha);
      this.fillRect(2, 4, TILE_SIZE - 4, TILE_SIZE - 8);
    }

    // Border
    this.lineStyle(1, 0x666633, 0.3);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    if (this.isReady() && !this.malfunctioned) {
      // Scroll belt backward (belt moves AWAY from base -- zombies pushed back)
      this.beltOffset += delta * 0.05;
    }

    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - delta);
    }

    this.clear();
    this.draw();
  }

  /**
   * Trigger a visual flash when a zombie is actively being shredded.
   */
  triggerActivationEffect(): void {
    this.flashTimer = 120;
  }

  onZombieContact(zombie: Zombie): void {
    // Continuous damage: NightScene calls this every frame with delta-scaled damage.
    zombie.takeDamage(this.damagePerSecond * (16 / 1000)); // rough per-frame damage

    // Pushback: push zombie away from base (in the direction away from center)
    if (zombie.body) {
      const cx = this.structureInstance.x + TILE_SIZE / 2;
      const dx = zombie.x - cx;
      const len = Math.abs(dx);
      if (len > 0) {
        // Push horizontally (belt axis)
        zombie.body.velocity.x += (dx / len) * this.pushbackVel;
      }
    }
  }
}
