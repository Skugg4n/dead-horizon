import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';

/**
 * TrapBase -- abstract base class for all mechanical traps.
 *
 * Handles:
 *  - Cooldown: time between activations (cooldownMs)
 *  - Overheat: continuous operation limit that forces a recovery pause
 *  - Malfunction: per-night chance of failure (rolled at night start by NightScene)
 *  - Fuel: food cost per night (deducted at night start by NightScene)
 *  - Status visuals: green pulse (active), grey (cooldown), orange glow (overheat),
 *    red blink (malfunction)
 *
 * Subclasses must implement:
 *  - draw(): render the trap graphics
 *  - onZombieContact(zombie): apply the trap effect (damage, stun, etc.)
 */
export abstract class TrapBase extends Phaser.GameObjects.Graphics {
  public structureInstance: StructureInstance;

  // --- HP ---
  public hp: number;
  public maxHp: number;

  // --- Cooldown ---
  /** Minimum time (ms) between activations. 0 = always active. */
  public cooldownMs: number;
  /** Remaining cooldown time (ms). 0 = ready to activate. */
  public cooldownTimer: number = 0;

  // --- Overheat ---
  /** Maximum continuous operation (ms) before overheat. 0 = no overheat. */
  public overheatMax: number;
  /** Accumulated active time since last cool-down (ms). */
  public overheatCurrent: number = 0;
  /** Whether the trap is currently overheated (cannot activate). */
  public overheated: boolean = false;
  /** Cool-down duration (ms) when overheat is reached. */
  public recoveryMs: number;
  /** Remaining recovery time (ms) when overheated. */
  private recoveryTimer: number = 0;

  // --- Malfunction ---
  /** Probability (0-1) of malfunctioning at the start of each night. */
  public malfunctionChance: number;
  /** Whether this trap is currently broken (must be repaired by player). */
  public malfunctioned: boolean = false;

  // --- Uses ---
  /** Remaining uses. -1 = unlimited. */
  public uses: number;

  // --- Fuel ---
  /** Food cost per night. 0 = no fuel required. */
  public fuelPerNight: number;

  // --- Repair state (E-key interaction) ---
  /** True while the player is repairing this trap. */
  public isBeingRepaired: boolean = false;
  /** Accumulated repair progress (ms). Repair completes at 2000ms. */
  public repairProgress: number = 0;

  // --- Visual status overlays ---
  /** Status label shown above the trap ("CD", "HOT!", "!!"). */
  private statusText!: Phaser.GameObjects.Text;
  /** Timer for blinking animation when malfunctioned. */
  private blinkTimer: number = 0;
  /** Tracks whether the blink is currently visible. */
  private blinkVisible: boolean = true;

  constructor(
    scene: Phaser.Scene,
    instance: StructureInstance,
    maxHp: number,
    cooldownMs: number,
    overheatMax: number,
    recoveryMs: number,
    malfunctionChance: number,
    uses: number,
    fuelPerNight: number,
  ) {
    // super() must be root-level -- validate scene before calling it.
    // If scene.sys is missing at this point, Phaser.GameObjects.Graphics will throw.
    // We rely on NightScene.createStructures() to wrap each constructor in try/catch.
    super(scene);

    // Guard: instance x/y must be valid numbers (NaN or undefined would corrupt setPosition).
    const safeX = Number.isFinite(instance.x) ? instance.x : 0;
    const safeY = Number.isFinite(instance.y) ? instance.y : 0;
    if (safeX !== instance.x || safeY !== instance.y) {
      console.warn('[TrapBase] instance has invalid x/y. structureId:', instance.structureId, 'x:', instance.x, 'y:', instance.y, '-- clamping to 0,0');
      instance = { ...instance, x: safeX, y: safeY };
    }

    this.structureInstance = instance;
    this.hp = maxHp;
    this.maxHp = maxHp;
    this.cooldownMs = cooldownMs;
    this.overheatMax = overheatMax;
    this.recoveryMs = recoveryMs;
    this.malfunctionChance = malfunctionChance;
    this.uses = uses;
    this.fuelPerNight = fuelPerNight;

    this.setPosition(instance.x, instance.y);

    // Status text: positioned above the trap tile, world-space
    this.statusText = scene.add.text(
      instance.x + TILE_SIZE / 2,
      instance.y - 12,
      '',
      {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: '#FFFFFF',
      },
    ).setOrigin(0.5, 1).setDepth(50);

    this.draw();
    scene.add.existing(this);
  }

  // Subclasses render their own graphic appearance.
  protected abstract draw(): void;

