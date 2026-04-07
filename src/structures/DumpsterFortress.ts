import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

/**
 * Dumpster Fortress -- a reinforced dumpster with shooting holes.
 * Passive blocker: blocks zombies (physics body added by NightScene via wallBodies group).
 * 150 HP. Refugees can be assigned to shoot from inside.
 * Costs 6 scrap + 1 parts.
 */
export class DumpsterFortress extends Phaser.GameObjects.Graphics {
  public structureInstance: StructureInstance;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(scene);
    this.structureInstance = instance;
    this.setPosition(instance.x, instance.y);
    this.draw();
    scene.add.existing(this);
  }

  private draw(): void {
    this.clear();

    const maxHp = 150;
    const hpRatio = this.structureInstance.hp / maxHp;

    // Heavy steel dumpster body
    const bodyColor = hpRatio > 0.5 ? 0x336633 : 0x224422;
    this.fillStyle(bodyColor);
    this.fillRect(1, 4, TILE_SIZE - 2, TILE_SIZE - 8);

    // Lid (hinged open at an angle -- fortress mode)
    this.fillStyle(0x446644);
    this.fillRect(2, 2, TILE_SIZE - 4, 4);

    // Reinforcement ribs (horizontal bands)
    this.lineStyle(2, 0x225522);
    this.lineBetween(1, 12, TILE_SIZE - 1, 12);
    this.lineBetween(1, 20, TILE_SIZE - 1, 20);

    // Shooting holes (dark rectangular slits)
    this.fillStyle(0x0A0A0A);
    this.fillRect(4, 14, 6, 3);   // left slit
    this.fillRect(TILE_SIZE - 10, 14, 6, 3); // right slit
    this.fillRect(TILE_SIZE / 2 - 3, 8, 6, 3); // center top slit

    // Bolt pattern on corners
    this.fillStyle(0x888866, 0.7);
    this.fillRect(2, 5, 3, 3);
    this.fillRect(TILE_SIZE - 5, 5, 3, 3);
    this.fillRect(2, TILE_SIZE - 12, 3, 3);
    this.fillRect(TILE_SIZE - 5, TILE_SIZE - 12, 3, 3);

    // Dented bottom section
    this.fillStyle(0x1A2A1A);
    this.fillRect(1, TILE_SIZE - 8, TILE_SIZE - 2, 6);

    // Wheels/skids at bottom
    this.fillStyle(0x111111);
    this.fillRect(3, TILE_SIZE - 5, 5, 3);
    this.fillRect(TILE_SIZE - 8, TILE_SIZE - 5, 5, 3);

    // Damage: exposed metal
    if (hpRatio < 0.4) {
      this.lineStyle(1, 0x88AA44, 0.5);
      this.lineBetween(5, 7, 9, 11);
      this.lineBetween(TILE_SIZE - 9, 16, TILE_SIZE - 5, 21);
      this.fillStyle(0x000000, 0.3);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    }

    // HP bar
    const barH = Math.round(TILE_SIZE * hpRatio);
    this.fillStyle(0x44AA44, 0.45);
    this.fillRect(0, TILE_SIZE - barH, 3, barH);

    // Border
    this.lineStyle(1, 0xE8DCC8, 0.25);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  takeDamage(amount: number): boolean {
    this.structureInstance.hp -= amount;
    if (this.structureInstance.hp <= 0) {
      this.structureInstance.hp = 0;
      this.destroy();
      return true;
    }
    this.draw();
    return false;
  }

  isAlive(): boolean {
    return this.active && this.structureInstance.hp > 0;
  }
}
