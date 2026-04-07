import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import type { StructureInstance } from '../config/types';
import type { Zombie } from '../entities/Zombie';
import { TrapBase } from './TrapBase';

/**
 * Chain reaction step definition.
 * Each step fires after the previous one, with a delay.
 */
interface ChainStep {
  label: string;    // text label shown during animation
  color: number;    // particle/flash color
  delay: number;    // ms after activation this step fires
  duration: number; // ms the effect lasts
  damage: number;   // damage dealt to zombies in radius at this step
  radius: number;   // effect radius (pixels)
}

/** Sequence of chain reaction steps: alarm -> fire -> explosion -> blades */
const CHAIN_STEPS: ChainStep[] = [
  { label: 'ALARM!',    color: 0xFF4444, delay: 0,    duration: 600,  damage: 5,   radius: 48 },
  { label: 'FIRE!',     color: 0xFF8800, delay: 600,  duration: 700,  damage: 30,  radius: 56 },
  { label: 'BOOM!',     color: 0xFFCC00, delay: 1300, duration: 600,  damage: 60,  radius: 72 },
  { label: 'BLADES!',   color: 0xCCCCCC, delay: 1900, duration: 500,  damage: 40,  radius: 48 },
];

/**
 * Rube Goldberg Machine -- the crown jewel of improvised traps.
 * When triggered, a chain reaction fires: alarm lures zombies, then fire,
 * then explosion, then spinning blades -- each damaging in an expanding area.
 *
 * Total potential damage per cycle: ~135 dmg to zombies in range at each step.
 * Cooldown: 20s. Very expensive (15 scrap, 8 parts). Malfunction 25%.
 *
 * The satisfying chain animation plays out over ~2.4 seconds.
 */
export class RubeGoldberg extends TrapBase {
  /** Currently active chain step index (-1 = not running). */
  private chainStep: number = -1;
  /** Time (ms) since chain activation started. */
  private chainTimer: number = 0;
  /** Whether the chain sequence is currently running. */
  private chainRunning: boolean = false;
  /** Scene reference for spawning effects. */
  private sceneRef: Phaser.Scene;
  /** Text object showing the current chain step label. */
  private chainLabel: Phaser.GameObjects.Text | null = null;
  /** Flash overlay graphics. */
  private flashAlpha: number = 0;
  private flashColor: number = 0xFFFFFF;
  /** Gear/cog animation angle. */
  private gearAngle: number = 0;
  /** Callback to notify NightScene when a chain step fires. */
  public onChainStep: ((stepIndex: number, radius: number, damage: number) => void) | null = null;

  constructor(scene: Phaser.Scene, instance: StructureInstance) {
    super(
      scene,
      instance,
      120,   // maxHp
      20000, // cooldownMs (20s)
      0,     // overheatMax
      0,     // recoveryMs
      0.25,  // malfunctionChance
      -1,    // uses: unlimited
      2,     // fuelPerNight (2 food to keep the machine primed)
    );
    this.sceneRef = scene;
  }

