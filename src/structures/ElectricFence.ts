import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/**
 * Electric Fence -- an electrified chain-link fence that both blocks zombie movement
 * (physics body added by NightScene, same pattern as ChainWall) and deals continuous
 * damage to any zombie touching the fence.
 *
 * Stats (structures.json):
 *   - 10 dmg/s continuous contact damage
 *   - Blocks movement (physics blocker added by NightScene)
 *   - 200 HP (sturdy fence)
 *   - No discrete cooldown (always active while powered)
 *   - Overheat after 60s, 20s recovery (very resilient)
 *   - Malfunction chance: 10%
 *   - Fuel: 2 food/night (generator required)
 */
export class ElectricFence extends TrapBase {
  /** Damage per second to zombies touching the fence. */
  public readonly damagePerSecond: number = 10;

  /** Spark animation phase. */
  private sparkPhase: number = 0;

  /** Flash timer in ms for contact effect. */
  private flashTimer: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      200,    // maxHp
      0,      // cooldownMs (0 = always active)
      60000,  // overheatMax (60s)
      20000,  // recoveryMs (20s)
      0.10,   // malfunctionChance
      -1,     // uses (-1 = unlimited)
      2,      // fuelPerNight (generator)
    );
  }

  protected draw(): void {
    this.clear();

    const isActive = !this.malfunctioned && !this.overheated;
    const spark = Math.sin(this.sparkPhase) * 0.3 + 0.7; // 0.4-1.0

    // Post left and right
    this.fillStyle(0x666666);
    this.fillRect(1, 0, 5, TILE_SIZE);
    this.fillRect(TILE_SIZE - 6, 0, 5, TILE_SIZE);

    // Insulator caps
    this.fillStyle(0xBBBBCC);
    this.fillCircle(3, 5, 3);
    this.fillCircle(3, TILE_SIZE - 5, 3);
    this.fillCircle(TILE_SIZE - 3, 5, 3);
    this.fillCircle(TILE_SIZE - 3, TILE_SIZE - 5, 3);

    // Chain-link pattern (horizontal wire strands)
    const wireColor = isActive ? 0x44AAFF : 0x555555;
    const wireAlpha = isActive ? spark * 0.8 : 0.4;
    const wireCount = 4;
    for (let i = 0; i < wireCount; i++) {
      const wy = 6 + (i / (wireCount - 1)) * (TILE_SIZE - 12);
      this.lineStyle(1, wireColor, wireAlpha);
      this.lineBetween(6, wy, TILE_SIZE - 6, wy);

      // Zigzag pattern to suggest chain-link mesh
      if (isActive) {
        const segments = 5;
        for (let s = 0; s < segments; s++) {
          const x1 = 6 + (s / segments) * (TILE_SIZE - 12);
          const x2 = 6 + ((s + 0.5) / segments) * (TILE_SIZE - 12);
          const x3 = 6 + ((s + 1) / segments) * (TILE_SIZE - 12);
          const offset = i % 2 === 0 ? 3 : -3;
          this.lineStyle(1, wireColor, wireAlpha * 0.5);
          this.lineBetween(x1, wy, x2, wy + offset);
          this.lineBetween(x2, wy + offset, x3, wy);
        }
      }
    }

    // Arcing sparks when active
    if (isActive && spark > 0.85) {
      const arcX = 6 + Math.random() * (TILE_SIZE - 12);
      const arcY = 6 + Math.random() * (TILE_SIZE - 12);
      this.fillStyle(0xFFFFFF, 0.6);
      this.fillCircle(arcX, arcY, 1);
    }

    // Contact flash
    if (this.flashTimer > 0) {
      const intensity = this.flashTimer / 150;
      this.fillStyle(0x44AAFF, 0.25 * intensity);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    }

    // HP bar on fence (shows remaining durability)
    const hpFrac = this.hp / this.maxHp;
    this.fillStyle(0x113311);
    this.fillRect(4, TILE_SIZE - 5, TILE_SIZE - 8, 3);
    this.fillStyle(hpFrac > 0.5 ? 0x33CC33 : hpFrac > 0.25 ? 0xCCAA00 : 0xCC3300);
    this.fillRect(4, TILE_SIZE - 5, (TILE_SIZE - 8) * hpFrac, 3);

    // Border
    this.lineStyle(1, isActive ? 0x2244BB : 0x333344, 0.4);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    if (!this.malfunctioned && !this.overheated) {
      this.sparkPhase += delta * 0.008;
    }

    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - delta);
    }

    this.clear();
    this.draw();
  }

  /** Trigger contact flash. Called by NightScene when a zombie touches the fence. */
  triggerContactEffect(): void {
    this.flashTimer = 150;
  }

  /**
   * Continuous damage per second; delta scaling applied by NightScene.
   * NightScene also handles physics blocking (adds a wallBody for this structure).
   */
  onZombieContact(zombie: Zombie): void {
    zombie.takeDamage(this.damagePerSecond);
    this.flashTimer = 150;
  }
}
