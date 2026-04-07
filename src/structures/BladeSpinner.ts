import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

const AOE_RADIUS = 40;
const BLADE_COLOR = 0xCCCCCC;
const HUB_COLOR   = 0x886644;

/** Optional overrides for BladeSpinner stats (applied by NightScene when level > 1). */
export interface BladeSpinnerOverrides {
  trapDamage?: number;
  cooldownMs?: number;
  overheatMax?: number;
}

/**
 * Blade Spinner -- spinning blade machine that deals AOE damage to nearby zombies.
 *
 * Visual: a rotating line (blade) drawn via Graphics.
 * Cooldown: 4s. Overheat after 30s of operation, 10s recovery.
 * Malfunction chance: 15%.
 * Fuel: 1 food/night.
 * Lv2: 35 dmg, 3s cd. Lv3: 50 dmg, 2s cd, -50% overheat (15s).
 */
export class BladeSpinner extends TrapBase {
  public readonly aoeRadius: number = AOE_RADIUS;

  /** Damage per activation -- can be overridden by level upgrades. */
  public trapDamage: number;

  /** Blade rotation angle in radians -- advances each frame while active. */
  private bladeAngle: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance, overrides?: BladeSpinnerOverrides) {
    const cooldown   = overrides?.cooldownMs  ?? 4000;
    const overheatMx = overrides?.overheatMax ?? 30000;
    super(
      scene,
      instance,
      100,        // maxHp
      cooldown,   // cooldownMs (level-dependent)
      overheatMx, // overheatMax (level-dependent)
      10000,      // recoveryMs (10s)
      0.15,       // malfunctionChance
      -1,         // uses (-1 = unlimited)
      1,          // fuelPerNight (1 food)
    );
    this.trapDamage = overrides?.trapDamage ?? 25;
  }

  protected draw(): void {
    this.clear();

    // Dark background
    this.fillStyle(0x1A1A1A);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;

    // Hub
    this.fillStyle(HUB_COLOR);
    this.fillCircle(mid, mid, 4);

    // Two blades at current rotation angle (180 degrees apart)
    const len = mid - 3;
    const cos = Math.cos(this.bladeAngle);
    const sin = Math.sin(this.bladeAngle);

    this.lineStyle(3, BLADE_COLOR);
    this.lineBetween(
      mid - cos * len, mid - sin * len,
      mid + cos * len, mid + sin * len,
    );

    // Perpendicular blade
    this.lineStyle(2, BLADE_COLOR, 0.55);
    this.lineBetween(
      mid - sin * len * 0.7, mid + cos * len * 0.7,
      mid + sin * len * 0.7, mid - cos * len * 0.7,
    );

    // Border
    this.lineStyle(1, 0xE8DCC8, 0.2);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    // Rotate blades when active and ready (visual-only, no physics)
    if (this.isReady() && !this.malfunctioned && !this.overheated) {
      this.bladeAngle += (delta / 1000) * Math.PI * 4; // ~2 full spins per second
      // Redraw every frame to show rotation
      this.clear();
      this.draw();
    }
  }

  onZombieContact(zombie: Zombie): void {
    // AOE: damage all zombies within aoeRadius is handled by NightScene.
    // This method handles the single zombie that triggered the activation.
    zombie.takeDamage(this.trapDamage);
  }
}
