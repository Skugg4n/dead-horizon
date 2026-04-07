import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/**
 * Elevator Shaft -- a retrofitted hoist drops a zombie down the shaft.
 * Instant kill on 1 zombie. Cooldown 15s.
 *
 * Costs 10 scrap, 5 parts. Malfunction 20% (the cable snaps).
 */
export class ElevatorShaft extends TrapBase {
  /** Flash/drop animation timer (ms). */
  private dropTimer: number = 0;
  /** Animated door-open phase 0..1. */
  private doorOpen: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      120,   // maxHp
      15000, // cooldownMs (15s)
      0,     // overheatMax
      0,     // recoveryMs
      0.20,  // malfunctionChance
      -1,    // uses: unlimited
      0,     // fuelPerNight
    );
  }

  protected draw(): void {
    this.clear();

    const mid = TILE_SIZE / 2;
    const ready = this.isReady() && !this.malfunctioned;

    // Shaft background -- dark pit
    this.fillStyle(0x060606);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Shaft depth illusion (darker inner rect)
    this.fillStyle(0x020202);
    this.fillRect(4, 4, TILE_SIZE - 8, TILE_SIZE - 8);

    // Shaft walls (metal plates)
    const wallColor = ready ? 0x555544 : 0x333333;
    this.fillStyle(wallColor);
    this.fillRect(0, 0, 4, TILE_SIZE);     // left wall
    this.fillRect(TILE_SIZE - 4, 0, 4, TILE_SIZE); // right wall
    this.fillRect(0, 0, TILE_SIZE, 4);     // top wall
    this.fillRect(0, TILE_SIZE - 4, TILE_SIZE, 4); // bottom wall

    // Trapdoor panels (split open when activated)
    const doorColor = ready ? 0x666644 : 0x444433;
    if (this.doorOpen < 0.5) {
      // Doors nearly closed
      const openAmt = Math.round(this.doorOpen * mid * 2);
      this.fillStyle(doorColor);
      this.fillRect(4, 4, mid - openAmt, TILE_SIZE - 8);       // left door
      this.fillRect(mid + openAmt, 4, mid - openAmt - 4, TILE_SIZE - 8); // right door
    }
    // When doors fully open, show the shaft depth below

    // Hoist cable
    this.lineStyle(2, ready ? 0x888866 : 0x444433);
    this.lineBetween(mid, 0, mid, 4);

    // Hoist mechanism at top
    this.fillStyle(ready ? 0x888866 : 0x444444);
    this.fillRect(mid - 4, 1, 8, 4);

    // Depth indicator: chain links going down
    if (ready) {
      this.lineStyle(1, 0x444433, 0.5);
      for (let y = 8; y < TILE_SIZE - 8; y += 5) {
        this.lineBetween(mid - 1, y, mid + 1, y);
      }
    }

    // Drop animation: bright impact flash
    if (this.dropTimer > 0) {
      const alpha = this.dropTimer / 180;
      this.fillStyle(0xFF2200, 0.6 * alpha);
      this.fillRect(4, 4, TILE_SIZE - 8, TILE_SIZE - 8);
      this.fillStyle(0xFFFFFF, 0.5 * alpha);
      this.fillCircle(mid, mid, 6);
    }

    // Malfunction: broken cable hanging
    if (this.malfunctioned) {
      this.lineStyle(2, 0xCC4422);
      this.lineBetween(mid, 0, mid - 3, 12);
      this.lineBetween(mid, 0, mid + 2, 8);
    }

    // Border
    this.lineStyle(1, 0x555544, 0.3);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    if (this.dropTimer > 0) {
      this.dropTimer = Math.max(0, this.dropTimer - delta);
      // Animate door closing
      this.doorOpen = this.dropTimer / 180;
    } else {
      this.doorOpen = 0;
    }

    this.clear();
    this.draw();
  }

  /**
   * Trigger the drop animation. Called by NightScene after activation.
   */
  triggerDrop(): void {
    this.dropTimer = 180;
    this.doorOpen = 1.0;
  }

  onZombieContact(zombie: Zombie): void {
    // Instant kill: deal enough damage to kill any zombie
    zombie.takeDamage(99999);
  }
}
