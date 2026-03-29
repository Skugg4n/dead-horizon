import Phaser from 'phaser';

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
  private attackCooldown: number = 0;
  private structureAttackCooldown: number = 0;

  // Sound attraction
  private soundTarget: { x: number; y: number } | null = null;
  private soundTargetTimer: number = 0;
  private static readonly SOUND_TARGET_DURATION = 5000;

  // Pathfinding throttle -- only recalculate velocity every 500ms for off-screen zombies
  private pathfindTimer: number = 0;
  private static readonly PATHFIND_INTERVAL = 500;
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

  // Pulsing tint for boss/screamer
  private pulseTimer: number = 0;
  private baseTint: number | null = null;

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

  setTarget(target: Phaser.GameObjects.Sprite): void {
    this.target = target;
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

    // Throttle pathfinding for off-screen zombies
    if (this.offScreen) {
      this.pathfindTimer -= delta;
      if (this.pathfindTimer > 0) return;
      this.pathfindTimer = Zombie.PATHFIND_INTERVAL;
    }

    // Determine movement target: sound source or player
    let targetX: number;
    let targetY: number;

    if (this.soundTarget && this.soundTargetTimer > 0) {
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
    this.attackCooldown = 1000; // 1 second between attacks
  }

  resetStructureAttackCooldown(): void {
    this.structureAttackCooldown = 1000; // 1 second between structure attacks
  }

  /** Quick red pulse when attacking */
  playAttackPulse(): void {
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

  private die(): void {
    // Boss: emit spawn event before dying
    if (this.behavior === 'boss' && this.spawnOnDeath) {
      this.scene.events.emit('boss-death-spawn', this);
    }

    this.scene.events.emit('zombie-killed', this);
    // Disable physics immediately
    if (this.body) {
      this.body.enable = false;
    }
    // Death animation: shrink + fade + slight rotation
    this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      angle: Phaser.Math.Between(-30, 30),
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.setActive(false);
        this.setVisible(false);
      },
    });
  }

  reset(x: number, y: number, config: ZombieConfig): void {
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
  }
}
