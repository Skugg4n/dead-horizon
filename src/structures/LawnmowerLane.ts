import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/**
 * Lawnmower Lane -- an upside-down lawnmower embedded in the ground covering
 * a 4-tile-wide corridor. Spinning blades shred any zombie that passes through.
 *
 * Stats (structures.json):
 *   - 20 dmg/s continuous in 4-tile corridor
 *   - No discrete cooldown (always active while powered)
 *   - Overheat after 30s, 12s recovery
 *   - 120 HP
 *   - Malfunction chance: 15%
 *   - Fuel: 2 food/night (gas-powered)
 *   - widthTiles: 4
 */
export class LawnmowerLane extends TrapBase {
  /** Damage per second applied to zombies in the lane. */
  public readonly damagePerSecond: number = 20;

  /** Lane width in tiles (set from structures.json). */
  public readonly widthTiles: number = 4;

  /** Blade spin phase for animation. */
  private bladePhase: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      120,    // maxHp
      0,      // cooldownMs (0 = always active)
      30000,  // overheatMax (30s)
      12000,  // recoveryMs (12s)
      0.15,   // malfunctionChance
      -1,     // uses (-1 = unlimited)
      2,      // fuelPerNight (2 food -- gas-powered)
    );

    // Vertical rotation: the draw() method always draws horizontally from
    // local (0,0) to (width, TILE_SIZE). To render vertical we rotate the
    // whole Graphics 90 degrees clockwise around its top-left and nudge the
    // position by +TILE_SIZE on X so the rotated footprint still starts at
    // (instance.x, instance.y) and extends DOWN.
    if (instance.rotation === 1) {
      this.setRotation(Math.PI / 2);
      this.setPosition(instance.x + TILE_SIZE, instance.y);
    }
  }

  protected draw(): void {
    this.clear();

    const totalWidth = this.widthTiles * TILE_SIZE;
    const isActive = !this.malfunctioned && !this.overheated;

    // Dark asphalt lane background
    this.fillStyle(0x151510);
    this.fillRect(0, 0, totalWidth, TILE_SIZE);

    // Slot grooves across the lane -- represent blade openings in the floor
    const slotColor = isActive ? 0x332211 : 0x222222;
    const slotCount = this.widthTiles * 2;
    for (let i = 0; i < slotCount; i++) {
      const sx = (i / slotCount) * totalWidth + 4;
      this.fillStyle(slotColor);
      this.fillRect(sx, 6, (totalWidth / slotCount) - 8, TILE_SIZE - 12);
    }

    // Spinning blade segments visible in each slot
    if (isActive) {
      const bladeColor = 0xCCCCCC;
      const bladeCount = this.widthTiles * 2;
      for (let i = 0; i < bladeCount; i++) {
        const centerX = ((i + 0.5) / bladeCount) * totalWidth;
        const centerY = TILE_SIZE / 2;
        const angle = this.bladePhase + (i * Math.PI * 0.7);
        const bLen = 7;

        this.lineStyle(2, bladeColor, 0.85);
        this.lineBetween(
          centerX - Math.cos(angle) * bLen,
          centerY - Math.sin(angle) * bLen,
          centerX + Math.cos(angle) * bLen,
          centerY + Math.sin(angle) * bLen,
        );
        // Perpendicular blade
        this.lineStyle(1, bladeColor, 0.5);
        this.lineBetween(
          centerX - Math.sin(angle) * bLen * 0.7,
          centerY + Math.cos(angle) * bLen * 0.7,
          centerX + Math.sin(angle) * bLen * 0.7,
          centerY - Math.cos(angle) * bLen * 0.7,
        );
      }
    }

    // Side rails
    this.lineStyle(2, 0x555544, 0.8);
    this.lineBetween(0, 1, totalWidth, 1);
    this.lineBetween(0, TILE_SIZE - 1, totalWidth, TILE_SIZE - 1);

    // Border
    this.lineStyle(1, 0xE8DCC8, 0.15);
    this.strokeRect(0, 0, totalWidth, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    if (!this.malfunctioned && !this.overheated) {
      this.bladePhase += (delta / 1000) * Math.PI * 8; // fast spin
    }

    this.clear();
    this.draw();
  }

  /**
   * Delta-based damage per second applied by NightScene for zombies inside the lane.
   * Overheat accumulates via the always-active mode (NightScene calls accumulate separately).
   */
  onZombieContact(zombie: Zombie): void {
    zombie.takeDamage(this.damagePerSecond);
  }

  /**
   * Check if a world-space point is within the lane's footprint.
   * The lane covers widthTiles tiles horizontally, one tile vertically.
   */
  containsPoint(wx: number, wy: number): boolean {
    const x0 = this.structureInstance.x;
    const y0 = this.structureInstance.y;
    if (this.structureInstance.rotation === 1) {
      // Vertical lane: 1 tile wide, widthTiles tall
      return wx >= x0 && wx <= x0 + TILE_SIZE &&
             wy >= y0 && wy <= y0 + this.widthTiles * TILE_SIZE;
    }
    return wx >= x0 && wx <= x0 + this.widthTiles * TILE_SIZE &&
           wy >= y0 && wy <= y0 + TILE_SIZE;
  }
}
