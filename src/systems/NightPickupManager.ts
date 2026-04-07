/**
 * NightPickupManager -- spawns and manages map pickups during the night phase.
 * Pickups give the player risk/reward incentive to leave the base.
 *
 * Pickup definitions are loaded from src/data/pickups.json (all data in JSON, not code).
 * Max 3 active pickups at any time (performance cap).
 *
 * Pickup types:
 *   supply_crate      -- 3-8 random resource near base
 *   ammo_cache        -- +15 loaded ammo
 *   medkit            -- +40 HP
 *   hidden_stash      -- weapon or blueprint at map edge
 *   wounded_survivor  -- +1 refugee (max 1 per night)
 *   adrenaline_shot   -- 15s speed+damage buff
 */

import Phaser from 'phaser';
import pickupsData from '../data/pickups.json';
import { AudioManager } from './AudioManager';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '../config/constants';

// --------------------------------------------------------------------------
// Internal types
// --------------------------------------------------------------------------

type PickupType =
  | 'supply_crate'
  | 'ammo_cache'
  | 'medkit'
  | 'hidden_stash'
  | 'wounded_survivor'
  | 'adrenaline_shot';

interface PickupDef {
  type: PickupType;
  label: string;
  minWave: number;
  timerSeconds: number;
  spawnWeight: number;
  spawnMode: 'near_base' | 'edge' | 'random' | 'far_from_base';
  spawnDistanceMin: number;
  spawnDistanceMax: number;
  color: string;
  pulseColor: string;
  resource: string;
  resourceMin: number;
  resourceMax: number;
  maxActive: number;
}

interface ActivePickup {
  type: PickupType;
  def: PickupDef;
  x: number;
  y: number;
  /** Remaining time in milliseconds */
  timeLeft: number;
  /** Total timer in ms -- used to calculate bar width ratio */
  totalTime: number;
  graphics: Phaser.GameObjects.Graphics;
  labelText: Phaser.GameObjects.Text;
  timerBar: Phaser.GameObjects.Graphics;
  /** Tween that pulses the glow alpha */
  pulseTween: Phaser.Tweens.Tween;
  /** Alpha of the glow shape (tweened 0.35-1.0) */
  glowAlpha: number;
  consumed: boolean;
}

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

const MAX_ACTIVE_PICKUPS = 3;
const PICKUP_RADIUS = 32; // px -- player must be within this distance to collect
const PICKUP_SPRITE_SIZE = 16; // px -- rendered size of pickup graphic
const LABEL_Y_OFFSET = -28; // label above pickup
const TIMER_BAR_WIDTH = 30;
const TIMER_BAR_Y_OFFSET = 10; // below pickup center
const MIN_PICKUP_SEPARATION = 80; // min px between two pickups

// Margin from map edges so pickups are reachable
const EDGE_MARGIN = 48;

// --------------------------------------------------------------------------
// Public interface -- passed up to minimap
// --------------------------------------------------------------------------

export interface PickupMinimapPoint {
  x: number;
  y: number;
  type: string;
}

// --------------------------------------------------------------------------
// NightPickupManager
// --------------------------------------------------------------------------

export class NightPickupManager {
  private scene: Phaser.Scene;
  private mapWidth: number;
  private mapHeight: number;
  private baseCenterX: number;
  private baseCenterY: number;

  private defs: PickupDef[];
  private active: ActivePickup[] = [];

  /** True once a wounded_survivor has been spawned this night (max 1 per night) */
  private survivorSpawnedThisNight: boolean = false;

