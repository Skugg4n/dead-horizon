import Phaser from 'phaser';

export type ZombieBehavior = 'walker' | 'runner' | 'brute';

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

  // Called by SoundMechanic when a weapon fires within range
  onSoundHeard(sourceX: number, sourceY: number): void {
    this.soundTarget = { x: sourceX, y: sourceY };
    this.soundTargetTimer = Zombie.SOUND_TARGET_DURATION;
  }

  update(delta: number): void {
    if (!this.target || !this.active) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.structureAttackCooldown = Math.max(0, this.structureAttackCooldown - delta);

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

  takeDamage(amount: number): void {
    this.hp -= amount;

    // Flash white
    this.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.active) {
        // Restore behavior tint after flash
        this.restoreTint();
      }
    });

    if (this.hp <= 0) {
      this.die();
    }
  }

  private restoreTint(): void {
    if (this.behavior === 'runner') {
      this.setTint(0xFFFF00);
    } else if (this.behavior === 'brute') {
      this.setTint(0x444444);
    } else {
      this.clearTint();
    }
  }

  canAttack(): boolean {
    return this.attackCooldown <= 0;
  }

  canAttackStructure(): boolean {
    return this.behavior === 'brute' && this.structureAttackCooldown <= 0 && this.structureDamage > 0;
  }

  resetAttackCooldown(): void {
    this.attackCooldown = 1000; // 1 second between attacks
  }

  resetStructureAttackCooldown(): void {
    this.structureAttackCooldown = 1000; // 1 second between structure attacks
  }

  private die(): void {
    this.scene.events.emit('zombie-killed', this);
    this.setActive(false);
    this.setVisible(false);
    if (this.body) {
      this.body.enable = false;
    }
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
    this.attackCooldown = 0;
    this.structureAttackCooldown = 0;
    this.soundTarget = null;
    this.soundTargetTimer = 0;

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
