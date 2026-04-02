import Phaser from 'phaser';
import {
  PLAYER_SPEED,
  PLAYER_SPRINT_SPEED,
  PLAYER_MAX_HP,
  PLAYER_MAX_STAMINA,
  STAMINA_DRAIN_RATE,
  STAMINA_REGEN_RATE,
} from '../config/constants';
import { clamp } from '../utils/math';
import visualConfig from '../data/visual-config.json';

export class Player extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  kills: number = 0;

  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private wasd: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  } | undefined;
  private shiftKey: Phaser.Input.Keyboard.Key | undefined;
  // Animation state
  private hasWalkAnim: boolean = false;
  private hasAttackAnim: boolean = false;
  private hasDeathAnim: boolean = false;
  private bobTimer: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');

    this.hp = PLAYER_MAX_HP;
    this.maxHp = PLAYER_MAX_HP;
    this.stamina = PLAYER_MAX_STAMINA;
    this.maxStamina = PLAYER_MAX_STAMINA;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setDepth(10);

    // Check which animations are available
    this.hasWalkAnim = scene.anims.exists('player-walk');
    this.hasAttackAnim = scene.anims.exists('player-attack');
    this.hasDeathAnim = scene.anims.exists('player-death');

    // Input setup
    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.wasd = {
        W: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.shiftKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    }
  }

  update(delta: number): void {
    const dt = delta / 1000;
    const isSprinting = this.shiftKey?.isDown && this.stamina > 0;
    const speed = isSprinting ? PLAYER_SPRINT_SPEED : PLAYER_SPEED;

    // Movement
    let vx = 0;
    let vy = 0;

    const left = this.cursors?.left.isDown || this.wasd?.A.isDown;
    const right = this.cursors?.right.isDown || this.wasd?.D.isDown;
    const up = this.cursors?.up.isDown || this.wasd?.W.isDown;
    const down = this.cursors?.down.isDown || this.wasd?.S.isDown;

    if (left) vx = -1;
    else if (right) vx = 1;
    if (up) vy = -1;
    else if (down) vy = 1;

    // Normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
      const norm = Math.SQRT1_2;
      vx *= norm;
      vy *= norm;
    }

    this.setVelocity(vx * speed, vy * speed);

    // Walk animation (sprite sheet) or bobbing fallback
    const isMoving = vx !== 0 || vy !== 0;
    if (this.hasWalkAnim) {
      if (isMoving) {
        if (!this.anims.isPlaying || this.anims.currentAnim?.key !== 'player-walk') {
          this.play('player-walk');
        }
      } else {
        if (this.anims.isPlaying && this.anims.currentAnim?.key === 'player-walk') {
          this.stop();
          this.setTexture('player');
        }
      }
    } else {
      // Programmatic bobbing fallback
      if (isMoving) {
        this.bobTimer += dt * (isSprinting ? 14 : 10);
        const bobOffset = Math.sin(this.bobTimer) * 1.5;
        this.setOrigin(0.5, 0.5 - bobOffset / 32);
      } else {
        this.bobTimer = 0;
        this.setOrigin(0.5, 0.5);
      }
    }

    // Stamina
    if (isSprinting && (vx !== 0 || vy !== 0)) {
      this.stamina = clamp(this.stamina - STAMINA_DRAIN_RATE * dt, 0, this.maxStamina);
    } else {
      this.stamina = clamp(this.stamina + STAMINA_REGEN_RATE * dt, 0, this.maxStamina);
    }
  }

  /** Play attack animation if available. Called by shooting logic. */
  playAttackAnim(): void {
    if (!this.hasAttackAnim) return;
    this.play('player-attack');
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (!this.active) return;
      // Resume walk or idle
      if (this.body && (this.body.velocity.x !== 0 || this.body.velocity.y !== 0)) {
        if (this.hasWalkAnim) this.play('player-walk');
      } else {
        this.setTexture('player');
      }
    });
  }

  takeDamage(amount: number): void {
    this.hp -= amount;
    this.scene.events.emit('player-damaged', this.hp, this.maxHp);

    // Flash red
    const flashColor = parseInt(visualConfig.playerDamageFlash.color.replace('0x', ''), 16);
    this.setTint(flashColor);
    this.scene.time.delayedCall(visualConfig.playerDamageFlash.duration, () => {
      if (!this.active) return;
      this.clearTint();
    });

    if (this.hp <= 0) {
      this.hp = 0;
      if (this.hasDeathAnim) {
        this.play('player-death');
        this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          this.scene.events.emit('player-died', 'player_killed');
        });
      } else {
        this.scene.events.emit('player-died', 'player_killed');
      }
    }
  }
}
