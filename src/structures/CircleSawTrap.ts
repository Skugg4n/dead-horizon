import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/**
 * Circle Saw Trap -- a circular saw blade mounted flush in the floor that pops up
 * and spins when a zombie steps on it.
 *
 * Stats (structures.json):
 *   - 35 dmg per activation
 *   - Cooldown: 3s
 *   - 100 HP
 *   - Malfunction chance: 15%
 *   - Fuel: 1 food/night
 */
export class CircleSawTrap extends TrapBase {
  /** Damage per activation. */
  public readonly trapDamage: number = 35;

  /** Saw blade rotation angle in radians -- advances when active. */
  private bladeAngle: number = 0;

  /** Pop-up animation timer in ms. Active immediately after activation. */
  private popTimer: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      100,   // maxHp
      3000,  // cooldownMs (3s)
      0,     // overheatMax (no overheat)
      0,     // recoveryMs
      0.15,  // malfunctionChance
      -1,    // uses (-1 = unlimited)
      1,     // fuelPerNight (1 food)
    );
  }

  protected draw(): void {
    this.clear();

    // Dark steel floor plate background
    this.fillStyle(0x1A1A1A);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;
    const isPopped = this.popTimer > 0;
    const isReady = this.isReady() && !this.malfunctioned;

    // Floor recess slot -- dark circle showing where blade sits
    this.fillStyle(0x111111);
    this.fillCircle(mid, mid, 12);

    // Blade -- drawn at current rotation angle
    const bladeRadius = isPopped ? 14 : 10;
    const bladeColor = isReady ? 0xDDDDDD : 0x555555;
    const teethCount = 8;

    // Saw disc
    this.fillStyle(bladeColor, isPopped ? 1.0 : 0.6);
    this.fillCircle(mid, mid, bladeRadius);

    // Saw teeth -- small triangles around the perimeter
    if (isReady || isPopped) {
      const toothLen = 4;
      this.lineStyle(2, 0xAAAAAA, 0.9);
      for (let i = 0; i < teethCount; i++) {
        const angle = this.bladeAngle + (i / teethCount) * Math.PI * 2;
        const innerR = bladeRadius;
        const outerR = bladeRadius + toothLen;
        const toothAngle1 = angle - 0.2;
        const toothAngle2 = angle + 0.2;
        // Tooth tip
        this.lineBetween(
          mid + Math.cos(toothAngle1) * innerR,
          mid + Math.sin(toothAngle1) * innerR,
          mid + Math.cos(angle) * outerR,
          mid + Math.sin(angle) * outerR,
        );
        this.lineBetween(
          mid + Math.cos(angle) * outerR,
          mid + Math.sin(angle) * outerR,
          mid + Math.cos(toothAngle2) * innerR,
          mid + Math.sin(toothAngle2) * innerR,
        );
      }
    }

    // Center hub
    this.fillStyle(0x884422);
    this.fillCircle(mid, mid, 3);

    // Pop-up flash effect: bright silver burst when blade rises
    if (isPopped) {
      const intensity = this.popTimer / 200;
      this.lineStyle(2, 0xCCCCFF, 0.5 * intensity);
      this.strokeCircle(mid, mid, bladeRadius + 6);
    }

    // Border
    this.lineStyle(1, 0xE8DCC8, 0.15);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    // Count down pop-up animation
    if (this.popTimer > 0) {
      this.popTimer = Math.max(0, this.popTimer - delta);
    }

    // Spin blade continuously when ready
    if (this.isReady() && !this.malfunctioned) {
      this.bladeAngle += (delta / 1000) * Math.PI * 6; // ~3 full spins per second
    }

    this.clear();
    this.draw();
  }

  /** Trigger the pop-up animation. Called by NightScene after activation. */
  triggerActivationEffect(): void {
    this.popTimer = 200;
    this.clear();
    this.draw();
  }

  onZombieContact(zombie: Zombie): void {
    zombie.takeDamage(this.trapDamage);
    this.popTimer = 200;
  }
}