  /**
   * Called when a zombie overlaps this trap.
   * Subclasses apply damage, stun, fire, etc.
   * Called only when tryActivate() returns true.
   */
  abstract onZombieContact(zombie: Zombie): void;

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Attempt to activate the trap.
   * Returns false if cooldown is active, trap is overheated, or malfunctioned.
   * On success: starts cooldown, accumulates overheat.
   */
  tryActivate(): boolean {
    if (this.malfunctioned) return false;
    if (this.overheated) return false;
    if (this.cooldownTimer > 0) return false;
    if (this.uses === 0) return false; // exhausted

    // Start cooldown
    this.cooldownTimer = this.cooldownMs;

    // Accumulate overheat -- activation counts as a pulse of activity
    if (this.overheatMax > 0) {
      // Each activation contributes cooldownMs of "active time" toward overheat
      this.overheatCurrent += this.cooldownMs;
      if (this.overheatCurrent >= this.overheatMax) {
        this.triggerOverheat();
      }
    }

    // Decrement finite uses
    if (this.uses > 0) {
      this.uses--;
    }

    return true;
  }

  /**
   * Repair this trap (called by NightScene when player holds E).
   * Costs 1 parts -- the caller handles resource deduction.
   */
  repair(): void {
    this.malfunctioned = false;
    this.isBeingRepaired = false;
    this.repairProgress = 0;
    this.redraw();
  }

  /**
   * Manually cool an overheated trap (player holds E, free, halves recovery time).
   */
  manualCool(): void {
    if (this.overheated) {
      this.recoveryTimer = Math.max(0, this.recoveryTimer / 2);
    }
  }

  /**
   * Take structural damage (e.g., brutes attacking the trap).
   * Returns true if the trap is destroyed.
   */
  takeDamage(amount: number): boolean {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.destroySelf();
      return true;
    }
    return false;
  }

  /**
   * Per-frame update. Call from NightScene.update() with the frame delta (ms).
   */
  update(delta: number): void {
    if (!this.active) return;

    if (this.overheated) {
      // Count down recovery timer
      this.recoveryTimer -= delta;
      if (this.recoveryTimer <= 0) {
        this.overheated = false;
        this.overheatCurrent = 0;
        this.recoveryTimer = 0;
        this.redraw();
      }
    } else {
      // Count down cooldown
      if (this.cooldownTimer > 0) {
        this.cooldownTimer = Math.max(0, this.cooldownTimer - delta);
      }

      // Passive overheat cool-down (traps cool when idle)
      if (this.overheatCurrent > 0 && this.cooldownTimer === 0) {
        // Cool at the same rate as active accumulation (symmetric)
        this.overheatCurrent = Math.max(0, this.overheatCurrent - delta);
      }
    }

    // Update status text
    this.updateStatusVisuals(delta);
  }

  /** Returns true if this trap is ready to accept zombie contacts. */
  isReady(): boolean {
    return !this.malfunctioned && !this.overheated && this.cooldownTimer === 0 && this.uses !== 0;
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private triggerOverheat(): void {
    this.overheated = true;
    this.overheatCurrent = this.overheatMax;
    this.recoveryTimer = this.recoveryMs;
    this.redraw();
  }

  /**
   * Redraw the Graphics with a status tint overlay.
   * Calls the abstract draw() then overlays a colour based on state.
   */
  private redraw(): void {
    this.clear();
    this.draw();

    if (this.malfunctioned) {
      // Red tint overlay -- trap is broken
      this.fillStyle(0xFF2222, 0.25);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    } else if (this.overheated) {
      // Orange glow overlay
      this.fillStyle(0xFF8800, 0.35);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    } else if (this.cooldownTimer > 0) {
      // Grey out during cooldown
      this.fillStyle(0x000000, 0.35);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    }
  }

  /**
   * Update the floating status label and blink effect.
   */
  private updateStatusVisuals(delta: number): void {
    if (this.malfunctioned) {
      // Red blinking "[E]" label -- tells player which key to press
      this.blinkTimer += delta;
      if (this.blinkTimer >= 400) {
        this.blinkVisible = !this.blinkVisible;
        this.blinkTimer = 0;
      }
      this.statusText.setText(this.blinkVisible ? '[E]' : '');
      this.statusText.setColor('#FF4444');
    } else if (this.overheated) {
      // Orange "HOT!" label (static -- not blinking)
      this.statusText.setText('HOT!');
      this.statusText.setColor('#FF8800');
      this.blinkTimer = 0;
      this.blinkVisible = true;
    } else if (this.cooldownTimer > 0) {
      // Grey countdown in seconds
      const secs = Math.ceil(this.cooldownTimer / 1000);
      this.statusText.setText(`${secs}s`);
      this.statusText.setColor('#888888');
    } else {
      // Active -- green subtle label (could show "" for clean look)
      this.statusText.setText('');
    }
  }

  /** Destroy both Graphics and status text. */
  private destroySelf(): void {
    this.statusText.destroy();
    this.destroy();
  }

  /** Override Phaser's destroy to also clean up status text. */
  destroy(fromScene?: boolean): void {
    if (this.statusText && this.statusText.active) {
      this.statusText.destroy();
    }
    super.destroy(fromScene);
  }
}
