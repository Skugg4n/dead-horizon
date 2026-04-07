import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/** Damage when car drops. Devastating single-hit. */
const DAMAGE = 150;

/**
 * Falling Car -- a car hoisted up with a block and tackle.
 * When triggered, the rope releases and the car falls, crushing the zombie below.
 *
 * Single-use. 150 dmg spot. Costs 10 scrap, 3 parts.
 */
export class FallingCar extends TrapBase {
  public readonly damage: number = DAMAGE;

  /** Impact flash timer (ms). */
  private impactTimer: number = 0;
  /** Faint cable sway animation. */
  private swayAngle: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      80,    // maxHp
      0,     // cooldownMs (single use)
      0,     // overheatMax
      0,     // recoveryMs
      0.10,  // malfunctionChance
      1,     // uses=1
      0,     // fuelPerNight
    );
  }

  protected draw(): void {
    this.clear();

    const mid = TILE_SIZE / 2;
    const used = this.uses === 0;

    // Background: dark ground
    this.fillStyle(0x0F0F0A);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    if (used) {
      // Flattened car remains after drop
      this.fillStyle(0x3A2A1A);
      this.fillRect(3, TILE_SIZE - 12, TILE_SIZE - 6, 10);

      // Crushed windshield shards
      this.fillStyle(0x334455, 0.5);
      this.fillRect(5, TILE_SIZE - 11, TILE_SIZE - 10, 4);

      // Skid marks
      this.fillStyle(0x222222, 0.7);
      this.fillRect(2, TILE_SIZE - 14, 4, 14);
      this.fillRect(TILE_SIZE - 6, TILE_SIZE - 14, 4, 14);

      // Impact crater
      if (this.impactTimer > 0) {
        const alpha = this.impactTimer / 250;
        this.fillStyle(0xFF6600, 0.5 * alpha);
        this.fillCircle(mid, mid, 18);
        this.fillStyle(0xFFAA00, 0.7 * alpha);
        this.fillCircle(mid, mid, 10);
      }
    } else {
      // Suspended car (viewed from below)
      // Cable rigging from top
      const sway = Math.sin(this.swayAngle) * 2;
      this.lineStyle(2, 0x888866);
      this.lineBetween(mid + sway, 0, mid + sway, 8); // center cable

      // Pulley
      this.fillStyle(0x666644);
      this.fillCircle(mid + sway, 8, 3);

      // Hanging cables split to corners
      this.lineStyle(1, 0x666655);
      this.lineBetween(mid + sway, 8, mid - 8 + sway, 16);
      this.lineBetween(mid + sway, 8, mid + 8 + sway, 16);

      // Car silhouette (hanging, bottom-view angled perspective)
      this.fillStyle(0x4A3A2A);
      this.fillRect(mid - 10 + sway, 16, 20, 14);
      // Windshield
      this.fillStyle(0x334455, 0.6);
      this.fillRect(mid - 7 + sway, 17, 14, 6);
      // Wheels (hanging down)
      this.fillStyle(0x111111);
      this.fillRect(mid - 12 + sway, 18, 3, 5);
      this.fillRect(mid + 9 + sway, 18, 3, 5);
      this.fillRect(mid - 12 + sway, 26, 3, 5);
      this.fillRect(mid + 9 + sway, 26, 3, 5);

      // Warning indicator: yellow/black hazard stripe
      this.fillStyle(0xFFCC00, 0.4);
      this.fillRect(0, TILE_SIZE - 5, TILE_SIZE, 5);
      this.fillStyle(0x111111, 0.5);
      for (let x = 0; x < TILE_SIZE; x += 6) {
        this.fillRect(x, TILE_SIZE - 5, 3, 5);
      }
    }

    // Border
    this.lineStyle(1, 0xBBAA44, 0.25);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    this.swayAngle += delta * 0.002;
    if (this.impactTimer > 0) {
      this.impactTimer = Math.max(0, this.impactTimer - delta);
    }
    this.clear();
    this.draw();
  }

  /**
   * Show impact flash when the car drops. Called by NightScene.
   */
  triggerDrop(): void {
    this.impactTimer = 250;
  }

  onZombieContact(zombie: Zombie): void {
    zombie.takeDamage(this.damage);
  }
}
