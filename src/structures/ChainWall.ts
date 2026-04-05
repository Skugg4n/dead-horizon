import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/** Damage dealt to zombies that press against the chain wall. */
const CONTACT_DAMAGE = 10;

/**
 * Chain Wall -- a heavy chain-link barrier that blocks zombies and deals
 * contact damage to those pressing against it.
 * Tier 2 mechanical trap: extends TrapBase (malfunction).
 * No cooldown -- damage is continuous like a barricade.
 *
 * Stats (from structures.json):
 *   - Blocks zombies (physics collider added by NightScene)
 *   - 10 dmg on contact (brutes pressing against it)
 *   - 200 HP structural durability (tankiest trap)
 *   - Malfunction chance: 5% (chain rusts shut -- blocks but no damage)
 */
export class ChainWall extends TrapBase {
  /** Damage per brute attack contact. */
  public readonly contactDamage: number = CONTACT_DAMAGE;

  /**
   * Metallic glint flash timer in ms.
   * Triggers a brief silver shimmer when a zombie is damaged.
   */
  private glintTimer: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      200,    // maxHp (very durable)
      0,      // cooldownMs (no cooldown)
      0,      // overheatMax (no overheat)
      0,      // recoveryMs
      0.05,   // malfunctionChance (5%)
      -1,     // uses (-1 = unlimited)
      0,      // fuelPerNight
    );
  }

  protected draw(): void {
    this.clear();

    // Chain link fence background
    this.fillStyle(0x1A1A0A);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Draw chain link pattern: diamond grid
    const chainColor = this.malfunctioned ? 0x886644 : 0x888866;
    const linkAlpha  = this.malfunctioned ? 0.5 : 0.85;

    this.lineStyle(1, chainColor, linkAlpha);

    // Diagonal grid creating chain-link diamond pattern
    const spacing = 8;
    for (let i = -TILE_SIZE; i < TILE_SIZE * 2; i += spacing) {
      // Top-left to bottom-right diagonals
      this.lineBetween(i, 0, i + TILE_SIZE, TILE_SIZE);
      // Top-right to bottom-left diagonals
      this.lineBetween(TILE_SIZE - i, 0, -i, TILE_SIZE);
    }

    // HP indicator: vertical bar on the left edge
    const hpFraction = this.hp / this.maxHp;
    const barH = Math.round(TILE_SIZE * hpFraction);
    this.fillStyle(0x44AA44, 0.5);
    this.fillRect(0, TILE_SIZE - barH, 3, barH);

    // Vertical support posts
    this.lineStyle(2, 0xAAA888);
    this.lineBetween(0, 0, 0, TILE_SIZE);
    this.lineBetween(TILE_SIZE - 1, 0, TILE_SIZE - 1, TILE_SIZE);

    // Metallic glint flash overlay on contact damage
    if (this.glintTimer > 0) {
      const intensity = this.glintTimer / 120;
      // Silver shimmer across the chains
      this.fillStyle(0xCCCCBB, 0.35 * intensity);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      // Bright highlight on the posts
      this.lineStyle(2, 0xFFFFEE, 0.7 * intensity);
      this.lineBetween(0, 0, 0, TILE_SIZE);
      this.lineBetween(TILE_SIZE - 1, 0, TILE_SIZE - 1, TILE_SIZE);
    }

    // Border
    this.lineStyle(1, 0x888866, 0.4);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    // Count down glint timer and redraw if active
    if (this.glintTimer > 0) {
      this.glintTimer = Math.max(0, this.glintTimer - delta);
      this.clear();
      this.draw();
    }
  }

  /**
   * Trigger the metallic glint flash when contact damage is applied.
   * Called by NightScene (or onZombieContact) after a zombie is damaged.
   */
  triggerActivationEffect(): void {
    this.glintTimer = 120; // 120ms silver shimmer
    this.clear();
    this.draw();
  }

  /**
   * Called when a zombie is in contact. Applies contact damage.
   * NightScene calls this via the wall collider callback for brutes.
   */
  onZombieContact(zombie: Zombie): void {
    if (this.malfunctioned) return;
    zombie.takeDamage(this.contactDamage);
    this.triggerActivationEffect();
  }

  /**
   * Structural damage from brute attacks.
   * Overrides TrapBase.takeDamage to also redraw.
   */
  override takeDamage(amount: number): boolean {
    const destroyed = super.takeDamage(amount);
    if (!destroyed) {
      // Redraw to update HP bar
      this.clear();
      this.draw();
    }
    return destroyed;
  }
}
