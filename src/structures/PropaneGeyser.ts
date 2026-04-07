import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

const BURST_RADIUS = 60; // cone approximated as circle for simplicity

/**
 * Propane Geyser -- shoots a burst of fire in a cone (approximated as circle)
 * dealing 40 damage to all zombies in range.
 *
 * Visual: a gas canister graphic; when triggered draws a brief flame burst.
 * Cooldown: 6s. Overheat after 20s, recovery until cooled.
 * Malfunction chance: 10%.
 */
export class PropaneGeyser extends TrapBase {
  public readonly burstRadius: number = BURST_RADIUS;
  // Balance v2.5.0: reduced from 40 to 30 (too OP for 4S cost)
  public readonly burstDamage: number = 30;

  /** Remaining duration (ms) of the burst visual. */
  private burstVisualTimer: number = 0;
  private readonly BURST_VISUAL_DURATION_MS = 300;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      80,    // maxHp
      6000,  // cooldownMs (6s)
      20000, // overheatMax (20s)
      12000, // recoveryMs
      0.10,  // malfunctionChance
      -1,    // uses (-1 = unlimited)
      0,     // fuelPerNight (no fuel cost)
    );
  }

  protected draw(): void {
    this.clear();

    // Dark background
    this.fillStyle(0x111111);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;

    // Propane tank body (rounded rectangle)
    this.fillStyle(0x447766);
    this.fillRoundedRect(6, 8, TILE_SIZE - 12, TILE_SIZE - 14, 4);

    // Tank valve (top)
    this.fillStyle(0x886644);
    this.fillRect(mid - 3, 3, 6, 7);

    // Flame jets if currently in burst visual
    if (this.burstVisualTimer > 0) {
      const intensity = this.burstVisualTimer / this.BURST_VISUAL_DURATION_MS;
      this.fillStyle(0xFF6600, 0.5 + intensity * 0.5);
      this.fillTriangle(
        mid, 0,
        mid - 12, -18,
        mid + 12, -18,
      );
      this.fillStyle(0xFFDD00, 0.7);
      this.fillTriangle(
        mid, 2,
        mid - 6, -10,
        mid + 6, -10,
      );
    }

    // Border
    this.lineStyle(1, 0xE8DCC8, 0.25);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    if (this.burstVisualTimer > 0) {
      this.burstVisualTimer = Math.max(0, this.burstVisualTimer - delta);
      // Redraw each frame while burst is visible
      this.clear();
      this.draw();
    }
  }

  onZombieContact(zombie: Zombie): void {
    // Trigger burst visual
    this.burstVisualTimer = this.BURST_VISUAL_DURATION_MS;

    // Direct damage to the triggering zombie (AOE is handled by NightScene)
    zombie.takeDamage(this.burstDamage);
  }
}
