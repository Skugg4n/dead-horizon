import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

const COLOR = 0x334455;

/**
 * Oil Slick -- heavy slow (80%) in a 3-tile wide zone.
 * Lasts for a fixed number of nights (tracked via instance.hp as night counter).
 * Rendered as a dark iridescent puddle spanning 3 tiles wide.
 */
export class OilSlick extends Phaser.GameObjects.Graphics {
  public structureInstance: StructureInstance;
  private slowFactor: number;
  /** Width in tiles -- oil slick spans this many tiles horizontally */
  private widthTiles: number;

  constructor(
    scene: Phaser.Scene,
    instance: StructureInstance,
    slowFactor: number,
    widthTiles: number
  ) {
    super(scene);
    this.structureInstance = instance;
    this.slowFactor = slowFactor;
    this.widthTiles = widthTiles;

    this.setPosition(instance.x, instance.y);
    this.draw();

    scene.add.existing(this);

    // Rotate vertical if needed
    if (instance.rotation === 1) {
      this.setRotation(Math.PI / 2);
      this.setPosition(instance.x + TILE_SIZE, instance.y);
    }

    // Idle iridescent shimmer: subtle alpha variation simulates liquid surface
    scene.tweens.add({
      targets: this,
      alpha: { from: 0.82, to: 0.98 },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private draw(): void {
    this.clear();
    const totalWidth = this.widthTiles * TILE_SIZE;

    // Dark base coat
    this.fillStyle(0x1A2230, 0.85);
    this.fillRect(0, 0, totalWidth, TILE_SIZE);

    // Iridescent sheen (overlapping semi-transparent ellipses)
    this.fillStyle(COLOR, 0.7);
    this.fillEllipse(totalWidth * 0.3, TILE_SIZE / 2, totalWidth * 0.5, TILE_SIZE * 0.7);

    this.fillStyle(0x556677, 0.5);
    this.fillEllipse(totalWidth * 0.65, TILE_SIZE / 2, totalWidth * 0.45, TILE_SIZE * 0.6);

    this.fillStyle(0x446655, 0.4);
    this.fillEllipse(totalWidth * 0.5, TILE_SIZE * 0.35, totalWidth * 0.35, TILE_SIZE * 0.4);

    // Border
    this.lineStyle(1, 0x8899AA, 0.3);
    this.strokeRect(0, 0, totalWidth, TILE_SIZE);
  }

  /** Slow factor applied to enemies inside the slick zone */
  getSlowFactor(): number {
    return this.slowFactor;
  }

  /** Total pixel width of the slick zone */
  getZoneWidth(): number {
    return this.widthTiles * TILE_SIZE;
  }

  /**
   * Check whether a world-space x,y coordinate falls within the oil zone.
   * Uses the expanded width instead of single-tile check.
   */
  containsPoint(worldX: number, worldY: number): boolean {
    const ox = this.structureInstance.x;
    const oy = this.structureInstance.y;
    if (this.structureInstance.rotation === 1) {
      return (
        worldX >= ox && worldX <= ox + TILE_SIZE &&
        worldY >= oy && worldY <= oy + this.widthTiles * TILE_SIZE
      );
    }
    return (
      worldX >= ox &&
      worldX <= ox + this.widthTiles * TILE_SIZE &&
      worldY >= oy &&
      worldY <= oy + TILE_SIZE
    );
  }

  /** Each night this is called; returns true when the slick has expired */
  consumeNight(): boolean {
    this.structureInstance.hp--;
    if (this.structureInstance.hp <= 0) {
      this.structureInstance.hp = 0;
      this.destroy();
      return true;
    }
    return false;
  }
}
