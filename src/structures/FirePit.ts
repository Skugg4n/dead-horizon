import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/** Optional overrides for FirePit stats (applied by NightScene when level > 1). */
export interface FirePitOverrides {
  damagePerSecond?: number;
}

/**
 * Fire Pit -- a burning zone that deals continuous damage to zombies standing in it.
 *
 * Visual: flickering orange/red circle drawn via Graphics.
 * Damage: 15 dmg/s base (applied as dmg*delta/1000 per frame by NightScene).
 * Cooldown: 0 (always active while fueled).
 * Malfunction chance: 5%.
 * Fuel: 2 food/night.
 * Lasts 3 nights (tracked via nightsRemaining in structureInstance data).
 * Lv2: 25 dmg/s. Lv3: 35 dmg/s.
 */
export class FirePit extends TrapBase {
  /** Damage per second dealt to zombies inside the pit zone. */
  public readonly damagePerSecond: number;

  /** Width of the burn zone in tiles (3 tiles). */
  public readonly widthTiles: number = 3;

  /** Flicker phase drives the animated radius variation. */
  private flickerPhase: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance, overrides?: FirePitOverrides) {
    super(
      scene,
      instance,
      60,   // maxHp
      0,    // cooldownMs (always active)
      0,    // overheatMax (no overheat)
      0,    // recoveryMs
      0.05, // malfunctionChance
      -1,   // uses (-1 = unlimited)
      2,    // fuelPerNight (2 food)
    );
    this.damagePerSecond = overrides?.damagePerSecond ?? 15;
  }

  protected draw(): void {
    this.clear();

    // Charred ground background
    this.fillStyle(0x1A0A00);
    const w = TILE_SIZE * this.widthTiles;
    this.fillRect(0, 0, w, TILE_SIZE);

    // Animated flicker: radius varies based on flickerPhase
    const baseR = TILE_SIZE * 0.35;
    const flicker = Math.sin(this.flickerPhase) * 4;
    const r = baseR + flicker;

    const cx = w / 2;
    const cy = TILE_SIZE / 2;

    // Outer glow (transparent orange)
    this.fillStyle(0xFF4400, 0.4);
    this.fillCircle(cx, cy, r + 6);

    // Main fire (red-orange)
    this.fillStyle(0xFF6600, 0.75);
    this.fillCircle(cx, cy, r);

    // Hot core (yellow)
    this.fillStyle(0xFFDD00, 0.85);
    this.fillCircle(cx, cy, r * 0.4);

    // Border
    this.lineStyle(1, 0xFF6600, 0.4);
    this.strokeRect(0, 0, w, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    // Advance flicker animation each frame
    this.flickerPhase += delta * 0.008;
    this.clear();
    this.draw();
  }

  /**
   * Returns true if (px, py) is within the fire pit burn zone.
   */
  containsPoint(px: number, py: number): boolean {
    const x0 = this.structureInstance.x;
    const y0 = this.structureInstance.y;
    const w  = TILE_SIZE * this.widthTiles;
    return px >= x0 && px <= x0 + w && py >= y0 && py <= y0 + TILE_SIZE;
  }

  onZombieContact(zombie: Zombie): void {
    // Damage per second -- called each frame from NightScene when containsPoint() is true.
    // The scene calculates per-frame damage as damagePerSecond * delta / 1000.
    // This method is a placeholder; NightScene checks containsPoint directly.
    zombie.takeDamage(this.damagePerSecond);
  }
}
