import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

/**
 * Glue Floor -- industrial adhesive spread across the floor.
 * 90% slow in zone for 2 nights. Passive (extends Graphics, NOT TrapBase).
 * Wide zone: 3 tiles.
 */
export class GlueFloor extends Phaser.GameObjects.Graphics {
  public structureInstance: StructureInstance;

  /** Slow factor applied each frame (0.10 = 90% slow). */
  public readonly slowFactor: number;

  /** Width in tiles. */
  public readonly widthTiles: number;

  /** Animated drip timer. */
  private animTimer: number = 0;
  private dripPhase: number = 0;

  constructor(
    scene: Phaser.Scene,
    instance: StructureInstance,
    slowFactor: number = 0.10,
    widthTiles: number = 3,
  ) {
    super(scene);
    this.structureInstance = instance;
    this.slowFactor = slowFactor;
    this.widthTiles = widthTiles;
    this.setPosition(instance.x, instance.y);
    this.draw();
    scene.add.existing(this);

    if (instance.rotation === 1) {
      this.setRotation(Math.PI / 2);
      this.setPosition(instance.x + TILE_SIZE, instance.y);
    }
  }

  private draw(): void {
    this.clear();

    const totalW = this.widthTiles * TILE_SIZE;
    const totalH = TILE_SIZE;

    // Translucent yellowish-green glue base
    this.fillStyle(0x88AA22, 0.45);
    this.fillRect(0, 0, totalW, totalH);

    // Glue drip pattern: random-looking blobs
    this.fillStyle(0xAACC44, 0.55);
    for (let col = 0; col < this.widthTiles; col++) {
      const ox = col * TILE_SIZE;
      this.fillCircle(ox + TILE_SIZE * 0.3, totalH * 0.4, 7);
      this.fillCircle(ox + TILE_SIZE * 0.7, totalH * 0.6, 5);
    }

    // Sticky tendrils connecting blobs
    this.lineStyle(2, 0x99BB33, 0.6);
    for (let col = 0; col < this.widthTiles - 1; col++) {
      const ox = col * TILE_SIZE;
      this.lineBetween(ox + TILE_SIZE * 0.7, totalH * 0.5, ox + TILE_SIZE + TILE_SIZE * 0.3, totalH * 0.45);
    }

    // Animated drip blobs based on phase
    if (this.dripPhase > 0.5) {
      this.fillStyle(0xBBDD55, 0.7);
      this.fillCircle(TILE_SIZE * 0.5, totalH * 0.8 + Math.sin(this.dripPhase * Math.PI) * 4, 3);
    }

    // Border
    this.lineStyle(1, 0x99BB22, 0.35);
    this.strokeRect(0, 0, totalW, totalH);
  }

  /**
   * Returns true if the point is inside the glue zone.
   */
  containsPoint(wx: number, wy: number): boolean {
    const lx = wx - this.structureInstance.x;
    const ly = wy - this.structureInstance.y;
    if (this.structureInstance.rotation === 1) {
      return lx >= 0 && lx <= TILE_SIZE && ly >= 0 && ly <= this.widthTiles * TILE_SIZE;
    }
    return lx >= 0 && lx <= this.widthTiles * TILE_SIZE && ly >= 0 && ly <= TILE_SIZE;
  }

  /**
   * Per-frame animation update. Call from NightScene.
   */
  animUpdate(delta: number): void {
    this.animTimer += delta;
    if (this.animTimer > 600) {
      this.animTimer = 0;
      this.dripPhase = (this.dripPhase + 0.3) % 1.0;
      this.draw();
    }
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

  isAlive(): boolean {
    return this.active && this.structureInstance.hp > 0;
  }
}
