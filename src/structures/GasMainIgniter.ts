import Phaser from 'phaser';
import { TILE_SIZE, MAP_WIDTH } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/**
 * Gas Main Igniter -- taps into a buried gas line and ignites it across the entire map width.
 * A line of fire erupts from left to right at the trap's Y position. One use only.
 *
 * Stats:
 *   - 150 dmg to all zombies on the same horizontal line (map-wide)
 *   - 1 use (gas line is exhausted after ignition)
 *   - Stuns for 1s (knocked back by the blast)
 */
export class GasMainIgniter extends TrapBase {
  /** Damage to every zombie on the ignition line. */
  public readonly explosionDamage: number = 150;

  /** Full map width for the fire line. */
  public readonly lineWidth: number = MAP_WIDTH * TILE_SIZE;

  /** Detection band height: zombies within this Y range of the trap are hit. */
  public readonly detectionBand: number = TILE_SIZE * 1.5;

  /** Whether detonation has been triggered. */
  public detonated: boolean = false;

  /** Ignition animation timer. */
  private ignitionTimer: number = 0;

  /** Flame flicker phase. */
  private flickerPhase: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      60,     // maxHp
      0,      // cooldownMs (immediate)
      0,      // overheatMax
      0,      // recoveryMs
      0.08,   // malfunctionChance
      1,      // uses = 1 (single detonation)
      0,      // fuelPerNight
    );
  }

  protected draw(): void {
    this.clear();

    // Underground pipe aesthetic
    this.fillStyle(0x111122);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;
    const isActive = !this.malfunctioned && this.uses > 0;

    // Gas pipe running horizontally across the tile
    this.fillStyle(isActive ? 0x778899 : 0x445566);
    this.fillRect(0, mid - 4, TILE_SIZE, 8);

    // Pipe highlight
    this.lineStyle(1, 0x99AABB, isActive ? 0.5 : 0.2);
    this.lineBetween(0, mid - 3, TILE_SIZE, mid - 3);

    // Valve handle in center
    this.fillStyle(isActive ? 0xFF6600 : 0x666666);
    this.fillRect(mid - 5, mid - 6, 10, 12);

    // Valve wheel
    this.lineStyle(2, isActive ? 0xFFAA44 : 0x888888, 0.8);
    this.strokeCircle(mid, mid - 6, 5);
    this.lineBetween(mid - 5, mid - 6, mid + 5, mid - 6);
    this.lineBetween(mid, mid - 11, mid, mid - 1);

    // Warning stripes
    if (isActive) {
      this.fillStyle(0xFFCC00, 0.5);
      this.fillRect(2, TILE_SIZE - 8, 6, 6);
      this.fillRect(TILE_SIZE - 8, TILE_SIZE - 8, 6, 6);
    }

    // Flame flicker when primed
    if (isActive) {
      const flicker = Math.abs(Math.sin(this.flickerPhase)) * 0.4;
      this.fillStyle(0xFF4400, flicker);
      this.fillCircle(mid, mid + 4, 4 + flicker * 8);
    }

    // Ignition explosion visual
    if (this.ignitionTimer > 0) {
      const intensity = this.ignitionTimer / 500;
      // Full-tile fireball
      this.fillStyle(0xFFFF00, 0.9 * intensity);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      this.fillStyle(0xFF8800, 0.7 * intensity);
      this.fillCircle(mid, mid, TILE_SIZE * intensity);
      this.fillStyle(0xFF2200, 0.5 * intensity);
      this.fillCircle(mid, mid, TILE_SIZE * 0.6 * intensity);
    }

    // Border
    this.lineStyle(1, isActive ? 0xFF8833 : 0x334455, isActive ? 0.5 : 0.15);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    // Tick flicker phase
    this.flickerPhase += delta * 0.005;

    // Tick ignition timer
    if (this.ignitionTimer > 0) {
      this.ignitionTimer = Math.max(0, this.ignitionTimer - delta);
    }

    this.clear();
    this.draw();
  }

  /** Trigger ignition visual. Called by NightScene before the explosion. */
  triggerIgnition(): void {
    this.detonated = true;
    this.ignitionTimer = 500;
    this.clear();
    this.draw();
  }

  onZombieContact(zombie: Zombie): void {
    // Line explosion: NightScene handles all zombies across the full map width.
    zombie.takeDamage(this.explosionDamage);
    zombie.applyStun(1000);
  }
}
