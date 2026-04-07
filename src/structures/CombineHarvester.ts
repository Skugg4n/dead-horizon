import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/**
 * Combine Harvester -- legendary agricultural death machine repurposed for zombie clearance.
 * Churns through a 4-tile wide path, dealing massive continuous damage.
 * The most satisfying Tier 3 machine: big, loud, brutal.
 *
 * Stats:
 *   - 60 dmg/s across a 4-tile wide zone (continuous, delta-based)
 *   - Cooldown: 8s between activation pulses
 *   - Fuel: 3 food/night
 *   - Malfunction chance: 20%
 *   - Unlimited uses
 */
export class CombineHarvester extends TrapBase {
  /** Damage per second for zombies inside the harvesting zone. */
  public readonly damagePerSecond: number = 60;

  /** Zone width: 4 tiles. */
  public readonly zoneWidth: number = TILE_SIZE * 4;

  /** Zone height: 1 tile (the harvester body). */
  public readonly zoneHeight: number = TILE_SIZE;

  /** Blade drum rotation angle. */
  private drumAngle: number = 0;

  /** Feed roller rotation (opposite direction). */
  private rollerAngle: number = 0;

  /** Active carnage flash timer. */
  private carnageTimer: number = 0;

  /** Debris particle positions for visual effect. */
  private debrisList: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      200,    // maxHp -- legendary machine, very tough
      8000,   // cooldownMs (8s)
      35000,  // overheatMax (35s -- runs long before overheating)
      20000,  // recoveryMs (20s recovery)
      0.20,   // malfunctionChance (20%)
      -1,     // uses (unlimited)
      3,      // fuelPerNight (3 food)
    );
  }

  protected draw(): void {
    this.clear();

    // Combine harvester body -- agricultural yellow/green
    const isActive = this.isReady() && !this.malfunctioned;
    const bodyColor = isActive ? 0x3B6B0A : 0x2A4A06;

    this.fillStyle(bodyColor);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;

    // Main body cab structure (top portion)
    this.fillStyle(isActive ? 0x558822 : 0x3A5A14);
    this.fillRect(4, 2, TILE_SIZE - 8, TILE_SIZE / 2 - 2);

    // Cab window (reflective)
    this.fillStyle(0x2244AA, 0.5);
    this.fillRect(8, 5, TILE_SIZE - 16, 8);

    // Header / cutting platform (bottom portion)
    this.fillStyle(isActive ? 0x884411 : 0x663308);
    this.fillRect(0, mid, TILE_SIZE, mid);

    // Rotating cutter drum: segmented circles representing the reel blades
    const drumRadius = mid * 0.4;
    const drumCenterY = mid + mid / 2;

    // Drum body
    this.fillStyle(isActive ? 0xCC6622 : 0x885522);
    this.fillCircle(mid, drumCenterY, drumRadius);

    // Drum blades: 6 radial cutting teeth
    for (let i = 0; i < 6; i++) {
      const angle = this.drumAngle + (i * Math.PI / 3);
      const bx = mid + Math.cos(angle) * (drumRadius + 3);
      const by = drumCenterY + Math.sin(angle) * (drumRadius + 3);
      const bx2 = mid + Math.cos(angle) * drumRadius;
      const by2 = drumCenterY + Math.sin(angle) * drumRadius;

      this.lineStyle(3, isActive ? 0xCCCCCC : 0x777777, 0.9);
      this.lineBetween(bx2, by2, bx, by);
    }

    // Drum shaft
    this.fillStyle(0xAAAAAA);
    this.fillCircle(mid, drumCenterY, 3);

    // Left and right header dividers
    this.lineStyle(2, 0x666644, 0.7);
    this.lineBetween(0, mid, TILE_SIZE, mid);
    this.lineStyle(1, 0x888866, 0.5);
    this.lineBetween(mid, mid, mid, TILE_SIZE);

    // Wheels/tracks: chunky rectangles at corners
    this.fillStyle(0x222222);
    this.fillRect(0, TILE_SIZE - 6, TILE_SIZE / 3, 6);
    this.fillRect(TILE_SIZE * 0.67, TILE_SIZE - 6, TILE_SIZE / 3, 6);

    // Exhaust pipe
    this.fillStyle(0x333333);
    this.fillRect(TILE_SIZE - 7, 1, 4, 10);

    // When active: heat shimmer from exhaust
    if (isActive) {
      this.fillStyle(0xFF8800, 0.2);
      this.fillRect(TILE_SIZE - 7, 0, 4, 3);
    }

    // Carnage effect: red gore burst when harvesting zombies
    if (this.carnageTimer > 0) {
      const intensity = this.carnageTimer / 400;

      // Dark red blood spray
      this.fillStyle(0xAA0000, 0.6 * intensity);
      this.fillRect(0, mid, TILE_SIZE, mid);

      // Flying debris
      this.fillStyle(0x884400, 0.5 * intensity);
      for (const d of this.debrisList) {
        if (d.life > 0) {
          this.fillCircle(d.x, d.y, 2 * d.life);
        }
      }

      // Red outline flash
      this.lineStyle(2, 0xFF0000, 0.8 * intensity);
      this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
    }

    // Border
    this.lineStyle(1, isActive ? 0x88CC22 : 0x446611, 0.3);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    // Spin the cutter drum continuously when active
    if (!this.malfunctioned && !this.overheated) {
      this.drumAngle += (delta / 1000) * Math.PI * 4;   // 2 rotations/s
      this.rollerAngle -= (delta / 1000) * Math.PI * 6; // feed roller opposite direction
    }

    // Tick carnage timer and update debris
    if (this.carnageTimer > 0) {
      this.carnageTimer = Math.max(0, this.carnageTimer - delta);

      // Update debris positions
      for (const d of this.debrisList) {
        if (d.life > 0) {
          d.x += d.vx * (delta / 1000);
          d.y += d.vy * (delta / 1000);
          d.life = Math.max(0, d.life - delta / 300);
        }
      }
      this.debrisList = this.debrisList.filter(d => d.life > 0);
    }

    this.clear();
    this.draw();
  }

  /** Trigger the gore/carnage visual. Called by NightScene when zombies are damaged. */
  triggerCarnageEffect(): void {
    this.carnageTimer = 400;

    // Spawn flying debris chunks
    const mid = TILE_SIZE / 2;
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.debrisList.push({
        x: mid + (Math.random() - 0.5) * 16,
        y: TILE_SIZE * 0.75,
        vx: Math.cos(angle) * 30,
        vy: Math.sin(angle) * 30 - 20,
        life: 0.7 + Math.random() * 0.3,
      });
    }

    this.clear();
    this.draw();
  }

  onZombieContact(zombie: Zombie): void {
    // Continuous damage is handled by NightScene (delta-based).
    zombie.takeDamage(this.damagePerSecond);
    this.triggerCarnageEffect();
  }
}
