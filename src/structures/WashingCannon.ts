import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

const RANGE = 150;
const PROJECTILE_SPEED = 280; // pixels per second
const PROJECTILE_COLOR = 0xAAAAAA;

/**
 * Washing Machine Cannon -- fires improvised metal projectiles at the nearest zombie.
 *
 * Visual: a battered washing machine graphic; fires a small rectangle projectile.
 * Damage: 30 per hit. Range: 150px. Cooldown: 3s.
 * Overheat after 25s, malfunction 20%.
 */
export class WashingCannon extends TrapBase {
  public readonly range: number = RANGE;
  public readonly projectileDamage: number = 30;

  /** Scene reference for spawning projectiles. */
  private sceneRef: Phaser.Scene;

  /** Active projectile Graphics objects. Destroyed on zombie hit or range-out. */
  private activeProjectiles: WashingProjectile[] = [];

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      120,   // maxHp
      3000,  // cooldownMs (3s)
      25000, // overheatMax (25s)
      12000, // recoveryMs
      0.20,  // malfunctionChance (20%)
      -1,    // uses (-1 = unlimited)
      0,     // fuelPerNight
    );
    this.sceneRef = scene;
  }

  protected draw(): void {
    this.clear();

    // Machine body background
    this.fillStyle(0x1A1A2A);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Drum door (circle)
    this.fillStyle(0x333366);
    this.fillCircle(TILE_SIZE / 2, TILE_SIZE / 2, 11);

    // Inner drum
    this.lineStyle(2, 0x4444AA);
    this.strokeCircle(TILE_SIZE / 2, TILE_SIZE / 2, 8);

    // Control panel (top)
    this.fillStyle(0x222222);
    this.fillRect(2, 2, TILE_SIZE - 4, 6);
    this.fillStyle(0xFF4444);
    this.fillCircle(TILE_SIZE - 6, 5, 2); // red indicator light

    // Border
    this.lineStyle(1, 0xE8DCC8, 0.25);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    // Update in-flight projectiles
    this.activeProjectiles = this.activeProjectiles.filter(p => p.active);
    for (const p of this.activeProjectiles) {
      p.updateProjectile(delta);
    }
  }

  onZombieContact(zombie: Zombie): void {
    // Fire a projectile toward the zombie (NightScene ensures zombie is nearest in range)
    const cx = this.structureInstance.x + TILE_SIZE / 2;
    const cy = this.structureInstance.y + TILE_SIZE / 2;
    const angle = Math.atan2(zombie.y - cy, zombie.x - cx);

    const proj = new WashingProjectile(
      this.sceneRef,
      cx,
      cy,
      angle,
      PROJECTILE_SPEED,
      this.projectileDamage,
      this.range,
    );
    this.activeProjectiles.push(proj);
  }

  /**
   * Check if any active projectile hits the given zombie.
   * Called by NightScene once per frame for the cannon range-check loop.
   */
  checkProjectileHit(zombie: Zombie): boolean {
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const p = this.activeProjectiles[i];
      if (!p || !p.active) continue;
      if (p.hitsZombie(zombie)) {
        zombie.takeDamage(this.projectileDamage);
        p.explode();
        this.activeProjectiles.splice(i, 1);
        return true;
      }
    }
    return false;
  }
}

/**
 * Small projectile Graphics object that travels in a straight line.
 * Self-destructs when it exceeds maxRange from origin.
 */
class WashingProjectile extends Phaser.GameObjects.Graphics {
  private vx: number;
  private vy: number;
  private originX: number;
  private originY: number;
  private maxRange: number;
  private damage: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    maxRange: number,
  ) {
    super(scene);
    this.originX = x;
    this.originY = y;
    this.maxRange = maxRange;
    this.damage = damage;

    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.setPosition(x, y);
    this.fillStyle(PROJECTILE_COLOR);
    this.fillRect(-3, -3, 6, 6);

    scene.add.existing(this);
  }

  get projectileDamage(): number { return this.damage; }

  updateProjectile(delta: number): void {
    if (!this.active) return;

    const dt = delta / 1000;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const dx = this.x - this.originX;
    const dy = this.y - this.originY;
    if (dx * dx + dy * dy > this.maxRange * this.maxRange) {
      this.destroy();
    }
  }

  hitsZombie(zombie: Zombie): boolean {
    const dx = this.x - zombie.x;
    const dy = this.y - zombie.y;
    return dx * dx + dy * dy < 12 * 12; // 12px collision radius
  }

  explode(): void {
    this.destroy();
  }
}
