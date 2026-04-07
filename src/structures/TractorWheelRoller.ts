import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/** How far the roller travels in one activation (pixels). */
const ROLL_DISTANCE = TILE_SIZE * 4;
/** Damage per zombie hit. */
const DAMAGE = 100;

/**
 * Tractor Wheel Roller -- a massive tractor wheel on a ramp that rolls down
 * a corridor crushing everything in its path.
 *
 * Single-use trigger trap: uses=1.
 * Deals 100 dmg to all zombies in a straight line (4 tiles forward).
 * Activated when any zombie touches the tile.
 */
export class TractorWheelRoller extends TrapBase {
  public readonly rollDistance: number = ROLL_DISTANCE;
  public readonly damage: number = DAMAGE;

  /** Roll animation progress 0..1. */
  private rollProgress: number = 0;
  /** Whether the roll animation is playing. */
  private rolling: boolean = false;
  /** Timer ticking down roll animation (ms). */
  private rollTimer: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      80,    // maxHp
      0,     // cooldownMs (single use -- irrelevant)
      0,     // overheatMax
      0,     // recoveryMs
      0.10,  // malfunctionChance
      1,     // uses=1 (single-use)
      0,     // fuelPerNight
    );
  }

  protected draw(): void {
    this.clear();

    // Ramp base
    this.fillStyle(0x2A1A00);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;
    const wheelColor = this.uses === 0 ? 0x333333 : 0x4A3A1A;

    // Tractor tyre profile: large dark circle with tread marks
    this.fillStyle(wheelColor);
    this.fillCircle(mid, mid, mid - 3);

    // Inner rim
    this.fillStyle(0x666644);
    this.fillCircle(mid, mid, mid - 8);

    // Hub
    this.fillStyle(0x888866);
    this.fillCircle(mid, mid, 4);

    // Tread marks (radial lines on outer circle)
    if (this.uses !== 0) {
      this.lineStyle(2, 0x333322, 0.8);
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + this.rollProgress * Math.PI * 6;
        const r1 = mid - 8;
        const r2 = mid - 3;
        this.lineBetween(
          mid + Math.cos(angle) * r1, mid + Math.sin(angle) * r1,
          mid + Math.cos(angle) * r2, mid + Math.sin(angle) * r2,
        );
      }
    }

    // Roll animation: blur streaks
    if (this.rolling) {
      const alpha = (1 - this.rollProgress) * 0.7;
      this.fillStyle(0xFFAA44, alpha);
      this.fillRect(0, mid - 4, TILE_SIZE * this.rollProgress * 4, 8);
    }

    // Used indicator: X mark
    if (this.uses === 0) {
      this.lineStyle(3, 0x442222, 0.9);
      this.lineBetween(4, 4, TILE_SIZE - 4, TILE_SIZE - 4);
      this.lineBetween(TILE_SIZE - 4, 4, 4, TILE_SIZE - 4);
    }

    // Border
    this.lineStyle(1, 0xBB9944, 0.3);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    if (this.rolling) {
      this.rollTimer = Math.max(0, this.rollTimer - delta);
      this.rollProgress = 1 - this.rollTimer / 400;
      if (this.rollTimer === 0) {
        this.rolling = false;
        this.rollProgress = 1;
      }
      this.clear();
      this.draw();
    }
  }

  /**
   * Trigger the roll animation. Called by NightScene after activation.
   */
  triggerRoll(): void {
    this.rolling = true;
    this.rollTimer = 400;
    this.rollProgress = 0;
  }

  onZombieContact(zombie: Zombie): void {
    // NightScene handles AOE line damage; this deals with the triggering zombie.
    zombie.takeDamage(this.damage);
  }
}
