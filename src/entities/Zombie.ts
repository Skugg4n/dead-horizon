import Phaser from 'phaser';
import enemiesData from '../data/enemies.json';
import { AudioManager } from '../systems/AudioManager';
import type { PathGrid } from '../systems/PathGrid';
import type { ZoneId } from '../config/types';

// Re-export so WaveManager and other systems can import ZoneId from this module
export type { ZoneId };

export type ZombieBehavior =
  | 'walker'
  | 'runner'
  | 'brute'
  | 'spitter'
  | 'screamer'
  | 'boss'
  | 'city_crawler'
  | 'military_heavy'
  | 'tunnel_zombie'
  | 'forest_boss'
  | 'city_boss'
  | 'military_tank';


export interface ZombieConfig {
  id: string;
  hp: number;
  speed: number;
  damage: number;
  awarenessRadius: number;
  spriteKey: string;
  behavior: ZombieBehavior;
  tint: number | null;
  scale: number;
  structureDamage: number;
  range?: number;
  projectileCooldown?: number;
  screamRadius?: number;
  screamCooldown?: number;
  spawnOnDeath?: string;
  spawnCount?: number;
  // City crawler: ignores low walls (barricades)
  ignoresLowWalls?: boolean;
  // Military heavy: flat damage reduction (0.0 - 1.0)
  armorDamageReduction?: number;
  // Tunnel zombie: spawns inside base radius instead of at map edges
  spawnInsideBase?: boolean;
  // Forest boss phase config
  chargeSpeed?: number;
  chargeCooldown?: number;
  chargeDuration?: number;
  rockThrowRange?: number;
  rockThrowCooldown?: number;
  phase2HpThreshold?: number;
  // City boss phase config
  minionSpawnInterval?: number;
  minionType?: string;
  minionCount?: number;
  acidPoolDuration?: number;
  acidPoolDamagePerSec?: number;
  phase4HpThreshold?: number;
  // Military tank config
  weakSpotMultiplier?: number;
  crushStructuresOnPath?: boolean;
}

