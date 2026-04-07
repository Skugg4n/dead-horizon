import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/** Damage per zombie hit. */
const DAMAGE = 50;
/** Pushback force (pixels * 10 for velocity). */
const PUSHBACK = 120;
/** Line length in tiles. */
const LINE_TILES = 5;

/**
 * Log Avalanche -- stacked logs held back by a rope trigger.
 * When triggered, they roll down the slope dealing damage and pushback.
 *
 * Single-use. 50 dmg line + pushback. costs 8 scrap, 2 parts.
 */
export class LogAvalanche extends TrapBase {
  public readonly damage: number = DAMAGE;
  public readonly pushback: number = PUSHBACK;
  public readonly lineTiles: number = LINE_TILES;

  /** Animation timer for rolling logs (ms). */
  private rollTimer: number = 0;
  private rollProgress: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      60,    // maxHp
      0,     // cooldownMs (single use)
      0,     // overheatMax
      0,     // recoveryMs
      0.10,  // malfunctionChance
      1,     // uses=1 (single use)
      0,     // fuelPerNight
    );
  }

  protected draw(): void {
    this.clear();

    // Dirt/slope background
    this.fillStyle(0x1A1000);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const used = this.uses === 0;

    if (used) {
      // Empty ramp after triggering
      this.fillStyle(0x2A2000, 0.8);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      this.lineStyle(1, 0x443300, 0.5);
      this.lineBetween(2, TILE_SIZE - 4, TILE_SIZE - 2, 4);
      // Scattered small log remnants
      this.fillStyle(0x664422, 0.6);
      this.fillRect(4, TILE_SIZE - 10, 5, 3);
      this.fillRect(16, TILE_SIZE - 7, 4, 3);
    } else {
      // Stacked logs
      const logColor = 0x8B5E3C;
      const logDark  = 0x5A3A1A;

      // 4 logs stacked horizontally
      for (let i = 0; i < 4; i++) {
        const y = TILE_SIZE - 10 - i * 5;
        // Log body
        this.fillStyle(logColor);
        this.fillRect(2, y, TILE_SIZE - 4, 4);
        // End grain circle left
        this.fillStyle(logDark);
        this.fillCircle(4, y + 2, 2);
        // End grain circle right
        this.fillCircle(TILE_SIZE - 4, y + 2, 2);
        // Wood grain line
        this.lineStyle(1, logDark, 0.5);
        this.lineBetween(4, y + 2, TILE_SIZE - 4, y + 2);
      }

      // Holding rope
      this.lineStyle(2, 0xCC9944);
      this.lineBetween(TILE_SIZE / 2, TILE_SIZE - 30, TILE_SIZE / 2, 2);
      // Rope anchor
      this.fillStyle(0xAA8833);
      this.fillCircle(TILE_SIZE / 2, 3, 3);

      // Slope indicator arrows
      this.lineStyle(1, 0x886644, 0.6);
      this.lineBetween(6, 6, 14, 12);
      this.lineBetween(14, 6, 22, 12);
    }

    // Roll animation
    if (this.rollTimer > 0) {
      const alpha = this.rollProgress * 0.8;
      this.fillStyle(0xBB7733, alpha);
      this.fillRect(0, TILE_SIZE / 2 - 5, TILE_SIZE, 10);
    }

    // Border
    this.lineStyle(1, 0x886644, 0.3);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    if (this.rollTimer > 0) {
      this.rollTimer = Math.max(0, this.rollTimer - delta);
      this.rollProgress = this.rollTimer / 350;
      this.clear();
      this.draw();
    }
  }

  /**
   * Start roll animation. Called by NightScene after activation.
   */
  triggerRoll(): void {
    this.rollTimer = 350;
    this.rollProgress = 1;
  }

  onZombieContact(zombie: Zombie): void {
    zombie.takeDamage(this.damage);

    // Pushback: push zombie away in the same direction as the log roll (downward/south)
    if (zombie.body) {
      const cx = this.structureInstance.x + TILE_SIZE / 2;
      const dx = zombie.x - cx;
      const dy = zombie.y - (this.structureInstance.y + TILE_SIZE / 2);
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        zombie.setVelocity((dx / len) * PUSHBACK * 10, (dy / len) * PUSHBACK * 10);
      } else {
        // Default push south
        zombie.setVelocity(0, PUSHBACK * 10);
      }
    }
  }
}
