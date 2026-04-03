import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

const AOE_RADIUS = 40;
const BLADE_COLOR = 0xCCCCCC;
const HUB_COLOR   = 0x886644;

/**
 * Blade Spinner -- spinning blade machine that deals AOE damage to nearby zombies.
 *
 * Visual: a rotating line (blade) drawn via Graphics.
 * Cooldown: 4s. Overheat after 30s of operation, 10s recovery.
 * Malfunction chance: 15%.
 * Fuel: 1 food/night.
 */
export class BladeSpinner extends TrapBase {
  public readonly aoeRadius: number = AOE_RADIUS;

  /** Blade rotation angle in radians -- advances each frame while active. */
  private bladeAngle: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      100,   // maxHp
      4000,  // cooldownMs (4s)
      30000, // overheatMax (30s)
      10000, // recoveryMs (10s)
      0.15,  // malfunctionChance
      -1,    // uses (-1 = unlimited)
      1,     // fuelPerNight (1 food)
    );
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
    zombie.takeDamage(25);
  }
}
