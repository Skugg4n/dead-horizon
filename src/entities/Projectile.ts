import Phaser from 'phaser';

const PROJECTILE_SPEED = 400;
const PROJECTILE_LIFESPAN = 2000; // ms

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  damage: number = 0;
  private lifeTimer: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'bullet');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(8);
    this.setActive(false);
    this.setVisible(false);
  }

  fire(x: number, y: number, angle: number, damage: number): void {
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.damage = damage;
    this.lifeTimer = PROJECTILE_LIFESPAN;

    this.setVelocity(
      Math.cos(angle) * PROJECTILE_SPEED,
      Math.sin(angle) * PROJECTILE_SPEED
    );

    if (this.body) {
      this.body.enable = true;
    }
  }

  update(_time: number, delta: number): void {
    if (!this.active) return;

    this.lifeTimer -= delta;
    if (this.lifeTimer <= 0) {
      this.deactivate();
    }
  }

  deactivate(): void {
    this.setActive(false);
    this.setVisible(false);
    this.setVelocity(0, 0);
    if (this.body) {
      this.body.enable = false;
    }
  }
}