  protected draw(): void {
    this.clear();

    const mid = TILE_SIZE / 2;
    const active = !this.malfunctioned;

    // Chaotic contraption background
    this.fillStyle(0x0A0A12);
    this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // --- Gear 1 (top left) ---
    this.drawGear(6, 6, 6, this.gearAngle, active ? 0x888866 : 0x333333);
    // --- Gear 2 (top right, counter-rotates) ---
    this.drawGear(TILE_SIZE - 6, 7, 5, -this.gearAngle * 1.2, active ? 0x776655 : 0x282828);
    // --- Gear 3 (bottom center) ---
    this.drawGear(mid, TILE_SIZE - 7, 7, this.gearAngle * 0.8, active ? 0x998866 : 0x333322);

    // Connecting rod between gears
    this.lineStyle(1, active ? 0x665544 : 0x222222, 0.8);
    this.lineBetween(10, 10, TILE_SIZE - 8, 10);
    this.lineBetween(10, 10, mid, TILE_SIZE - 8);

    // Bell (alarm component) -- center top
    const bellColor = active ? 0xCCAA22 : 0x555533;
    this.fillStyle(bellColor);
    this.fillCircle(mid, 8, 4);
    this.lineStyle(2, bellColor);
    this.lineBetween(mid - 2, 8, mid - 2, 12);
    this.lineBetween(mid + 2, 8, mid + 2, 12);
    this.lineBetween(mid - 4, 12, mid + 4, 12);

    // Flame pipe (fire component) -- left side
    this.fillStyle(active ? 0x553322 : 0x222222);
    this.fillRect(1, mid - 4, 5, 8);
    if (active && this.chainRunning && this.chainStep >= 1) {
      // Active fire: orange glow
      this.fillStyle(0xFF6600, 0.8);
      this.fillCircle(4, mid - 6, 4);
    }

    // Explosive (bomb component) -- right side
    this.fillStyle(active ? 0x3A3322 : 0x222222);
    this.fillCircle(TILE_SIZE - 5, mid, 5);
    this.lineStyle(1, active ? 0xCC9922 : 0x444422);
    this.lineBetween(TILE_SIZE - 5, mid - 5, TILE_SIZE - 5, mid - 10); // fuse
    if (active && this.chainRunning && this.chainStep >= 2) {
      this.fillStyle(0xFFDD00, 0.9);
      this.fillCircle(TILE_SIZE - 5, mid, 7);
    }

    // Blade rotor (blades component) -- bottom center
    if (active) {
      const bladeLen = 6;
      this.lineStyle(2, this.chainRunning && this.chainStep >= 3 ? 0xCCCCCC : 0x555544);
      for (let i = 0; i < 3; i++) {
        const a = this.gearAngle * 3 + (i / 3) * Math.PI * 2;
        this.lineBetween(mid, TILE_SIZE - 7, mid + Math.cos(a) * bladeLen, TILE_SIZE - 7 + Math.sin(a) * bladeLen);
      }
    }

    // Chain animation flash overlay
    if (this.flashAlpha > 0) {
      this.fillStyle(this.flashColor, this.flashAlpha);
      this.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    }

    // Malfunction: cracked X
    if (this.malfunctioned) {
      this.lineStyle(2, 0xCC2222, 0.8);
      this.lineBetween(3, 3, TILE_SIZE - 3, TILE_SIZE - 3);
      this.lineBetween(TILE_SIZE - 3, 3, 3, TILE_SIZE - 3);
    }

    // Border: distinctive double-line for this special trap
    this.lineStyle(2, active ? 0xBBAA44 : 0x444422, 0.4);
    this.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
    this.lineStyle(1, active ? 0x88AA66 : 0x333322, 0.25);
    this.strokeRect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4);
  }

  /**
   * Draw a simple gear with 'teeth' count.
   */
  private drawGear(cx: number, cy: number, r: number, angle: number, color: number): void {
    this.fillStyle(color);
    this.fillCircle(cx, cy, r);
    const teeth = 5;
    this.lineStyle(2, color);
    for (let i = 0; i < teeth; i++) {
      const a = angle + (i / teeth) * Math.PI * 2;
      const tx = cx + Math.cos(a) * (r + 2);
      const ty = cy + Math.sin(a) * (r + 2);
      this.fillRect(tx - 1, ty - 1, 2, 2);
    }
    // Inner hub
    this.fillStyle(0x1A1A1A);
    this.fillCircle(cx, cy, Math.max(1, r - 3));
  }

  override update(delta: number): void {
    super.update(delta);

    // Rotate gears when ready
    if (!this.malfunctioned) {
      this.gearAngle += (delta / 1000) * 1.5;
    }

    // Chain sequence update
    if (this.chainRunning) {
      this.chainTimer += delta;

      // Determine current chain step based on elapsed time
      let newStep = -1;
      for (let i = CHAIN_STEPS.length - 1; i >= 0; i--) {
        const step = CHAIN_STEPS[i];
        if (!step) continue;
        if (this.chainTimer >= step.delay) {
          newStep = i;
          break;
        }
      }

      // Fire callback on step transition
      if (newStep > this.chainStep) {
        this.chainStep = newStep;
        const step = CHAIN_STEPS[newStep];
        if (step) {
          // Notify NightScene to apply damage at this step
          if (this.onChainStep) {
            this.onChainStep(newStep, step.radius, step.damage);
          }
          // Visual flash
          this.flashColor = step.color;
          this.flashAlpha = 0.7;
          // Update label
          this.updateChainLabel(step.label, step.color);
        }
      }

      // Fade flash
      if (this.flashAlpha > 0) {
        this.flashAlpha = Math.max(0, this.flashAlpha - delta / 200);
      }

      // Check if chain is complete
      const lastStep = CHAIN_STEPS[CHAIN_STEPS.length - 1];
      if (lastStep && this.chainTimer >= lastStep.delay + lastStep.duration) {
        this.endChain();
      }
    }

    this.clear();
    this.draw();
  }

  /**
   * Start the chain reaction sequence.
   * Called by NightScene after tryActivate() succeeds.
   */
  startChain(): void {
    this.chainRunning = true;
    this.chainTimer = 0;
    this.chainStep = -1;
  }

  private endChain(): void {
    this.chainRunning = false;
    this.chainStep = -1;
    this.flashAlpha = 0;
    if (this.chainLabel) {
      this.chainLabel.destroy();
      this.chainLabel = null;
    }
  }

  private updateChainLabel(text: string, color: number): void {
    if (this.chainLabel) {
      this.chainLabel.destroy();
      this.chainLabel = null;
    }
    const hex = '#' + color.toString(16).padStart(6, '0');
    this.chainLabel = this.sceneRef.add.text(
      this.structureInstance.x + TILE_SIZE / 2,
      this.structureInstance.y - 18,
      text,
      {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color: hex,
        stroke: '#000000',
        strokeThickness: 2,
      },
    ).setOrigin(0.5, 1).setDepth(55);

    // Auto-destroy label after 600ms
    this.sceneRef.time.delayedCall(600, () => {
      if (this.chainLabel) {
        this.chainLabel.destroy();
        this.chainLabel = null;
      }
    });
  }

  /** Clean up chain label on destroy. */
  override destroy(fromScene?: boolean): void {
    if (this.chainLabel) {
      this.chainLabel.destroy();
      this.chainLabel = null;
    }
    super.destroy(fromScene);
  }

  onZombieContact(zombie: Zombie): void {
    // The chain reaction is started by NightScene; this handles the triggering zombie.
    // Step 0 (ALARM) damage to the trigger zombie.
    zombie.takeDamage(CHAIN_STEPS[0]?.damage ?? 5);
  }
}
