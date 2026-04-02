import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

const COLOR = 0xAA2222;

/**
 * Spike Strip -- damages and cripples enemies that walk over it.
 * Has durability (uses) rather than HP. Invisible to zombies (they don't
 * path around it). Each use decrements durability; destroyed when at 0.
 */
export class SpikeStrip extends Phaser.GameObjects.Graphics {
  public structureInstance: StructureInstance;
  public trapDamage: number;
  public crippleDuration: number;
  /** Remaining uses (decrements on each zombie hit) */
  private usesRemaining: number;

  constructor(
    scene: Phaser.Scene,
    instance: StructureInstance,
    trapDamage: number,
    crippleDuration: number,
    _maxUses: number
  ) {
    super(scene);
    this.structureInstance = instance;
    this.trapDamage = trapDamage;
    this.crippleDuration = crippleDuration;
    // Uses remaining stored in instance.hp (so save/load works)
    this.usesRemaining = instance.hp;

    this.setPosition(instance.x, instance.y);
    this.draw();

    scene.add.existing(this);
  }

  private draw(): void {
    this.clear();
    // Dark background
    this.fillStyle(0x1A0A0A);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Row of spikes (short vertical lines)
    this.lineStyle(2, COLOR);
    const spikeCount = 5;
    const spacing = TILE_SIZE / (spikeCount + 1);
    for (let i = 1; i <= spikeCount; i++) {
      const sx = i * spacing;
      this.lineBetween(sx, TILE_SIZE - 4, sx, TILE_SIZE / 2 + 2);
    }

    // Thin border
    this.lineStyle(1, 0xE8DCC8, 0.25);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  getDamage(): number {
    return this.trapDamage;
  }

  /** Consume one use. Returns true if the strip is now destroyed. */
  consumeUse(): boolean {
    this.usesRemaining--;
    this.structureInstance.hp = this.usesRemaining;
    if (this.usesRemaining <= 0) {
      this.structureInstance.hp = 0;
      this.destroy();
      return true;
    }
    return false;
  }

  /** Returns true if the strip is still alive and has remaining uses. */
  isAlive(): boolean {
    return this.active && this.usesRemaining > 0;
  }
}
