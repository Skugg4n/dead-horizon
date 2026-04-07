import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/**
 * Garage Door Smasher -- a weighted garage door on a spring-loaded track that
 * slams down with crushing force when a zombie walks under it.
 *
 * Stats (structures.json):
 *   - 60 dmg crush per activation
 *   - Cooldown: 8s (door must retract and reset)
 *   - 120 HP
 *   - Malfunction chance: 15%
 *   - Fuel: 1 food/night (electric motor)
 */
export class GarageDoorSmasher extends TrapBase {
  /** Crushing damage per activation. */
  public readonly trapDamage: number = 60;

  /** Smash animation timer in ms. */
  private smashTimer: number = 0;

  /** Current door Y offset for animation (0 = raised, TILE_SIZE = slammed). */
  private doorOffset: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      120,   // maxHp
      8000,  // cooldownMs (8s)
      0,     // overheatMax (no overheat)
      0,     // recoveryMs
      0.15,  // malfunctionChance
      -1,    // uses (-1 = unlimited)
      1,     // fuelPerNight
    );
  }

  protected draw(): void {
    this.clear();

    // Concrete frame background
    this.fillStyle(0x222222);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const isReady = this.isReady() && !this.malfunctioned;
    const isSlamming = this.smashTimer > 0;

    // Door track guides (left and right rails)
    this.fillStyle(0x555566);
    this.fillRect(1, 0, 3, TILE_SIZE);
    this.fillRect(TILE_SIZE - 4, 0, 3, TILE_SIZE);

    // Garage door panels -- horizontal ridged pattern
    const doorPanelCount = 4;
    const doorColor = isReady ? 0x889988 : 0x445544;
    const doorHeight = TILE_SIZE - 8;

    // Animate door position: slammed = at bottom, raised = at top-ish
    const doorY = isSlamming ? this.doorOffset : (isReady ? 2 : 4);

    for (let p = 0; p < doorPanelCount; p++) {
      const panelY = doorY + p * (doorHeight / doorPanelCount);
      const panelH = (doorHeight / doorPanelCount) - 1;
      this.fillStyle(doorColor, 0.9);
      this.fillRect(4, panelY, TILE_SIZE - 8, panelH);

      // Panel ridge
      this.lineStyle(1, 0xAABBAA, 0.3);
      this.lineBetween(4, panelY + panelH - 1, TILE_SIZE - 4, panelY + panelH - 1);
    }

    // Crush impact zone indicator at bottom
    if (isReady && !isSlamming) {
      this.fillStyle(0xFF4422, 0.08);
      this.fillRect(4, TILE_SIZE - 8, TILE_SIZE - 8, 6);
    }

    // Impact flash when slamming
    if (isSlamming && this.smashTimer < 150) {
      const intensity = (150 - this.smashTimer) / 150;
      this.fillStyle(0xFF8800, 0.5 * intensity);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    }

    // Border
    this.lineStyle(1, 0xE8DCC8, 0.15);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    if (this.smashTimer > 0) {
      this.smashTimer = Math.max(0, this.smashTimer - delta);

      // Animate door: slam down quickly then retract slowly during cooldown
      const progress = 1 - this.smashTimer / 350;
      this.doorOffset = Math.min(TILE_SIZE - 8, progress * TILE_SIZE);
    } else if (this.cooldownTimer > 0) {
      // Retract: interpolate door back up based on remaining cooldown
      const retractPct = this.cooldownTimer / this.cooldownMs;
      this.doorOffset = retractPct * 4; // near-zero as cooldown nears end
    } else {
      this.doorOffset = 0;
    }

    this.clear();
    this.draw();
  }

  /** Trigger smash animation on activation. */
  triggerActivationEffect(): void {
    this.smashTimer = 350;
    this.doorOffset = 0;
    this.clear();
    this.draw();
  }

  onZombieContact(zombie: Zombie): void {
    zombie.takeDamage(this.trapDamage);
    this.smashTimer = 350;
  }
}
