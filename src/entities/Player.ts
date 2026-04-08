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
import { AudioManager } from '../systems/AudioManager';
import type { ZoneId } from '../config/types';

export class Player extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  kills: number = 0;

  // Adrenaline buff multipliers (1 = no buff, reset after buff duration expires)
  speedBuff: number = 1;
  damageBuff: number = 1;

  // Armor: fraction of incoming damage absorbed (0 = none, 0.45 = 45% reduction)
  armorReduction: number = 0;
  // Speed penalty from equipped armor + shield (stacked, e.g. -0.10 + -0.05 = -0.15)
  armorSpeedPenalty: number = 0;

  // Shield: how many hits remain before cooldown triggers
  shieldBlocksLeft: number = 0;
  // Shield cooldown remaining in ms (0 = shield is ready)
  shieldCooldown: number = 0;
  // Shield cooldown total ms (set when shield activates)
  private _shieldCooldownMax: number = 0;

  // Current zone -- set by NightScene after player creation, used for zone-specific footsteps
  zone: ZoneId = 'forest';

  // Footstep timer: accumulates movement time to trigger footstep sounds at correct cadence
  private footstepTimer: number = 0;

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
  // hasAttackAnim removed -- using tint flash instead
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
    // hasAttackAnim check removed -- using tint flash for attacks
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

    // Tick shield cooldown (recovers one block charge when cooldown expires)
    if (this.shieldCooldown > 0) {
      this.shieldCooldown -= delta;
      if (this.shieldCooldown <= 0) {
        this.shieldCooldown = 0;
        // Restore one block charge (up to the configured max -- tracked via _shieldCooldownMax)
        this.shieldBlocksLeft = Math.max(this.shieldBlocksLeft, 1);
      }
    }

    const isSprinting = this.shiftKey?.isDown && this.stamina > 0;
    // Apply adrenaline speed buff AND armor/shield speed penalty.
    // armorSpeedPenalty is negative (e.g. -0.15), so (1 + penalty) < 1.
    const speedMultiplier = this.speedBuff * (1 + this.armorSpeedPenalty);
    const speed = (isSprinting ? PLAYER_SPRINT_SPEED : PLAYER_SPEED) * speedMultiplier;

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
          // Use first frame of walk sheet so idle matches walk appearance
          this.setTexture('player_walk', 0);
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

    // Zone-aware footstep sounds.
    // Interval: ~350ms walking, ~220ms sprinting (matches visual bob cadence).
    if (isMoving) {
      const footstepInterval = isSprinting ? 220 : 350;
      this.footstepTimer += delta;
      if (this.footstepTimer >= footstepInterval) {
        this.footstepTimer = 0;
        // Pick footstep variant based on current zone surface
        if (this.zone === 'city') {
          AudioManager.play('footstep_concrete');
        } else if (this.zone === 'military') {
          AudioManager.play('footstep_metal');
        } else {
          // forest, endless, and default: grass
          AudioManager.play('footstep_grass');
        }
      }
    } else {
      this.footstepTimer = 0;
    }
  }

  /** Play attack animation if available. Called by shooting logic. */
  playAttackAnim(): void {
    // Quick white flash instead of animation swap (prevents glitchy texture switch)
    this.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.active) this.clearTint();
    });
  }

  /**
   * Configure shield parameters. Called by NightScene after equipping a shield.
   * @param blockHits    Max hits before cooldown triggers.
   * @param cooldownMs   Cooldown duration in ms.
   */
  equip(armorReduction: number, armorSpeedPenalty: number, shieldBlockHits: number, shieldCooldownMs: number): void {
    this.armorReduction = armorReduction;
    // Stack armor + shield speed penalties
    this.armorSpeedPenalty = armorSpeedPenalty;
    this.shieldBlocksLeft = shieldBlockHits;
    this._shieldCooldownMax = shieldCooldownMs;
    this.shieldCooldown = 0;
  }

  takeDamage(amount: number): void {
    // Apply armor reduction first -- clamp so damage never goes negative
    let finalAmount = amount * (1 - this.armorReduction);
    finalAmount = Math.max(0, finalAmount);

    // Shield block: if a block charge is available, absorb this hit entirely
    if (this.shieldBlocksLeft > 0 && this.shieldCooldown <= 0) {
      this.shieldBlocksLeft--;
      // Trigger cooldown when charges run out
      if (this.shieldBlocksLeft <= 0) {
        this.shieldCooldown = this._shieldCooldownMax;
      }
      // Brief blue flash to signal the block
      this.setTint(0x4488FF);
      this.scene.time.delayedCall(120, () => {
        if (!this.active) return;
        this.clearTint();
      });
      // Block absorbed -- skip damage
      return;
    }

    this.hp -= finalAmount;
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
