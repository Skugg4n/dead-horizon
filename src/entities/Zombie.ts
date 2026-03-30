import Phaser from 'phaser';
import enemiesData from '../data/enemies.json';

export type ZombieBehavior = 'walker' | 'runner' | 'brute' | 'spitter' | 'screamer' | 'boss';

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
  private static readonly PATHFIND_INTERVAL_OFFSCREEN = 500;
  private static readonly PATHFIND_INTERVAL_ONSCREEN = 150;
  offScreen: boolean = false;

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

  // F5: Aggro behavior -- determined at spawn time
  // 'base_seeker': moves toward base (70% of zombies)
  // 'wanderer': roams randomly near map edges (30% of zombies)
  aggroType: 'base_seeker' | 'wanderer' = 'base_seeker';
  // Wanderer's current destination point
  private wanderTarget: { x: number; y: number } | null = null;
  private mapWidth: number = 1280;
  private mapHeight: number = 960;

  // Death state flag to prevent double tweens
  private deathStarted = false;
  // Safety timeout reference so animation complete can cancel it
  private deathSafetyTimer: Phaser.Time.TimerEvent | null = null;

  // Pulsing tint for boss/screamer
  private pulseTimer: number = 0;
  private baseTint: number | null = null;

  // Animation keys resolved per zombie type
  private walkAnimKey: string | null = null;
  private deathAnimKey: string | null = null;
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

    this.baseTint = config.tint;

    scene.add.existing(this);
    scene.physics.add.existing(this);

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

  /** Resolve which animation keys are available for this zombie type */
  private resolveAnimKeys(config: ZombieConfig): void {
    // Map behavior to animation prefix (boss uses walker anims)
    const prefix = config.behavior === 'boss' ? 'walker' : config.behavior;
    const walk = `${prefix}-walk`;
    const death = `${prefix}-death`;

    this.walkAnimKey = this.scene.anims.exists(walk) ? walk : null;
    this.deathAnimKey = this.scene.anims.exists(death) ? death : null;

    // Special attack anims
    if (config.behavior === 'spitter') {
      this.attackAnimKey = this.scene.anims.exists('spitter-attack') ? 'spitter-attack' : null;
    } else if (config.behavior === 'screamer') {
      this.attackAnimKey = this.scene.anims.exists('screamer-scream') ? 'screamer-scream' : null;
    } else if (config.behavior === 'walker' || config.behavior === 'boss') {
      this.attackAnimKey = this.scene.anims.exists('walker-attack') ? 'walker-attack' : null;
    } else {
      this.attackAnimKey = null;
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

  /** Set map dimensions for wanderer roaming calculations */
  setMapSize(width: number, height: number): void {
    this.mapWidth = width;
    this.mapHeight = height;
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

  update(delta: number): void {
    if (!this.target || !this.active) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.structureAttackCooldown = Math.max(0, this.structureAttackCooldown - delta);

    // Boss pulsing glow
    if (this.behavior === 'boss') {
      this.updateBossPulse(delta);
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
    } else if (this.aggroType === 'wanderer') {
      // Wanderer: pick a random destination near edges, move there, repeat
      const dest = this.getWanderDestination();
      targetX = dest.x;
      targetY = dest.y;
    } else if (this.basePosition) {
      targetX = this.basePosition.x;
      targetY = this.basePosition.y;
    } else {
      targetX = this.target.x;
      targetY = this.target.y;
    }

    // Move toward target
    const angle = Phaser.Math.Angle.Between(
      this.x, this.y,
      targetX, targetY
    );

    this.setVelocity(
      Math.cos(angle) * this.moveSpeed,
      Math.sin(angle) * this.moveSpeed
    );

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
      this.scene.events.emit('spitter-shoot', this, this.target);
    }
  }

  takeDamage(amount: number): void {
    this.hp -= amount;

    // Screamer: scream on damage to attract nearby zombies
    if (this.behavior === 'screamer' && this.screamTimer <= 0) {
      this.screamTimer = this.screamCooldown;
      this.scene.events.emit('screamer-scream', this, this.screamRadius);
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
    return (this.behavior === 'brute' || this.behavior === 'boss') && this.structureAttackCooldown <= 0 && this.structureDamage > 0;
  }

  resetAttackCooldown(): void {
    this.attackCooldown = enemiesData.attackCooldown;
  }

  resetStructureAttackCooldown(): void {
    this.structureAttackCooldown = enemiesData.structureAttackCooldown;
  }

  /** Quick red pulse when attacking; plays attack anim if available */
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

  /**
   * Wanderer logic: pick a random destination near map edges.
   * When within 20px of current destination, pick a new one.
   * Keeps wanderers in the outer 20% of the map for edge-hugging feel.
   */
  private getWanderDestination(): { x: number; y: number } {
    if (!this.wanderTarget) {
      this.wanderTarget = this.pickWanderPoint();
    }

    const dist = Phaser.Math.Distance.Between(
      this.x, this.y,
      this.wanderTarget.x, this.wanderTarget.y
    );
    // Pick a new destination when close enough
    if (dist < 20) {
      this.wanderTarget = this.pickWanderPoint();
    }

    return this.wanderTarget;
  }

  /** Pick a random point in the outer 25% band of the map */
  private pickWanderPoint(): { x: number; y: number } {
    const margin = 80; // keep away from absolute edge
    const bandW = this.mapWidth * 0.25;
    const bandH = this.mapHeight * 0.25;

    // Choose one of four edge bands randomly
    const side = Math.floor(Math.random() * 4);
    let wx: number;
    let wy: number;
    switch (side) {
      case 0: // left band
        wx = margin + Math.random() * bandW;
        wy = margin + Math.random() * (this.mapHeight - margin * 2);
        break;
      case 1: // right band
        wx = this.mapWidth - margin - Math.random() * bandW;
        wy = margin + Math.random() * (this.mapHeight - margin * 2);
        break;
      case 2: // top band
        wx = margin + Math.random() * (this.mapWidth - margin * 2);
        wy = margin + Math.random() * bandH;
        break;
      default: // bottom band
        wx = margin + Math.random() * (this.mapWidth - margin * 2);
        wy = this.mapHeight - margin - Math.random() * bandH;
        break;
    }
    return { x: wx, y: wy };
  }

  private die(): void {
    this.deathStarted = true;

    // Boss: emit spawn event before dying
    if (this.behavior === 'boss' && this.spawnOnDeath) {
      this.scene.events.emit('boss-death-spawn', this);
    }

    // Emit killed event -- NightScene handles blood splatters and loot
    this.scene.events.emit('zombie-killed', this);

    // Disable physics immediately so zombie stops blocking/moving
    if (this.body) {
      this.body.enable = false;
    }

    // F1: Death animation sequence
    // Phase 1: flash white + slight scale-down (impact feel)
    // Phase 2: tilt and become a "corpse" that fades over 10-15 seconds
    const deathAngle = Phaser.Math.Between(-45, 45);
    const originalScaleX = this.scaleX;
    const originalScaleY = this.scaleY;

    if (this.deathAnimKey) {
      // Play sprite-sheet death animation, then leave as faded corpse
      this.play(this.deathAnimKey);
      this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (!this.scene) return;
        // Cancel safety timeout since animation completed normally
        if (this.deathSafetyTimer) {
          this.deathSafetyTimer.destroy();
          this.deathSafetyTimer = null;
        }
        // Leave as darkened corpse on the ground
        this.setAngle(deathAngle);
        this.setTint(0x441111);
        this.setDepth(1); // below all living entities
        const corpseDelay = 10000 + Math.random() * 5000;
        this.scene.tweens.add({
          targets: this,
          alpha: 0,
          duration: 2000,
          delay: corpseDelay,
          ease: 'Power2',
          onComplete: () => {
            this.setActive(false);
            this.setVisible(false);
          },
        });
      });
      // Safety: force corpse after 1s if animation never completes
      this.deathSafetyTimer = this.scene.time.delayedCall(1000, () => {
        if (!this.deathStarted || !this.scene) return;
        this.deathSafetyTimer = null;
        this.setAngle(deathAngle);
        this.setTint(0x441111);
        this.setDepth(1);
        const corpseDelay = 10000 + Math.random() * 5000;
        this.scene.tweens.add({
          targets: this,
          alpha: 0,
          duration: 2000,
          delay: corpseDelay,
          ease: 'Power2',
          onComplete: () => {
            this.setActive(false);
            this.setVisible(false);
          },
        });
      });
    } else {
      // Tween-based death: flash white, shrink slightly, then fall over as a corpse
      this.scene.tweens.add({
        targets: this,
        scaleX: originalScaleX * 0.85,
        scaleY: originalScaleY * 0.85,
        duration: 80,
        ease: 'Power3',
        onComplete: () => {
          if (!this.scene) return;
          // Tilt to a fallen position -- visual impact feel
          this.scene.tweens.add({
            targets: this,
            angle: deathAngle,
            scaleX: originalScaleX * 0.9,
            scaleY: originalScaleY * 0.9,
            duration: 150,
            ease: 'Power2',
            onComplete: () => {
              if (!this.scene) return;
              // Darken -- now it's a corpse
              this.setTint(0x441111);
              this.setDepth(1); // beneath living entities
              // Fade out after a random 10-15 seconds
              const corpseDelay = 10000 + Math.random() * 5000;
              this.scene.tweens.add({
                targets: this,
                alpha: 0,
                duration: 2000,
                delay: corpseDelay,
                ease: 'Power2',
                onComplete: () => {
                  this.setActive(false);
                  this.setVisible(false);
                },
              });
            },
          });
        },
      });
    }
  }

  reset(x: number, y: number, config: ZombieConfig): void {
    this.scene.tweens.killTweensOf(this);
    if (this.deathSafetyTimer) {
      this.deathSafetyTimer.destroy();
      this.deathSafetyTimer = null;
    }
    this.deathStarted = false;
    this.setVelocity(0, 0);
    this.setAngle(0);
    this.setAlpha(1);
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
    this.spitterTimer = 0;
    this.screamTimer = 0;
    this.pulseTimer = 0;
    // Reset wanderer state -- aggroType re-assigned by WaveManager after reset
    this.wanderTarget = null;
    this.aggroType = 'base_seeker';

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