export class Zombie extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  maxHp: number;
  moveSpeed: number;
  damage: number;
  awarenessRadius: number;
  zombieId: string;
  behavior: ZombieBehavior;
  structureDamage: number;
  private target: Phaser.GameObjects.Sprite | null = null;
  private basePosition: { x: number; y: number } | null = null;
  private attackCooldown: number = 0;
  private structureAttackCooldown: number = 0;

  // Sound attraction
  private soundTarget: { x: number; y: number } | null = null;
  private soundTargetTimer: number = 0;
  private static readonly SOUND_TARGET_DURATION = enemiesData.soundTargetDuration;

  // Pathfinding throttle -- recalculate velocity on interval (150ms on-screen, 500ms off-screen)
  private pathfindTimer: number = 0;
  private _stuckTime: number = 0;
  private _lastStuckX: number = 0;
  private _lastStuckY: number = 0;
  private static readonly PATHFIND_INTERVAL_OFFSCREEN = 500;
  private static readonly PATHFIND_INTERVAL_ONSCREEN = 150;
  offScreen: boolean = false;

  // ------------------------------------------------------------------
  // WAYPOINT PATH FOLLOWING (v6.8.0)
  // ------------------------------------------------------------------
  // Each zombie owns a list of world-coord waypoints (tile centers). It
  // heads to path[pathIndex] and advances when within WAYPOINT_REACH. The
  // path is recomputed via A* every PATH_RECOMPUTE_MS or when invalidated.
  // This replaces the old per-frame steering which caused wall-jitter.
  private path: Array<{ x: number; y: number }> = [];
  private pathIndex: number = 0;
  private pathRecomputeTimer: number = 0;
  private static readonly PATH_RECOMPUTE_MS = 600;
  private static readonly WAYPOINT_REACH = 10;

  // Spitter behavior
  private spitterRange: number = 250;
  private spitterCooldown: number = 3000;
  private spitterTimer: number = 0;

  // Screamer behavior
  private screamRadius: number = 500;
  private screamCooldown: number = 5000;
  private screamTimer: number = 0;

  // Boss behavior
  spawnOnDeath: string | null = null;
  spawnCount: number = 0;
  /** Countdown in ms before next stomp sound. Resets to ~700ms each stomp. */
  private stompTimer: number = 0;

  // City crawler: ignores low walls
  ignoresLowWalls: boolean = false;

  // Military heavy: flat damage reduction 0.0-1.0
  armorDamageReduction: number = 0;

  // Tank: weak spot multiplier (rear attacks deal extra damage)
  weakSpotMultiplier: number = 1.0;

  // Tank: crushes structures when moving through them
  crushStructuresOnPath: boolean = false;

  // Forest boss phase state machine
  // Phase 1: charge toward base. Phase 2 (below 50% HP): also throws rocks.
  private forestBossPhase: 1 | 2 = 1;
  private forestBossChargeTimer: number = 0;
  private forestBossChargeDuration: number = 0;
  private forestBossChargeSpeed: number = 200;
  private forestBossChargeCooldown: number = 4000;
  private forestBossChargeCooldownMax: number = 4000;
  private forestBossCharging: boolean = false;
  private forestBossRockTimer: number = 0;
  private forestBossRockCooldown: number = 3000;
  private forestBossRockRange: number = 300;
  private forestBossPhase2Threshold: number = 0.5;

  // City boss phase state machine
  // Spawns minions every minionSpawnInterval ms. Leaves acid pools. At 25% HP: desperate scream.
  private cityBossMinionTimer: number = 0;
  private cityBossMinionInterval: number = 10000;
  private cityBossMinionType: string = 'spitter';
  private cityBossMinionCount: number = 2;
  private cityBossAcidDuration: number = 5000;
  private cityBossAcidDps: number = 15;
  private cityBossPhase4Threshold: number = 0.25;
  private cityBossDesperateDone: boolean = false;

  // Military tank state
  // Armor: armorDamageReduction from enemies.json applies to all hits.
  // Weak spot (rear): getTankDamageMultiplier() returns weakSpotMultiplier when flanked.

  // F5: Aggro behavior -- determined at spawn time
  // 'base_seeker': moves toward base (70% of zombies)
  // 'wanderer': spreads out inside fort via different flank points (30% of zombies).
  // After WANDERER_CONVERT_MS of wandering, switches to base_seeker so they stop
  // fanning out and commit to a single target -- prevents late-night wanderer stragglers.
  aggroType: 'base_seeker' | 'wanderer' = 'base_seeker';
  private wandererAge: number = 0;
  private static readonly WANDERER_CONVERT_MS = 30000;

  // Death state flag to prevent double kills
  private deathStarted = false;

  // Trap combo tracking -- used by NightScene to detect cross-trap combos
  // Accumulated sub-1-damage from DoT traps (floodlight, glass shards, etc)
  // so we can show a single floater when the total crosses >= 1.
  dotDamageAccum: number = 0;
  // lastTrapHitTime: game time (ms) when this zombie was last hit by a trap
  // lastTrapType: structureId of the last trap that dealt damage
  // comboActive: true for the 2-second window after a trap hit (for UI feedback)
  lastTrapHitTime: number = 0;
  lastTrapType: string = '';
  comboActive: boolean = false;

  // Speed debuff timers (ms remaining). Multiple debuffs stack to worst.
  private crippleTimer: number = 0;   // -50% speed
  private stunTimer: number = 0;      // 0% speed (full stop)

  // Phosphor burn DOT (from Phosphor Rounds ultimate)
  // burnTimer > 0 means zombie is on fire; damage applied per second in update()
  burnDamage: number = 0;  // damage per second
  burnTimer: number = 0;   // remaining burn duration in ms
  private burnTickAccum: number = 0; // accumulator for 1-second burn ticks

  // Pulsing tint for boss/screamer
  private pulseTimer: number = 0;
  private baseTint: number | null = null;

  // Animation keys resolved per zombie type
  private walkAnimKey: string | null = null;
  private attackAnimKey: string | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, config: ZombieConfig) {
    super(scene, x, y, config.spriteKey);

    this.zombieId = config.id;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.moveSpeed = config.speed;
    this.damage = config.damage;
    this.awarenessRadius = config.awarenessRadius;
    this.behavior = config.behavior;
    this.structureDamage = config.structureDamage;

    // Spitter config
    if (config.range) this.spitterRange = config.range;
    if (config.projectileCooldown) this.spitterCooldown = config.projectileCooldown;

    // Screamer config
    if (config.screamRadius) this.screamRadius = config.screamRadius;
    if (config.screamCooldown) this.screamCooldown = config.screamCooldown;

    // Boss config
    if (config.spawnOnDeath) this.spawnOnDeath = config.spawnOnDeath;
    if (config.spawnCount) this.spawnCount = config.spawnCount;

    // Zone-variant config
    if (config.ignoresLowWalls) this.ignoresLowWalls = config.ignoresLowWalls;
    if (config.armorDamageReduction) this.armorDamageReduction = config.armorDamageReduction;
    if (config.weakSpotMultiplier) this.weakSpotMultiplier = config.weakSpotMultiplier;
    if (config.crushStructuresOnPath) this.crushStructuresOnPath = config.crushStructuresOnPath;

    // Forest boss config
    if (config.chargeSpeed) this.forestBossChargeSpeed = config.chargeSpeed;
    if (config.chargeCooldown) {
      this.forestBossChargeCooldown = config.chargeCooldown;
      this.forestBossChargeCooldownMax = config.chargeCooldown;
    }
    if (config.chargeDuration) this.forestBossChargeDuration = config.chargeDuration;
    if (config.rockThrowRange) this.forestBossRockRange = config.rockThrowRange;
    if (config.rockThrowCooldown) this.forestBossRockCooldown = config.rockThrowCooldown;
    if (config.phase2HpThreshold) this.forestBossPhase2Threshold = config.phase2HpThreshold;

    // City boss config
    if (config.minionSpawnInterval) this.cityBossMinionInterval = config.minionSpawnInterval;
    if (config.minionType) this.cityBossMinionType = config.minionType;
    if (config.minionCount) this.cityBossMinionCount = config.minionCount;
    if (config.acidPoolDuration) this.cityBossAcidDuration = config.acidPoolDuration;
    if (config.acidPoolDamagePerSec) this.cityBossAcidDps = config.acidPoolDamagePerSec;
    if (config.phase4HpThreshold) this.cityBossPhase4Threshold = config.phase4HpThreshold;

    this.baseTint = config.tint;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Circular physics body so zombies glide past wall corners instead of
    // catching on them. Rectangular bodies snag; circles slide. Radius 10 in
    // a 32x32 sprite = 20px diameter, fits tile-wide (32px) corridors with
    // ~6px slack on each side and rounds corners cleanly.
    const BODY_RADIUS = 10;
    const BODY_OFFSET = 32 / 2 - BODY_RADIUS;
    this.body?.setCircle(BODY_RADIUS, BODY_OFFSET, BODY_OFFSET);

    this.setDepth(5);
    this.resolveAnimKeys(config);
    this.applyVisuals(config);
  }

  private applyVisuals(config: ZombieConfig): void {
    if (config.tint != null) {
      this.setTint(config.tint);
    }
    if (config.scale !== 1.0) {
      this.setScale(config.scale);
    }
  }

  /**
   * Apply zone-specific color tinting on top of the base tint.
   * Called after initial tint is set so zone flavor is layered correctly.
   * Zone bosses already have their own distinctive tints -- skip them.
   */
  applyZoneTint(zone: ZoneId): void {
    // Zone bosses have custom tints already defined in enemies.json; skip tinting them.
    const isBoss =
      this.behavior === 'forest_boss' ||
      this.behavior === 'city_boss' ||
      this.behavior === 'military_tank' ||
      this.behavior === 'boss';
    if (isBoss) return;

    switch (zone) {
      case 'forest':
        // Dark mossy green tint -- overlays base tint with a green channel boost
        if (this.baseTint != null) {
          // Blend base tint toward dark green (0x2D5A1B)
          const blended = this.blendTint(this.baseTint, 0x2D5A1B, 0.4);
          this.baseTint = blended;
          this.setTint(blended);
        } else {
          this.baseTint = 0x3A6B22;
          this.setTint(0x3A6B22);
        }
        break;
      case 'city':
        // Grey urban tint -- desaturated concrete look
        if (this.baseTint != null) {
          const blended = this.blendTint(this.baseTint, 0x888888, 0.35);
          this.baseTint = blended;
          this.setTint(blended);
        } else {
          this.baseTint = 0x787878;
          this.setTint(0x787878);
        }
        break;
      case 'military':
        // Olive/khaki camouflage tint
        if (this.baseTint != null) {
          const blended = this.blendTint(this.baseTint, 0x5C5C2E, 0.4);
          this.baseTint = blended;
          this.setTint(blended);
        } else {
          this.baseTint = 0x6B6B3A;
          this.setTint(0x6B6B3A);
        }
        break;
    }
  }

  /** Linear interpolate two hex colors by factor t (0=a, 1=b) */
  private blendTint(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xFF;
    const ag = (a >> 8) & 0xFF;
    const ab = a & 0xFF;
    const br = (b >> 16) & 0xFF;
    const bg = (b >> 8) & 0xFF;
    const bb = b & 0xFF;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl2 = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl2;
  }

  /** Resolve which animation keys are available for this zombie type */
  private resolveAnimKeys(config: ZombieConfig): void {
    // Map complex behaviors to base animation prefixes
    const animBehavior = this.getAnimBehavior(config.behavior);
    const walk = `${animBehavior}-walk`;
    this.walkAnimKey = this.scene.anims.exists(walk) ? walk : null;

    // Special attack anims
    if (config.behavior === 'spitter' || config.behavior === 'city_boss') {
      this.attackAnimKey = this.scene.anims.exists('spitter-attack') ? 'spitter-attack' : null;
    } else if (config.behavior === 'screamer') {
      this.attackAnimKey = this.scene.anims.exists('screamer-scream') ? 'screamer-scream' : null;
    } else if (
      config.behavior === 'walker' ||
      config.behavior === 'boss' ||
      config.behavior === 'forest_boss' ||
      config.behavior === 'military_tank' ||
      config.behavior === 'tunnel_zombie'
    ) {
      this.attackAnimKey = this.scene.anims.exists('walker-attack') ? 'walker-attack' : null;
    } else {
      this.attackAnimKey = null;
    }
  }

  /** Map behavior type to a base sprite animation prefix */
  private getAnimBehavior(behavior: ZombieBehavior): string {
    switch (behavior) {
      case 'boss':
      case 'forest_boss':
      case 'military_heavy':
      case 'military_tank':
        return 'walker'; // reuse walker anims for large enemies
      case 'city_crawler':
        return 'runner'; // crawlers are fast like runners
      case 'city_boss':
        return 'walker';
      case 'tunnel_zombie':
        return 'walker';
      default:
        return behavior;
    }
  }

  /** Start walk animation if available */
  private playWalkAnim(): void {
    if (!this.walkAnimKey) return;
    if (!this.anims.isPlaying || this.anims.currentAnim?.key !== this.walkAnimKey) {
      this.play(this.walkAnimKey);
    }
  }

  setTarget(target: Phaser.GameObjects.Sprite): void {
    this.target = target;
  }

  setBasePosition(x: number, y: number): void {
    this.basePosition = { x, y };
  }

  private mapWidth: number = 1280;
  private mapHeight: number = 960;
  private flankTarget: { x: number; y: number } | null = null;

  // Optional reference to the shared PathGrid for steering around walls
  private pathGrid: PathGrid | null = null;

  setMapSize(width: number, height: number): void {
    this.mapWidth = width;
    this.mapHeight = height;
  }

  /** Invalidate the current path (e.g. when a wall is destroyed). */
  invalidatePath(): void {
    this.path = [];
    this.pathIndex = 0;
    this.pathRecomputeTimer = 0;
  }

  setPathGrid(grid: PathGrid): void {
    this.pathGrid = grid;
    this.invalidatePath();
  }

  /**
   * Pick a flanking point -- a spread of targets AROUND the base interior so
   * multiple wanderers fan out inside the fort instead of clumping on the
   * base centre. 20-50px from centre keeps them within the fort but at
   * different positions so A* paths diverge naturally.
   */
  private pickFlankTarget(): void {
    if (!this.basePosition) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 30;
    this.flankTarget = {
      x: Phaser.Math.Clamp(this.basePosition.x + Math.cos(angle) * dist, 32, this.mapWidth - 32),
      y: Phaser.Math.Clamp(this.basePosition.y + Math.sin(angle) * dist, 32, this.mapHeight - 32),
    };
  }

  getTarget(): Phaser.GameObjects.Sprite | null {
    return this.target;
  }

  // Called by SoundMechanic when a weapon fires within range
  onSoundHeard(sourceX: number, sourceY: number): void {
    this.soundTarget = { x: sourceX, y: sourceY };
    this.soundTargetTimer = Zombie.SOUND_TARGET_DURATION;
  }

  // Called by screamer to attract this zombie to a position
  attractTo(x: number, y: number): void {
    this.soundTarget = { x, y };
    this.soundTargetTimer = Zombie.SOUND_TARGET_DURATION;
  }

  /**
   * Apply or refresh phosphor burn DOT.
   * dmgPerSec: damage dealt per second.
   * durationMs: how long the burn lasts in milliseconds.
   * Refreshes if already burning (takes the longer duration).
   */
  applyBurn(dmgPerSec: number, durationMs: number): void {
    this.burnDamage = dmgPerSec;
    // Refresh to full duration if new burn is longer than remaining
    if (durationMs > this.burnTimer) {
      this.burnTimer = durationMs;
    }
    // Reset tick accumulator so first tick fires after 1 full second
    this.burnTickAccum = 0;
  }

  update(delta: number): void {
    if (!this.target || !this.active) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.structureAttackCooldown = Math.max(0, this.structureAttackCooldown - delta);

    // Tick speed debuffs
    if (this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - delta);
      // Fully stopped while stunned -- tint blue to signal
      if (this.stunTimer > 0) {
        this.setVelocity(0, 0);
        this.setTint(0x4488FF);
        return;
      }
      // Stun expired -- restore tint
      this.restoreTint();
    }
    if (this.crippleTimer > 0) {
      this.crippleTimer = Math.max(0, this.crippleTimer - delta);
    }

    // Phosphor burn DOT: apply burnDamage per second while burnTimer > 0
    if (this.burnTimer > 0) {
      this.burnTimer -= delta;
      this.burnTickAccum += delta;
      // Apply one tick of damage every 1000ms
      if (this.burnTickAccum >= 1000) {
        this.burnTickAccum -= 1000;
        this.takeDamage(this.burnDamage);
      }
      // Glow orange while burning
      if (this.burnTimer > 0) {
        this.setTint(0xFF6600);
      } else {
        // Burn expired -- restore tint
        this.burnTimer = 0;
        this.burnTickAccum = 0;
        this.restoreTint();
      }
    }

    // Boss pulsing glow + periodic stomp sound while moving
    if (this.behavior === 'boss') {
      this.updateBossPulse(delta);
      // Stomp sound every ~700ms while the boss is actively moving
      this.stompTimer -= delta;
      if (this.stompTimer <= 0 && this.stunTimer <= 0) {
        const vel = this.body ? Math.abs(this.body.velocity.x) + Math.abs(this.body.velocity.y) : 0;
        if (vel > 5) {
          AudioManager.play('boss_stomp');
        }
        this.stompTimer = 700;
      }
    }

    // Forest boss: charge + phase 2 rock throws
    if (this.behavior === 'forest_boss') {
      this.updateForestBoss(delta);
      return;
    }

    // City boss: spitter queen -- ranged attacks + minion spawns + acid pools
    if (this.behavior === 'city_boss') {
      this.updateCityBoss(delta);
      return;
    }

    // Military tank: armored slow behemoth -- crushes everything
    if (this.behavior === 'military_tank') {
      this.updateMilitaryTank(delta);
      return;
    }

    // Screamer pulsing
    if (this.behavior === 'screamer') {
      this.updateScreamerPulse(delta);
    }

    // Spitter: maintain distance and shoot
    if (this.behavior === 'spitter') {
      this.updateSpitter(delta);
      return;
    }

    // City boss also uses ranged behavior (handled above via updateCityBoss)
    // city_crawler: same movement as walker but ignoresLowWalls flag is checked by NightScene collision
    // military_heavy: same movement as brute, armor reduction applied in takeDamage
    // tunnel_zombie: same movement as walker, spawn logic handled in WaveManager

    // 5C: Throttle pathfinding for all zombies (150ms on-screen, 500ms off-screen)
    this.pathfindTimer -= delta;
    if (this.pathfindTimer > 0) return;
    this.pathfindTimer = this.offScreen
      ? Zombie.PATHFIND_INTERVAL_OFFSCREEN
      : Zombie.PATHFIND_INTERVAL_ONSCREEN;

    // Determine movement target priority:
    // 1. Sound source (weapon fire overrides ALL zombie behaviors, including wanderers)
    // 2a. Wanderer: roam randomly near map edges (30% of zombies)
    // 2b. Base seeker: move toward base (70% of zombies, default)
    // 3. Player position (fallback if no base set)
    let targetX: number;
    let targetY: number;

    if (this.soundTarget && this.soundTargetTimer > 0) {
      // Sound overrides everything -- zombies investigate weapon fire
      this.soundTargetTimer -= delta;
      targetX = this.soundTarget.x;
      targetY = this.soundTarget.y;

      // Check if reached sound source
      const distToSound = Phaser.Math.Distance.Between(
        this.x, this.y, targetX, targetY
      );
      if (distToSound < 16 || this.soundTargetTimer <= 0) {
        this.soundTarget = null;
        this.soundTargetTimer = 0;
      }
    } else if (this.aggroType === 'wanderer' && this.basePosition) {
      // Wanderers flank the base: move to offset points around it
      this.wandererAge += delta;
      if (this.wandererAge > Zombie.WANDERER_CONVERT_MS) {
        // After 30s of wandering, commit to the base -- prevents stragglers
        // circling forever if they can't find their flank point.
        this.aggroType = 'base_seeker';
        this.flankTarget = null;
        this.invalidatePath();
        targetX = this.basePosition.x;
        targetY = this.basePosition.y;
      } else {
        if (!this.flankTarget) this.pickFlankTarget();
        const ft = this.flankTarget ?? this.basePosition;
        targetX = ft.x;
        targetY = ft.y;
        // When reaching flank point, pick a new one (creates circling behavior)
        const distToFlank = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
        if (distToFlank < 12) {
          this.pickFlankTarget();
          this.invalidatePath();
        }
      }
    } else if (this.basePosition) {
      targetX = this.basePosition.x;
      targetY = this.basePosition.y;

      // Stop near the base perimeter instead of spinning on top of the center
      const distToBase = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
      if (distToBase < 48) {
        this.setVelocity(0, 0);
        return;
      }
    } else {
      targetX = this.target.x;
      targetY = this.target.y;
    }

    // Move toward target -- apply cripple debuff if active (-50% speed)
    const speedMult = this.crippleTimer > 0 ? 0.5 : 1.0;

    // ------------------------------------------------------------------
    // WAYPOINT PATH FOLLOWING
    // ------------------------------------------------------------------
    if (this.pathGrid) {
      // Recompute path periodically OR when we've consumed the current one.
      this.pathRecomputeTimer -= delta;
      const needNewPath =
        this.path.length === 0 ||
        this.pathIndex >= this.path.length ||
        this.pathRecomputeTimer <= 0;

      if (needNewPath) {
        this.path = this.pathGrid.findPath(this.x, this.y, targetX, targetY);
        this.pathIndex = 0;
        // Stagger recomputes so 50 zombies don't all refresh on the same frame
        this.pathRecomputeTimer = Zombie.PATH_RECOMPUTE_MS + Math.random() * 200;
      }

      // Advance past any waypoints we've already reached (skip short hops)
      while (this.pathIndex < this.path.length) {
        const wp = this.path[this.pathIndex];
        if (!wp) { this.pathIndex++; continue; }
        const dx = wp.x - this.x;
        const dy = wp.y - this.y;
        if (dx * dx + dy * dy < Zombie.WAYPOINT_REACH * Zombie.WAYPOINT_REACH) {
          this.pathIndex++;
          continue;
        }
        break;
      }

      if (this.pathIndex < this.path.length) {
        const wp = this.path[this.pathIndex];
        if (wp) {
          const dx = wp.x - this.x;
          const dy = wp.y - this.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            this.setVelocity(
              (dx / len) * this.moveSpeed * speedMult,
              (dy / len) * this.moveSpeed * speedMult,
            );
          } else {
            this.setVelocity(0, 0);
          }
        }
      } else {
        // Fell off the end of the path -- head directly to target until next recompute
        const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
        this.setVelocity(
          Math.cos(angle) * this.moveSpeed * speedMult,
          Math.sin(angle) * this.moveSpeed * speedMult,
        );
      }

      // Stuck detection safety net: if the zombie has barely moved for 600ms,
      // invalidate the path so next frame picks a fresh one. Does NOT spin
      // wildly any more -- it just forces a recompute which tends to find a
      // different route if the old one was blocked.
      const moved = Math.abs(this.x - this._lastStuckX) + Math.abs(this.y - this._lastStuckY);
      if (moved < 3) {
        this._stuckTime += delta;
        if (this._stuckTime > 600) {
          this.invalidatePath();
          this._stuckTime = 0;
        }
      } else {
        this._stuckTime = 0;
      }
      this._lastStuckX = this.x;
      this._lastStuckY = this.y;
    } else {
      // No PathGrid available -- direct movement fallback
      const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
      this.setVelocity(
        Math.cos(angle) * this.moveSpeed * speedMult,
        Math.sin(angle) * this.moveSpeed * speedMult,
      );
    }

    this.playWalkAnim();
  }

  private updateSpitter(delta: number): void {
    if (!this.target) return;

    this.spitterTimer = Math.max(0, this.spitterTimer - delta);

    const dist = Phaser.Math.Distance.Between(
      this.x, this.y, this.target.x, this.target.y
    );

    if (dist > this.spitterRange) {
      // Move closer
      const angle = Phaser.Math.Angle.Between(
        this.x, this.y, this.target.x, this.target.y
      );
      this.setVelocity(
        Math.cos(angle) * this.moveSpeed,
        Math.sin(angle) * this.moveSpeed
      );
    } else if (dist < this.spitterRange * 0.6) {
      // Too close, back away
      const angle = Phaser.Math.Angle.Between(
        this.target.x, this.target.y, this.x, this.y
      );
      this.setVelocity(
        Math.cos(angle) * this.moveSpeed * 0.5,
        Math.sin(angle) * this.moveSpeed * 0.5
      );
    } else {
      // In range, stop and shoot
      this.setVelocity(0, 0);
    }

    // Fire projectile
    if (dist <= this.spitterRange && this.spitterTimer <= 0) {
      this.spitterTimer = this.spitterCooldown;
      AudioManager.play('zombie_spit');
      this.scene.events.emit('spitter-shoot', this, this.target);
    }
  }

  /**
   * Forest Boss (Brute Alpha) state machine:
   * Phase 1: Charges toward the base, taking 50% less damage from the front.
   *          Spawns 3 walkers each time a charge lands (via event).
   * Phase 2 (<=50% HP): Also throws rocks at the player (ranged attack via event).
   */
  private updateForestBoss(delta: number): void {
    if (!this.target || !this.basePosition) return;

    this.updateBossPulse(delta);

    // Periodic stomp sounds
    this.stompTimer -= delta;
    if (this.stompTimer <= 0) {
      const vel = this.body ? Math.abs(this.body.velocity.x) + Math.abs(this.body.velocity.y) : 0;
      if (vel > 5) AudioManager.play('boss_stomp');
      this.stompTimer = 700;
    }

    // Check phase transition
    if (this.forestBossPhase === 1 && this.hp / this.maxHp <= this.forestBossPhase2Threshold) {
      this.forestBossPhase = 2;
      // Announce phase 2 transition visually
      this.scene.events.emit('forest-boss-phase2', this);
    }

    // Phase 2: rock throw timer
    if (this.forestBossPhase === 2) {
      this.forestBossRockTimer = Math.max(0, this.forestBossRockTimer - delta);
      const distToTarget = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
      if (this.forestBossRockTimer <= 0 && distToTarget <= this.forestBossRockRange) {
        this.forestBossRockTimer = this.forestBossRockCooldown;
        // Emit rock throw event -- NightScene handles projectile creation
        this.scene.events.emit('forest-boss-rock-throw', this, this.target);
      }
    }

    // Charge logic
    if (this.forestBossCharging) {
      // Continue charging in the locked direction
      this.forestBossChargeTimer -= delta;
      if (this.forestBossChargeTimer <= 0) {
        // Charge ended -- emit spawn walkers event
        this.forestBossCharging = false;
        this.forestBossChargeCooldown = this.forestBossChargeCooldownMax;
        this.scene.events.emit('forest-boss-charge-end', this);
      }
      // Keep velocity unchanged during charge (set at charge start)
    } else {
      // Count down to next charge
      this.forestBossChargeCooldown -= delta;
      if (this.forestBossChargeCooldown <= 0) {
        // Start a new charge toward the base
        this.forestBossCharging = true;
        this.forestBossChargeTimer = this.forestBossChargeDuration > 0
          ? this.forestBossChargeDuration
          : 600;
        const angle = Phaser.Math.Angle.Between(this.x, this.y, this.basePosition.x, this.basePosition.y);
        this.setVelocity(
          Math.cos(angle) * this.forestBossChargeSpeed,
          Math.sin(angle) * this.forestBossChargeSpeed
        );
        AudioManager.play('boss_charge');
        this.scene.events.emit('forest-boss-charge-start', this);
      } else {
        // Normal movement between charges (slow walk toward base)
        const speedMult = this.crippleTimer > 0 ? 0.5 : 1.0;
        const angle = Phaser.Math.Angle.Between(this.x, this.y, this.basePosition.x, this.basePosition.y);
        const distToBase = Phaser.Math.Distance.Between(this.x, this.y, this.basePosition.x, this.basePosition.y);
        if (distToBase < 48) {
          this.setVelocity(0, 0);
        } else {
          this.setVelocity(
            Math.cos(angle) * this.moveSpeed * speedMult,
            Math.sin(angle) * this.moveSpeed * speedMult
          );
        }
      }
    }
    this.playWalkAnim();
  }

  /**
   * City Boss (Spitter Queen) state machine:
   * - Behaves like a large spitter with extended range.
   * - Spawns 2 spitters every 10s (via event).
   * - Leaves acid pools on the ground after each ranged attack (via event).
   * - At 25% HP: desperate scream that pulls ALL zombies toward the queen.
   */
  private updateCityBoss(delta: number): void {
    if (!this.target) return;

    this.updateBossPulse(delta);

    this.stompTimer -= delta;
    if (this.stompTimer <= 0) {
      const vel = this.body ? Math.abs(this.body.velocity.x) + Math.abs(this.body.velocity.y) : 0;
      if (vel > 5) AudioManager.play('boss_stomp');
      this.stompTimer = 900;
    }

    // Desperate scream at 25% HP (fires once)
    if (!this.cityBossDesperateDone && this.hp / this.maxHp <= this.cityBossPhase4Threshold) {
      this.cityBossDesperateDone = true;
      this.scene.events.emit('city-boss-desperate-scream', this, this.screamRadius);
    }

    // Minion spawn timer
    this.cityBossMinionTimer = Math.max(0, this.cityBossMinionTimer - delta);
    if (this.cityBossMinionTimer <= 0) {
      this.cityBossMinionTimer = this.cityBossMinionInterval;
      this.scene.events.emit('city-boss-spawn-minions', this, this.cityBossMinionType, this.cityBossMinionCount);
    }

    // Ranged attack (reuse spitter logic) + acid pool on shot
    this.spitterTimer = Math.max(0, this.spitterTimer - delta);
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);

    if (dist > this.spitterRange) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
      const speedMult = this.crippleTimer > 0 ? 0.5 : 1.0;
      this.setVelocity(
        Math.cos(angle) * this.moveSpeed * speedMult,
        Math.sin(angle) * this.moveSpeed * speedMult
      );
    } else if (dist < this.spitterRange * 0.5) {
      // Back away from player when too close
      const angle = Phaser.Math.Angle.Between(this.target.x, this.target.y, this.x, this.y);
      this.setVelocity(
        Math.cos(angle) * this.moveSpeed * 0.4,
        Math.sin(angle) * this.moveSpeed * 0.4
      );
    } else {
      this.setVelocity(0, 0);
    }

    if (dist <= this.spitterRange && this.spitterTimer <= 0) {
      this.spitterTimer = this.spitterCooldown;
      AudioManager.play('zombie_spit');
      AudioManager.play('boss_acid');
      // Fire ranged projectile
      this.scene.events.emit('spitter-shoot', this, this.target);
      // Leave acid pool at current position
      this.scene.events.emit('city-boss-acid-pool', this.x, this.y, this.cityBossAcidDuration, this.cityBossAcidDps);
    }

    this.playWalkAnim();
  }

  /**
   * Military Tank state machine:
   * - Extremely slow but unstoppable.
   * - Armor plates: takes only 25% damage normally (armorDamageReduction = 0.75).
   * - Weak spot: rear side takes 3x damage (handled in takeDamage via weakSpotMultiplier).
   * - Crushes ALL structures it moves through (event emitted each pathfind tick).
   */
  private updateMilitaryTank(delta: number): void {
    if (!this.target || !this.basePosition) return;

    this.updateBossPulse(delta);

    this.stompTimer -= delta;
    if (this.stompTimer <= 0) {
      const vel = this.body ? Math.abs(this.body.velocity.x) + Math.abs(this.body.velocity.y) : 0;
      if (vel > 5) AudioManager.play('boss_tank_stomp');
      this.stompTimer = 500; // More frequent stomps (slow but heavy)
    }

    // Throttle movement updates like standard pathfinding
    this.pathfindTimer -= delta;
    if (this.pathfindTimer > 0) return;
    this.pathfindTimer = this.offScreen
      ? Zombie.PATHFIND_INTERVAL_OFFSCREEN
      : Zombie.PATHFIND_INTERVAL_ONSCREEN;

    const speedMult = this.crippleTimer > 0 ? 0.5 : 1.0;

    // Determine movement target
    let targetX = this.basePosition.x;
    let targetY = this.basePosition.y;
    if (this.soundTarget && this.soundTargetTimer > 0) {
      this.soundTargetTimer -= delta;
      targetX = this.soundTarget.x;
      targetY = this.soundTarget.y;
    }

    const distToBase = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
    if (distToBase < 48) {
      this.setVelocity(0, 0);
      return;
    }

    // The tank ignores PathGrid and always moves in a straight line (crushes everything)
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    this.setVelocity(
      Math.cos(angle) * this.moveSpeed * speedMult,
      Math.sin(angle) * this.moveSpeed * speedMult
    );

    // Emit crush event so NightScene can destroy structures in its path
    this.scene.events.emit('tank-crushing', this);

    this.playWalkAnim();
  }

  takeDamage(amount: number): void {
    // Apply armor damage reduction for military_heavy and military_tank
    // Reduction is applied for all hits (directional logic would need physics raycasting;
    // weak spot for tank is handled by the caller passing a multiplied amount via
    // the 'tank-weakspot-check' helper exposed below).
    let finalAmount = amount;
    if (this.armorDamageReduction > 0) {
      finalAmount = Math.max(1, Math.round(amount * (1 - this.armorDamageReduction)));
    }

    this.hp -= finalAmount;

    // Pain aggro: when hit, turn toward the attacker (player)
    if (this.target) {
      this.onSoundHeard(this.target.x, this.target.y);
    }

    // Screamer: scream on damage to attract nearby zombies
    if (this.behavior === 'screamer' && this.screamTimer <= 0) {
      this.screamTimer = this.screamCooldown;
      AudioManager.play('zombie_scream');
      this.scene.events.emit('screamer-scream', this, this.screamRadius);
    }

    // Forest boss: 50% less damage from the front (while not charging, attacker is likely in front)
    // The charge state means the boss is rushing forward -- full damage allowed.
    if (this.behavior === 'forest_boss' && !this.forestBossCharging) {
      // Already reduced above via armorDamageReduction if set in JSON.
      // If not set, apply a 50% front reduction by reversing the finalAmount change.
      // Since forest_boss has no armorDamageReduction in JSON, we apply it here:
      if (this.armorDamageReduction === 0) {
        // Half damage while standing/walking (facing attacker)
        this.hp += Math.round(finalAmount * 0.5); // give back half
      }
    }

    // Flash white
    this.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.active) {
        this.restoreTint();
      }
    });

    if (this.hp <= 0) {
      this.die();
    }
  }

  /**
   * Check if a given world position hits the tank's weak spot (rear side).
   * Returns the damage multiplier to apply (1.0 normal, weakSpotMultiplier for rear).
   * "Rear" is defined as the attacker being behind the tank's movement direction.
   */
  getTankDamageMultiplier(attackerX: number, attackerY: number): number {
    if (this.behavior !== 'military_tank') return 1.0;
    if (!this.body) return 1.0;

    const velX = this.body.velocity.x;
    const velY = this.body.velocity.y;
    const speed = Math.sqrt(velX * velX + velY * velY);
    if (speed < 1) return 1.0; // Not moving -- no weak spot

    // Dot product: attacker relative to zombie vs movement direction
    const relX = attackerX - this.x;
    const relY = attackerY - this.y;
    const dot = (relX * velX + relY * velY) / speed;

    // dot < 0 means attacker is BEHIND the tank (negative = flanking rear)
    if (dot < 0) {
      return this.weakSpotMultiplier;
    }
    return 1.0;
  }

  private restoreTint(): void {
    if (this.baseTint != null) {
      this.setTint(this.baseTint);
    } else {
      this.clearTint();
    }
  }

  canAttack(): boolean {
    return this.attackCooldown <= 0;
  }

  canAttackStructure(): boolean {
    const canBreakStructures =
      this.behavior === 'brute' ||
      this.behavior === 'boss' ||
      this.behavior === 'forest_boss' ||
      this.behavior === 'military_heavy' ||
      this.behavior === 'military_tank';
    return canBreakStructures && this.structureAttackCooldown <= 0 && this.structureDamage > 0;
  }

  resetAttackCooldown(): void {
    this.attackCooldown = enemiesData.attackCooldown;
  }

  resetStructureAttackCooldown(): void {
    this.structureAttackCooldown = enemiesData.structureAttackCooldown;
  }

  /**
   * Apply cripple debuff: -50% speed for durationMs.
   * Refreshes timer if already crippled.
   */
  applyCripple(durationMs: number): void {
    this.crippleTimer = Math.max(this.crippleTimer, durationMs);
  }

  /**
   * Apply stun debuff: full stop for durationMs.
   * Refreshes timer if already stunned.
   */
  applyStun(durationMs: number): void {
    this.stunTimer = Math.max(this.stunTimer, durationMs);
  }

  /** Returns true if zombie is currently fully stunned */
  isStunned(): boolean {
    return this.stunTimer > 0;
  }

  /** Quick red pulse + scale bump when attacking; plays attack anim if available */
  playAttackPulse(): void {
    if (this.attackAnimKey) {
      this.play(this.attackAnimKey);
      this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (this.active) this.playWalkAnim();
      });
    }
    this.setTint(0xFF0000);
    this.scene.time.delayedCall(120, () => {
      if (this.active) {
        this.restoreTint();
      }
    });

    // Brief scale pulse so the attack is visible on the zombie side
    const origScale = this.scaleX;
    this.setScale(origScale * 1.2);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.setScale(origScale);
    });
  }

  private updateBossPulse(delta: number): void {
    this.pulseTimer += delta;
    // Pulse between red (0xFF2222) and dark red (0x881111)
    const t = (Math.sin(this.pulseTimer / 500) + 1) / 2;
    const r = Math.round(0x88 + (0xFF - 0x88) * t);
    const g = Math.round(0x11 + (0x22 - 0x11) * t);
    const b = Math.round(0x11 + (0x22 - 0x11) * t);
    this.setTint((r << 16) | (g << 8) | b);
  }

  private updateScreamerPulse(delta: number): void {
    this.pulseTimer += delta;
    this.screamTimer = Math.max(0, this.screamTimer - delta);
    // Pulse alpha between 0.6 and 1.0
    const t = (Math.sin(this.pulseTimer / 400) + 1) / 2;
    this.setAlpha(0.6 + 0.4 * t);
  }

  private die(): void {
    if (this.deathStarted) return;
    this.deathStarted = true;

    // Bosses: emit spawn event before dying so NightScene can spawn minions/walkers
    if (
      (this.behavior === 'boss' || this.behavior === 'forest_boss') &&
      this.spawnOnDeath
    ) {
      this.scene.events.emit('boss-death-spawn', this);
    }

    // City boss death: one final desperate scream if not done yet
    if (this.behavior === 'city_boss' && !this.cityBossDesperateDone) {
      this.scene.events.emit('city-boss-desperate-scream', this, this.screamRadius);
    }

    // Emit killed event -- NightScene handles blood splatters and loot
    this.scene.events.emit('zombie-killed', this);

    // Disable physics immediately so zombie stops blocking/moving
    if (this.body) {
      this.body.enable = false;
    }
    this.setVelocity(0, 0);

    // Brief white flash then remove -- no corpse, no tweens
    this.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => {
      this.setActive(false);
      this.setVisible(false);
    });
  }

  reset(x: number, y: number, config: ZombieConfig): void {
    this.scene.tweens.killTweensOf(this);
    this.deathStarted = false;
    this.setVelocity(0, 0);
    this.setAngle(0);
    this.setAlpha(1);
    this.clearTint();
    this.setPosition(x, y);
    this.zombieId = config.id;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.moveSpeed = config.speed;
    this.damage = config.damage;
    this.awarenessRadius = config.awarenessRadius;
    this.behavior = config.behavior;
    this.structureDamage = config.structureDamage;
    this.setTexture(config.spriteKey);
    this.setActive(true);
    this.setVisible(true);
    this.setAlpha(1);
    this.setAngle(0);
    this.attackCooldown = 0;
    this.structureAttackCooldown = 0;
    this.soundTarget = null;
    this.soundTargetTimer = 0;
    this.pathfindTimer = 0;
    this.offScreen = false;
    this.dotDamageAccum = 0;
    this.lastTrapHitTime = 0;
    this.lastTrapType = '';
    this.spitterTimer = 0;
    this.screamTimer = 0;
    this.pulseTimer = 0;
    this.stompTimer = 0;
    this.aggroType = 'base_seeker';
    this.flankTarget = null;
    this.crippleTimer = 0;
    this.stunTimer = 0;

    // Spitter config
    this.spitterRange = config.range ?? 250;
    this.spitterCooldown = config.projectileCooldown ?? 3000;

    // Screamer config
    this.screamRadius = config.screamRadius ?? 500;
    this.screamCooldown = config.screamCooldown ?? 5000;

    // Boss config
    this.spawnOnDeath = config.spawnOnDeath ?? null;
    this.spawnCount = config.spawnCount ?? 0;
    this.baseTint = config.tint;

    // Zone-variant config
    this.ignoresLowWalls = config.ignoresLowWalls ?? false;
    this.armorDamageReduction = config.armorDamageReduction ?? 0;
    this.weakSpotMultiplier = config.weakSpotMultiplier ?? 1.0;
    this.crushStructuresOnPath = config.crushStructuresOnPath ?? false;

    // Forest boss config
    this.forestBossPhase = 1;
    this.forestBossCharging = false;
    this.forestBossChargeTimer = 0;
    this.forestBossChargeCooldown = config.chargeCooldown ?? 4000;
    this.forestBossChargeCooldownMax = config.chargeCooldown ?? 4000;
    this.forestBossChargeDuration = config.chargeDuration ?? 600;
    this.forestBossChargeSpeed = config.chargeSpeed ?? 200;
    this.forestBossRockTimer = 0;
    this.forestBossRockCooldown = config.rockThrowCooldown ?? 3000;
    this.forestBossRockRange = config.rockThrowRange ?? 300;
    this.forestBossPhase2Threshold = config.phase2HpThreshold ?? 0.5;

    // City boss config
    this.cityBossMinionTimer = 0;
    this.cityBossMinionInterval = config.minionSpawnInterval ?? 10000;
    this.cityBossMinionType = config.minionType ?? 'spitter';
    this.cityBossMinionCount = config.minionCount ?? 2;
    this.cityBossAcidDuration = config.acidPoolDuration ?? 5000;
    this.cityBossAcidDps = config.acidPoolDamagePerSec ?? 15;
    this.cityBossPhase4Threshold = config.phase4HpThreshold ?? 0.25;
    this.cityBossDesperateDone = false;

    // Apply visuals
    this.setScale(config.scale);
    if (config.tint != null) {
      this.setTint(config.tint);
    } else {
      this.clearTint();
    }
    if (this.body) {
      this.body.enable = true;
    }

    this.resolveAnimKeys(config);
  }
}
