import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/** 3x3 zone side length for the net AOE. */
const NET_ZONE_SIZE = TILE_SIZE * 3;

/**
 * Net Launcher -- a spring-loaded compressed-air cannon that fires a weighted
 * fishing net over a 3x3 tile area. All zombies caught in the net are immobilized
 * (fully stunned) for 4 seconds.
 *
 * Stats (structures.json):
 *   - Immobilize 4s for all zombies in 3x3 AOE
 *   - Cooldown: 12s (reloading net)
 *   - 80 HP
 *   - Malfunction chance: 15%
 *   - No fuel
 */
export class NetLauncher extends TrapBase {
  /** Immobilize/stun duration in ms. */
  public readonly immobilizeDuration: number = 4000;

  /** Net zone size in pixels (3 tiles wide, 3 tiles tall treated as radius from center). */
  public readonly netZoneSize: number = NET_ZONE_SIZE;

  /** Net deploy animation timer in ms. */
  private netDeployTimer: number = 0;

  /** Net overlay opacity during deploy animation. */
  private netAlpha: number = 0;

  /** Cannon aim angle (sweeps for animation). */
  private aimAngle: number = -Math.PI / 4;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      80,     // maxHp
      12000,  // cooldownMs (12s)
      0,      // overheatMax (no overheat)
      0,      // recoveryMs
      0.15,   // malfunctionChance
      -1,     // uses (-1 = unlimited)
      0,      // fuelPerNight
    );
  }

  protected draw(): void {
    this.clear();

    // Dark steel base
    this.fillStyle(0x181812);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    const mid = TILE_SIZE / 2;
    const isReady = this.isReady() && !this.malfunctioned;
    const isDeploying = this.netDeployTimer > 0;

    // Base mounting plate
    this.fillStyle(0x555544);
    this.fillRect(6, TILE_SIZE - 8, TILE_SIZE - 12, 6);

    // Cannon barrel
    const barrelLength = 14;
    const barrelColor = isReady ? 0x888877 : 0x444433;
    this.lineStyle(4, barrelColor, 0.9);
    this.lineBetween(
      mid,
      mid,
      mid + Math.cos(this.aimAngle) * barrelLength,
      mid + Math.sin(this.aimAngle) * barrelLength,
    );

    // Barrel tip
    this.fillStyle(barrelColor);
    this.fillCircle(
      mid + Math.cos(this.aimAngle) * barrelLength,
      mid + Math.sin(this.aimAngle) * barrelLength,
      3,
    );

    // Compression spring indicator (coil behind barrel)
    this.lineStyle(2, isReady ? 0xCCBB44 : 0x444433, 0.6);
    this.lineBetween(mid - 4, mid + 6, mid + 4, mid + 6);

    // Loaded net indicator (yellow dot when ready)
    if (isReady && !isDeploying) {
      this.fillStyle(0xEEBB22, 0.8);
      this.fillCircle(mid, mid, 4);
    }

    // Net deploy animation: expanding net hexagons across zone
    if (isDeploying) {
      const progress = 1 - this.netDeployTimer / 400;
      const netRadius = progress * NET_ZONE_SIZE * 0.5;

      // Net overlay -- fading rope pattern
      this.lineStyle(1, 0xCCAA44, this.netAlpha);
      // Horizontal strands
      const strandCount = 4;
      for (let i = 0; i < strandCount; i++) {
        const ys = (i / (strandCount - 1)) * TILE_SIZE;
        this.lineBetween(-netRadius * 0.3, ys, TILE_SIZE + netRadius * 0.3, ys);
      }
      // Diagonal strands
      this.lineBetween(0, 0, TILE_SIZE, TILE_SIZE);
      this.lineBetween(TILE_SIZE, 0, 0, TILE_SIZE);

      // Expanding circle showing catch radius
      this.lineStyle(2, 0xDDAA33, this.netAlpha * 0.6);
      this.strokeCircle(mid, mid, netRadius * 0.5);
    }

    // Net zone indicator (faint AOE footprint)
    if (isReady) {
      this.lineStyle(1, 0x998822, 0.1);
      this.strokeRect(
        -(NET_ZONE_SIZE - TILE_SIZE) / 2,
        -(NET_ZONE_SIZE - TILE_SIZE) / 2,
        NET_ZONE_SIZE,
        NET_ZONE_SIZE,
      );
    }

    // Border
    this.lineStyle(1, 0xE8DCC8, 0.15);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  }

  override update(delta: number): void {
    super.update(delta);

    if (this.netDeployTimer > 0) {
      this.netDeployTimer = Math.max(0, this.netDeployTimer - delta);
      this.netAlpha = (this.netDeployTimer / 400) * 0.6;
    } else {
      this.netAlpha = 0;
    }

    // Slow aim sweep when on cooldown (reloading)
    if (this.cooldownTimer > 0) {
      this.aimAngle += delta * 0.0005;
    }

    this.clear();
    this.draw();
  }

  /** Trigger the net deploy animation. Called by NightScene after activation. */
  triggerNetDeployEffect(): void {
    this.netDeployTimer = 400;
    this.netAlpha = 0.6;
    this.clear();
    this.draw();
  }

  /**
   * Immobilize (stun) the zombie. NightScene calls this for ALL zombies in the
   * 3x3 AOE zone after a single tryActivate() succeeds.
   */
  onZombieContact(zombie: Zombie): void {
    zombie.applyStun(this.immobilizeDuration);
    this.netDeployTimer = 400;
  }

  /**
   * Check if a world-space point is within the 3x3 AOE zone centered on the launcher.
   */
  containsPoint(wx: number, wy: number): boolean {
    const cx = this.structureInstance.x + TILE_SIZE / 2;
    const cy = this.structureInstance.y + TILE_SIZE / 2;
    const half = NET_ZONE_SIZE / 2;
    return wx >= cx - half && wx <= cx + half &&
           wy >= cy - half && wy <= cy + half;
  }
}
