import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';

/** Zone radius in pixels. Matches structures.json zoneRadius. */
export const FLOODLIGHT_RADIUS = 96;

/**
 * Floodlight -- a mounted beam that burns zombies standing in its light.
 * Deals continuous damage per second to any zombie within the zone radius.
 * Runs on 1 food/night (fuel). The big glowing aura the Glass Shards used
 * to have moved here -- a light burning zombies makes more sense than
 * broken glass magically radiating damage.
 */
export class Floodlight extends Phaser.GameObjects.Graphics {
  public structureInstance: StructureInstance;

  /** Damage per second (from structures.json). */
  public readonly damagePerSecond: number;

  /** Zone radius in pixels. */
  public readonly zoneRadius: number;

  /** Fuel usage per night (food). */
  public readonly fuelPerNight: number;

  /** Malfunction chance at night start (0..1). */
  public readonly malfunctionChance: number;

  /** True if malfunctioned this night (no damage, no beam). */
  public malfunctioned: boolean = false;

  /** Animation phase for pulsing beam. */
  private pulsePhase: number = 0;

  constructor(
    scene: Phaser.Scene,
    instance: StructureInstance,
    damagePerSecond: number,
    zoneRadius: number,
    fuelPerNight: number,
    malfunctionChance: number,
  ) {
    super(scene);
    this.structureInstance = instance;
    this.damagePerSecond = damagePerSecond;
    this.zoneRadius = zoneRadius;
    this.fuelPerNight = fuelPerNight;
    this.malfunctionChance = malfunctionChance;

    this.setPosition(instance.x, instance.y);
    this.draw();

    scene.add.existing(this);
  }

  private draw(): void {
    this.clear();

    const cx = TILE_SIZE / 2;
    const cy = TILE_SIZE / 2;

    if (this.malfunctioned) {
      // Dark housing with dim red bulb
      this.fillStyle(0x333333);
      this.fillRect(8, 8, 16, 16);
      this.fillStyle(0x661111);
      this.fillCircle(cx, cy, 3);
      this.lineStyle(1, 0x222222, 0.9);
      this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
      return;
    }

    // Pulse factor 0.9..1.1
    const pulse = 0.9 + 0.1 * Math.sin(this.pulsePhase);

    // Glow aura: concentric rings, most transparent at outer edge.
    // 3 rings for a soft falloff effect.
    for (let i = 3; i >= 1; i--) {
      const r = this.zoneRadius * (i / 3) * pulse;
      const alpha = 0.05 + (0.08 * (4 - i) / 3);
      this.fillStyle(0xFFE8A0, alpha);
      this.fillCircle(cx, cy, r);
    }

    // Housing: dark metal square with a bright bulb in the middle.
    this.fillStyle(0x444444);
    this.fillRect(6, 6, 20, 20);
    this.lineStyle(1, 0x888888, 1);
    this.strokeRect(6, 6, 20, 20);

    // Bright central bulb
    this.fillStyle(0xFFEEB0, 1);
    this.fillCircle(cx, cy, 4);
    this.fillStyle(0xFFFFFF, 0.9);
    this.fillCircle(cx, cy, 2);
  }

  /**
   * Advance pulse animation. Call from NightScene.update() each frame.
   */
  animUpdate(delta: number): void {
    if (this.malfunctioned) return;
    this.pulsePhase += delta * 0.003;
    this.draw();
  }

  /** Returns true if the world-space point is within the light zone. */
  containsPoint(px: number, py: number): boolean {
    if (this.malfunctioned) return false;
    const cx = this.structureInstance.x + TILE_SIZE / 2;
    const cy = this.structureInstance.y + TILE_SIZE / 2;
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= this.zoneRadius * this.zoneRadius;
  }

  /** Structural damage (brutes smashing it). Returns true if destroyed. */
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
    return this.active;
  }
}
