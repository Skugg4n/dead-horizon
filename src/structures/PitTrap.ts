import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

const MAX_CAPTURES = 5;

/**
 * Pit Trap -- a hidden pit that permanently captures (removes) zombies that fall in.
 *
 * Visual: a dark earthy circle in the ground.
 * Captures up to 5 zombies then destroys itself.
 * No cooldown, no overheat, no fuel.
 * Malfunction chance: 10%.
 */
export class PitTrap extends TrapBase {
  public readonly maxCaptures: number = MAX_CAPTURES;

  /** How many zombies have already fallen into the pit. */
  private capturedCount: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      40,          // maxHp (structural durability)
      0,           // cooldownMs (no cooldown -- each zombie consumes one slot)
      0,           // overheatMax (no overheat)
      0,           // recoveryMs
      0.10,        // malfunctionChance
      MAX_CAPTURES, // uses = max captures
      0,           // fuelPerNight
    );
  }

  protected draw(): void {
    this.clear();

    // Earthy ground background
    this.fillStyle(0x1A0D00);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;

    // Pit opening (dark void circle)
    const fillRatio = this.capturedCount / MAX_CAPTURES;
    // Pit darkens as it fills up
    const darknessAlpha = 0.7 + fillRatio * 0.3;
    this.fillStyle(0x000000, darknessAlpha);
    this.fillCircle(mid, mid, mid - 4);

    // Rim (earthen edge)
    this.lineStyle(3, 0x6B4A20);
    this.strokeCircle(mid, mid, mid - 4);

    // Crack lines radiating from pit
    this.lineStyle(1, 0x4A3010, 0.6);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      this.lineBetween(
        mid + Math.cos(angle) * (mid - 4),
        mid + Math.sin(angle) * (mid - 4),
        mid + Math.cos(angle) * mid,
        mid + Math.sin(angle) * mid,
      );
    }

    // Show capacity indicator: small dots for remaining slots
    const remaining = this.uses;
    if (remaining > 0 && remaining <= MAX_CAPTURES) {
      for (let i = 0; i < remaining; i++) {
        const dotAngle = (i / MAX_CAPTURES) * Math.PI * 2 - Math.PI / 2;
        const dotR = mid - 7;
        this.fillStyle(0xFFDD44, 0.8);
        this.fillCircle(
          mid + Math.cos(dotAngle) * dotR,
          mid + Math.sin(dotAngle) * dotR,
          1.5,
        );
      }
    }

    // Border
    this.lineStyle(1, 0xE8DCC8, 0.15);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  onZombieContact(zombie: Zombie): void {
    // Capture: immediately remove the zombie from the scene
    this.capturedCount++;

    // Kill the zombie silently (no XP, no loot -- they fell into a pit)
    zombie.takeDamage(99999);

    // Redraw to update capacity indicator
    this.clear();
    this.draw();

    // Check if the pit is full -- destroy when all slots used
    // (TrapBase.tryActivate() already decrements uses; destroy check happens there)
    if (this.uses === 0) {
      this.structureInstance.hp = 0;
      // Self-destroy after a brief delay so the frame completes cleanly
      this.scene.time.delayedCall(50, () => {
        if (this.active) this.destroy();
      });
    }
  }
}