  constructor(
    scene: Phaser.Scene,
    mapWidth: number,
    mapHeight: number,
    baseCenterX: number,
    baseCenterY: number,
  ) {
    this.scene = scene;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.baseCenterX = baseCenterX;
    this.baseCenterY = baseCenterY;

    // Type-cast from JSON so TypeScript doesn't widen the string literals
    this.defs = pickupsData.pickups as PickupDef[];
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /** Called when a new wave starts. Spawns 1-2 pickups appropriate for the wave. */
  onWaveStart(waveNumber: number): void {
    // Randomly spawn 1 or 2 pickups per wave (50/50 chance of 2)
    const count = Math.random() < 0.5 ? 1 : 2;

    for (let i = 0; i < count; i++) {
      if (this.active.length >= MAX_ACTIVE_PICKUPS) break;
      this.trySpawnPickup(waveNumber);
    }
  }

  /**
   * Call every frame from NightScene.update().
   * @param delta   Frame delta in ms
   * @param playerX Player world X position
   * @param playerY Player world Y position
   */
  update(delta: number, playerX: number, playerY: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      if (!p) continue;

      if (p.consumed) {
        // Visual fade-out already handled in collectPickup(); just remove from list
        this.active.splice(i, 1);
        continue;
      }

      // Count down timer
      p.timeLeft -= delta;
      if (p.timeLeft <= 0) {
        this.expirePickup(p);
        this.active.splice(i, 1);
        continue;
      }

      // Update timer bar width proportional to remaining time
      this.redrawTimerBar(p);

      // Check player proximity for collection
      const dx = playerX - p.x;
      const dy = playerY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= PICKUP_RADIUS) {
        p.consumed = true;
        this.collectPickup(p);
      }
    }
  }

  /** Returns positions of all active pickups for minimap rendering. */
  getActivePickups(): PickupMinimapPoint[] {
    return this.active.map(p => ({ x: p.x, y: p.y, type: p.type }));
  }

  /** Clean up all active pickups (call on scene shutdown). */
  destroy(): void {
    for (const p of this.active) {
      this.removePickupVisuals(p);
    }
    this.active = [];
  }

  // --------------------------------------------------------------------------
  // Spawning
  // --------------------------------------------------------------------------

  private trySpawnPickup(waveNumber: number): void {
    // Filter to defs eligible for this wave, respecting per-type limits
    const eligible = this.defs.filter(d => {
      if (d.minWave > waveNumber) return false;
      if (d.type === 'wounded_survivor' && this.survivorSpawnedThisNight) return false;
      const activeCount = this.active.filter(a => a.type === d.type).length;
      return activeCount < d.maxActive;
    });

    if (eligible.length === 0) return;

    const def = this.weightedPick(eligible);
    if (!def) return;

    const pos = this.findSpawnPosition(def);
    if (!pos) return;

    this.spawnPickup(def, pos.x, pos.y);

    if (def.type === 'wounded_survivor') {
      this.survivorSpawnedThisNight = true;
    }
  }

  /** Weighted-random pick using spawnWeight from each def. */
  private weightedPick(defs: PickupDef[]): PickupDef | null {
    const totalWeight = defs.reduce((sum, d) => sum + d.spawnWeight, 0);
    let r = Math.random() * totalWeight;
    for (const d of defs) {
      r -= d.spawnWeight;
      if (r <= 0) return d;
    }
    return defs[defs.length - 1] ?? null;
  }

  /**
   * Find a valid world position for the pickup.
   * Retries up to 20 times to avoid placing too close to existing pickups.
   */
  private findSpawnPosition(def: PickupDef): { x: number; y: number } | null {
    const MAX_ATTEMPTS = 20;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const pos = this.generateRawPosition(def);
      if (!pos) continue;

      let tooClose = false;
      for (const existing of this.active) {
        const dx = pos.x - existing.x;
        const dy = pos.y - existing.y;
        if (Math.sqrt(dx * dx + dy * dy) < MIN_PICKUP_SEPARATION) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) return pos;
    }
    return null;
  }

  private generateRawPosition(def: PickupDef): { x: number; y: number } | null {
    const bx = this.baseCenterX;
    const by = this.baseCenterY;
    const mapW = this.mapWidth;
    const mapH = this.mapHeight;

    switch (def.spawnMode) {
      case 'near_base': {
        // Uniform distribution within a disk around the base
        const angle = Math.random() * Math.PI * 2;
        const dist = def.spawnDistanceMax * Math.sqrt(Math.random());
        return this.clampToMap(bx + Math.cos(angle) * dist, by + Math.sin(angle) * dist);
      }

      case 'far_from_base': {
        // Random angle, distance between min and a reasonable max
        const angle = Math.random() * Math.PI * 2;
        const maxDist = Math.min(def.spawnDistanceMax, Math.min(mapW, mapH) * 0.45);
        const dist = def.spawnDistanceMin + Math.random() * (maxDist - def.spawnDistanceMin);
        return this.clampToMap(bx + Math.cos(angle) * dist, by + Math.sin(angle) * dist);
      }

      case 'edge': {
        // Spawn near one of the four map edges
        const side = Math.floor(Math.random() * 4);
        let x = 0;
        let y = 0;
        if (side === 0) {
          x = EDGE_MARGIN + Math.random() * (mapW - EDGE_MARGIN * 2);
          y = EDGE_MARGIN + Math.random() * 60;
        } else if (side === 1) {
          x = EDGE_MARGIN + Math.random() * (mapW - EDGE_MARGIN * 2);
          y = mapH - EDGE_MARGIN - Math.random() * 60;
        } else if (side === 2) {
          x = EDGE_MARGIN + Math.random() * 60;
          y = EDGE_MARGIN + Math.random() * (mapH - EDGE_MARGIN * 2);
        } else {
          x = mapW - EDGE_MARGIN - Math.random() * 60;
          y = EDGE_MARGIN + Math.random() * (mapH - EDGE_MARGIN * 2);
        }
        return this.clampToMap(x, y);
      }

      case 'random':
      default: {
        const x = EDGE_MARGIN + Math.random() * (mapW - EDGE_MARGIN * 2);
        const y = EDGE_MARGIN + Math.random() * (mapH - EDGE_MARGIN * 2);
        return { x, y };
      }
    }
  }

  private clampToMap(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.max(EDGE_MARGIN, Math.min(this.mapWidth - EDGE_MARGIN, x)),
      y: Math.max(EDGE_MARGIN, Math.min(this.mapHeight - EDGE_MARGIN, y)),
    };
  }

  // --------------------------------------------------------------------------
  // Visual creation
  // --------------------------------------------------------------------------

  private spawnPickup(def: PickupDef, x: number, y: number): void {
    const colorNum = parseInt(def.color.replace('0x', ''), 16);
    const pulseColorNum = parseInt(def.pulseColor.replace('0x', ''), 16);

    // ---- Glow / body graphics ----
    const graphics = this.scene.add.graphics();
    graphics.setDepth(5);
    graphics.x = x;
    graphics.y = y;

    // ---- Floating label ----
    const labelText = this.scene.add.text(x, y + LABEL_Y_OFFSET, def.label, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '6px',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(6);

    // ---- Timer bar ----
    const timerBar = this.scene.add.graphics();
    timerBar.setDepth(5);
    timerBar.x = x;
    timerBar.y = y;

    // Build the pickup record so the tween onUpdate can reference it
    const pickup: ActivePickup = {
      type: def.type,
      def,
      x,
      y,
      timeLeft: def.timerSeconds * 1000,
      totalTime: def.timerSeconds * 1000,
      graphics,
      labelText,
      timerBar,
      pulseTween: null as unknown as Phaser.Tweens.Tween, // assigned below
      glowAlpha: 0.5,
      consumed: false,
    };

    // Redraw body graphic at a given glow alpha
    const drawBody = (): void => {
      graphics.clear();
      // Outer glow ring using pulse color
      graphics.fillStyle(pulseColorNum, pickup.glowAlpha * 0.4);
      graphics.fillCircle(0, 0, PICKUP_SPRITE_SIZE);
      // Inner body using main color
      graphics.fillStyle(colorNum, 1);
      graphics.fillRect(
        -PICKUP_SPRITE_SIZE / 2,
        -PICKUP_SPRITE_SIZE / 2,
        PICKUP_SPRITE_SIZE,
        PICKUP_SPRITE_SIZE,
      );
      // Type-specific decoration
      if (def.type === 'medkit') {
        // Red cross
        graphics.fillStyle(0xFF2222, 1);
        graphics.fillRect(-2, -PICKUP_SPRITE_SIZE / 2 + 3, 4, PICKUP_SPRITE_SIZE - 6);
        graphics.fillRect(-PICKUP_SPRITE_SIZE / 2 + 3, -2, PICKUP_SPRITE_SIZE - 6, 4);
      } else if (def.type === 'adrenaline_shot') {
        // White syringe body
        graphics.fillStyle(0xFFFFFF, 0.9);
        graphics.fillRect(-2, -6, 4, 12);
      }
    };

    drawBody();

    // Pulse tween: animate glowAlpha 0.35 <-> 1.0
    const pulseTween = this.scene.tweens.add({
      targets: pickup,
      glowAlpha: { from: 0.35, to: 1.0 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        drawBody();
      },
    });
    pickup.pulseTween = pulseTween;

    this.active.push(pickup);

    // Notify the scene that a pickup has spawned (for GameLog, camera flash, sound)
    this.scene.events.emit('pickup-spawned', def.label, x, y);
  }

  // --------------------------------------------------------------------------
  // Timer bar
  // --------------------------------------------------------------------------

  private redrawTimerBar(p: ActivePickup): void {
    const ratio = Math.max(0, p.timeLeft / p.totalTime);
    p.timerBar.clear();
    // Background
    p.timerBar.fillStyle(0x222222, 0.8);
    p.timerBar.fillRect(-TIMER_BAR_WIDTH / 2, TIMER_BAR_Y_OFFSET, TIMER_BAR_WIDTH, 4);
    // Foreground -- color transitions green -> yellow -> red
    const barColor = ratio > 0.5 ? 0x44FF44 : ratio > 0.25 ? 0xFFDD00 : 0xFF3333;
    p.timerBar.fillStyle(barColor, 1);
    p.timerBar.fillRect(-TIMER_BAR_WIDTH / 2, TIMER_BAR_Y_OFFSET, Math.round(TIMER_BAR_WIDTH * ratio), 4);
  }

  // --------------------------------------------------------------------------
  // Collection & expiry
  // --------------------------------------------------------------------------

  /** Play the appropriate pickup sound for the given pickup type. */
  private playPickupSound(type: PickupType): void {
    switch (type) {
      case 'supply_crate':
        AudioManager.play('pickup_supply');
        break;
      case 'medkit':
        AudioManager.play('pickup_medkit');
        break;
      case 'ammo_cache':
        AudioManager.play('pickup_ammo');
        break;
      case 'adrenaline_shot':
        AudioManager.play('pickup_adrenaline');
        break;
      case 'wounded_survivor':
        AudioManager.play('pickup_survivor');
        break;
      case 'hidden_stash':
        AudioManager.play('blueprint_found');
        break;
      default:
        AudioManager.play('ui_click');
        break;
    }
  }

  private collectPickup(pickup: ActivePickup): void {
    // Sound feedback: pick the correct sound for each pickup type
    this.playPickupSound(pickup.type);

    // Apply gameplay effect via events (NightScene handles the actual state changes)
    this.applyPickupEffect(pickup);

    // Visual: flash expand then fade
    pickup.pulseTween.stop();
    this.scene.tweens.add({
      targets: pickup.graphics,
      alpha: 0,
      scaleX: 2.5,
      scaleY: 2.5,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        if (pickup.graphics.active) pickup.graphics.destroy();
      },
    });

    // Immediately hide label and bar
    if (pickup.labelText.active) pickup.labelText.destroy();
    if (pickup.timerBar.active) pickup.timerBar.destroy();
  }

  private expirePickup(pickup: ActivePickup): void {
    pickup.pulseTween.stop();

    // Fade-out effect
    this.scene.tweens.add({
      targets: [pickup.graphics, pickup.labelText, pickup.timerBar],
      alpha: 0,
      duration: 400,
      onComplete: () => {
        this.removePickupVisuals(pickup);
      },
    });
  }

  private removePickupVisuals(pickup: ActivePickup): void {
    if (pickup.graphics.active) pickup.graphics.destroy();
    if (pickup.labelText.active) pickup.labelText.destroy();
    if (pickup.timerBar.active) pickup.timerBar.destroy();
  }

  // --------------------------------------------------------------------------
  // Effect application -- emits events that NightScene listens to
  // --------------------------------------------------------------------------

  private applyPickupEffect(pickup: ActivePickup): void {
    const def = pickup.def;

    switch (def.resource) {
      case 'heal':
        this.scene.events.emit('pickup-heal', def.resourceMax);
        this.showPickupText(pickup, `+${def.resourceMax} HP`, '#44FF88');
        break;

      case 'ammo':
        this.scene.events.emit('pickup-ammo', def.resourceMax);
        this.showPickupText(pickup, `+${def.resourceMax} Ammo`, '#4488FF');
        break;

      case 'random': {
        const resources: string[] = ['scrap', 'ammo', 'food'];
        const resType = resources[Math.floor(Math.random() * resources.length)] ?? 'scrap';
        const amount =
          def.resourceMin + Math.floor(Math.random() * (def.resourceMax - def.resourceMin + 1));
        this.scene.events.emit('pickup-resource', resType, amount);
        this.showPickupText(pickup, `+${amount} ${resType}`, '#FFD700');
        break;
      }

      case 'refugee':
        this.scene.events.emit('pickup-refugee');
        this.showPickupText(pickup, 'Survivor rescued!', '#00FF88');
        break;

      case 'weapon_or_blueprint':
        this.scene.events.emit('pickup-stash');
        this.showPickupText(pickup, 'Hidden stash found!', '#FFFFFF');
        break;

      case 'buff_adrenaline':
        this.scene.events.emit('pickup-adrenaline', def.resourceMax);
        this.showPickupText(pickup, 'ADRENALINE!', '#FF4444');
        break;

      default:
        break;
    }
  }

  /** Show a floating feedback text at the pickup world position. */
  private showPickupText(pickup: ActivePickup, msg: string, color: string): void {
    const text = this.scene.add.text(pickup.x, pickup.y - 16, msg, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(20);

    this.scene.tweens.add({
      targets: text,
      y: pickup.y - 52,
      alpha: 0,
      duration: 1800,
      ease: 'Power1',
      onComplete: () => {
        if (text.active) text.destroy();
      },
    });
  }
}

// Suppress "unused import" warnings -- these constants are used indirectly via pickupsData
void TILE_SIZE;
void MAP_WIDTH;
void MAP_HEIGHT;
