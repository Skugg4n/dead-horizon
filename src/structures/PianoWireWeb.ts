import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/**
 * Piano Wire Web -- a web of taut piano wire stretched across a passage.
 * Cuts through zombies for 40 dmg, 20 uses before wires snap.
 *
 * Stats:
 *   - 40 dmg per activation
 *   - 20 uses (wire gradually snaps)
 *   - No cooldown (activates every time a zombie touches it)
 *   - No overheat
 */
export class PianoWireWeb extends TrapBase {
  /** Damage per zombie contact. */
  public readonly trapDamage: number = 40;

  /** Number of wires remaining (visual -- decrements with uses). */
  private totalUses: number = 20;

  /** Blood splatter timer on activation. */
  private slashTimer: number = 0;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      60,     // maxHp
      500,    // cooldownMs (0.5s -- quick re-arm between zombies)
      0,      // overheatMax
      0,      // recoveryMs
      0.10,   // malfunctionChance
      20,     // uses (20 wire cuts before it falls apart)
      0,      // fuelPerNight
    );
    this.totalUses = 20;
  }

  protected draw(): void {
    this.clear();

    // Semi-transparent background -- mostly invisible like a wire trap
    this.fillStyle(0x0A0A0A, 0.7);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;
    const isActive = this.isReady() && !this.malfunctioned;

    // Calculate how many wires remain (proportional to uses)
    const usesLeft = this.uses < 0 ? this.totalUses : Math.max(0, this.uses);
    const wiresFraction = this.totalUses > 0 ? usesLeft / this.totalUses : 0;
    const wireCount = Math.round(wiresFraction * 6) + 2; // 2 to 8 wires

    // Horizontal anchor posts on sides
    this.fillStyle(0x888888);
    this.fillRect(0, 2, 4, TILE_SIZE - 4);      // left post
    this.fillRect(TILE_SIZE - 4, 2, 4, TILE_SIZE - 4); // right post

    // Piano wires: thin silver lines crossing the tile at various angles
    const wireAlpha = isActive ? 0.9 : 0.4;
    for (let i = 0; i < wireCount; i++) {
      const t = wireCount <= 1 ? 0.5 : i / (wireCount - 1);
      const y1 = 4 + t * (TILE_SIZE - 8);
      // Slight tension sag in the middle
      const sag = isActive ? 1 : 3;
      const ymid = y1 + sag;

      this.lineStyle(1, isActive ? 0xDDDDCC : 0x666655, wireAlpha);
      // Wire as two segments meeting in the middle (slight sag)
      this.lineBetween(0, y1, mid, ymid);
      this.lineBetween(mid, ymid, TILE_SIZE, y1);
    }

    // Crossed diagonal wires for web effect
    if (wiresFraction > 0.5) {
      this.lineStyle(1, isActive ? 0xBBBBAA : 0x555544, wireAlpha * 0.7);
      this.lineBetween(4, 4, TILE_SIZE - 4, TILE_SIZE - 4);
      this.lineBetween(4, TILE_SIZE - 4, TILE_SIZE - 4, 4);
    }

    // Uses remaining: small notches on left post
    this.fillStyle(isActive ? 0xCCCC88 : 0x555544);
    const maxDots = 10;
    const dotsToShow = Math.ceil(wiresFraction * maxDots);
    for (let i = 0; i < dotsToShow; i++) {
      this.fillRect(1, 4 + i * (TILE_SIZE - 8) / maxDots, 2, 1);
    }

    // Slash effect on activation
    if (this.slashTimer > 0) {
      const intensity = this.slashTimer / 150;
      // Red slash across the wire
      this.lineStyle(3, 0xFF2200, 0.8 * intensity);
      this.lineBetween(0, mid - 4, TILE_SIZE, mid + 4);
      // Blood mist
      this.fillStyle(0x880000, 0.3 * intensity);
      this.fillCircle(mid, mid, 10 * intensity);
    }

    // Border
    this.lineStyle(1, 0x888877, isActive ? 0.3 : 0.1);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    // Tick slash effect
    if (this.slashTimer > 0) {
      this.slashTimer = Math.max(0, this.slashTimer - delta);
    }

    this.clear();
    this.draw();
  }

  onZombieContact(zombie: Zombie): void {
    zombie.takeDamage(this.trapDamage);
    this.slashTimer = 150;
    this.clear();
    this.draw();
  }
}
