import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

const COLOR = 0xB8A060;

/**
 * Sandbags -- slows enemies more than a Barricade but has less HP.
 * Cheaper than Barricade (3 scrap vs 5 scrap).
 * Slow factor 0.4 (60% speed reduction) from structures.json.
 */
export class Sandbags extends Phaser.GameObjects.Graphics {
  public structureInstance: StructureInstance;
  private slowFactor: number;

  constructor(scene: Phaser.Scene, instance: StructureInstance, slowFactor: number) {
    super(scene);
    this.structureInstance = instance;
    this.slowFactor = slowFactor;

    this.setPosition(instance.x, instance.y);
    this.draw();

    scene.add.existing(this);

    // Idle alpha pulse: subtle settling effect
    scene.tweens.add({
      targets: this,
      alpha: { from: 0.9, to: 1.0 },
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private draw(): void {
    this.clear();
    // Sandy background
    this.fillStyle(0x9B8040);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Sandbag rows (stacked oval shapes approximated)
    this.fillStyle(COLOR);
    const bagW = TILE_SIZE / 3 - 2;
    const bagH = 8;
    for (let row = 0; row < 3; row++) {
      const y = 4 + row * (bagH + 3);
      for (let col = 0; col < 3; col++) {
        const x = 2 + col * (bagW + 2);
        this.fillRoundedRect(x, y, bagW, bagH, 3);
      }
    }

    // Outline
    this.lineStyle(1, 0xE8DCC8, 0.35);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Shadow detail: dark line at bottom of each bag row to show depth
    this.lineStyle(1, 0x6B5020, 0.4);
    for (let row = 0; row < 3; row++) {
      const y = 4 + row * 11 + 7;
      this.lineBetween(2, y, TILE_SIZE - 2, y);
    }
  }

  /** Slow factor applied to enemies passing through (lower = slower) */
  getSlowFactor(): number {
    return this.slowFactor;
  }

  takeDamage(amount: number): boolean {
    this.structureInstance.hp -= amount;
    if (this.structureInstance.hp <= 0) {
      this.structureInstance.hp = 0;
      this.destroy();
      return true;
    }
    return false;
  }
}
