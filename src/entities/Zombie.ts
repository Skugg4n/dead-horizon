import Phaser from 'phaser';

export interface ZombieConfig {
  id: string;
  hp: number;
  speed: number;
  damage: number;
  awarenessRadius: number;
  spriteKey: string;
}

export class Zombie extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  maxHp: number;
  moveSpeed: number;
  damage: number;
  awarenessRadius: number;
  zombieId: string;
  private target: Phaser.GameObjects.Sprite | null = null;
  private attackCooldown: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, config: ZombieConfig) {
    super(scene, x, y, config.spriteKey);

    this.zombieId = config.id;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.moveSpeed = config.speed;
    this.damage = config.damage;
    this.awarenessRadius = config.awarenessRadius;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(5);
  }

  setTarget(target: Phaser.GameObjects.Sprite): void {
    this.target = target;
  }

  update(delta: number): void {
    if (!this.target || !this.active) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);

    // Move toward target
    const angle = Phaser.Math.Angle.Between(
      this.x, this.y,
      this.target.x, this.target.y
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
      if (this.active) this.clearTint();
    });

    if (this.hp <= 0) {
      this.die();
    }
  }

  canAttack(): boolean {
    return this.attackCooldown <= 0;
  }

  resetAttackCooldown(): void {
    this.attackCooldown = 1000; // 1 second between attacks
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
    this.setTexture(config.spriteKey);
    this.setActive(true);
    this.setVisible(true);
    this.clearTint();
    this.attackCooldown = 0;
    if (this.body) {
      this.body.enable = true;
    }
  }
}
