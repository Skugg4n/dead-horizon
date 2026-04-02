import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

const COLOR = 0x888800;

/**
 * Landmine -- explodes on contact dealing AOE damage to all zombies in radius.
 * Single use; destroys itself after triggering.
 * The scene handles the actual AOE damage logic via the 'landmine-exploded' event.
 */
export class Landmine extends Phaser.GameObjects.Graphics {
  public structureInstance: StructureInstance;
  public trapDamage: number;
  public aoeRadius: number;

  constructor(
    scene: Phaser.Scene,
    instance: StructureInstance,
    trapDamage: number,
    aoeRadius: number
  ) {
    super(scene);
    this.structureInstance = instance;
    this.trapDamage = trapDamage;
    this.aoeRadius = aoeRadius;

    this.setPosition(instance.x, instance.y);
    this.draw();

    scene.add.existing(this);
  }

  private draw(): void {
    this.clear();
    // Dark olive background
    this.fillStyle(0x1A1A00);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;
    const r = TILE_SIZE / 2 - 4;

    // Circle body
    this.fillStyle(COLOR);
    this.fillCircle(mid, mid, r);

    // Cross detonator on top
    this.lineStyle(2, 0xFFFF44);
    this.lineBetween(mid - 4, mid, mid + 4, mid);
    this.lineBetween(mid, mid - 4, mid, mid + 4);

    // Border
    this.lineStyle(1, 0xE8DCC8, 0.2);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  /** Trigger the mine. Emits 'landmine-exploded' event with position data.
   *  Returns true (always destroyed on trigger). */
  trigger(): boolean {
    const cx = this.structureInstance.x + TILE_SIZE / 2;
    const cy = this.structureInstance.y + TILE_SIZE / 2;
    this.scene.events.emit('landmine-exploded', cx, cy, this.trapDamage, this.aoeRadius);
    this.structureInstance.hp = 0;
    this.destroy();
    return true;
  }
}
