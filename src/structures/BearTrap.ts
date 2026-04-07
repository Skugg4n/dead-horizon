import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

const COLOR = 0x885522;

/**
 * Bear Trap -- heavy damage + stun on the first zombie to step on it.
 * Single use; destroys itself after triggering.
 */
export class BearTrap extends Phaser.GameObjects.Graphics {
  public structureInstance: StructureInstance;
  public trapDamage: number;
  public stunDuration: number;

  constructor(
    scene: Phaser.Scene,
    instance: StructureInstance,
    trapDamage: number,
    stunDuration: number
  ) {
    super(scene);
    this.structureInstance = instance;
    this.trapDamage = trapDamage;
    this.stunDuration = stunDuration;

    this.setPosition(instance.x, instance.y);
    this.draw();

    scene.add.existing(this);

    // Idle alpha pulse: slight tension shimmer
    scene.tweens.add({
      targets: this,
      alpha: { from: 0.85, to: 1.0 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private draw(): void {
    this.clear();
    // Dark background
    this.fillStyle(0x1A1208);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Two jaw halves of the trap (simplified)
    this.lineStyle(3, COLOR);
    const mid = TILE_SIZE / 2;
    // Left jaw arc (approximated with lines)
    this.lineBetween(4, mid, mid - 2, 6);
    this.lineBetween(4, mid, mid - 2, TILE_SIZE - 6);
    // Right jaw arc
    this.lineBetween(TILE_SIZE - 4, mid, mid + 2, 6);
    this.lineBetween(TILE_SIZE - 4, mid, mid + 2, TILE_SIZE - 6);
    // Center spring
    this.lineStyle(2, 0xCCAA44);
    this.lineBetween(mid - 4, mid, mid + 4, mid);

    // Border
    this.lineStyle(1, 0xE8DCC8, 0.25);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  getDamage(): number {
    return this.trapDamage;
  }

  /** Trigger the trap. Returns true (always destroyed on first use). */
  trigger(): boolean {
    this.structureInstance.hp = 0;
    this.destroy();
    return true;
  }
}
