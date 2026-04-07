import Phaser from 'phaser';
import type { ZoneId } from '../config/types';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/constants';
import nightEventsData from '../data/night-events.json';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

/** Definition loaded from night-events.json */
interface NightEventDef {
  id: string;
  name: string;
  label: string;
  zones: string[];
  nights: number[];
  chance: number;
  /** Milliseconds until auto-dismiss. -1 = lasts entire night. */
  duration: number;
}

/** Runtime state for an active event */
export interface NightEvent {
  id: string;
  name: string;
  /** Remaining lifetime in ms. -1 = permanent for this night. */
  timeLeft: number;
}

// ------------------------------------------------------------------
// Gameplay effect constants
// ------------------------------------------------------------------

/** Fog: what fraction of the normal vision radius the player sees (0.5 = half) */
export const FOG_VISION_MULTIPLIER = 0.5;

/** Rain: extra malfunction chance for mechanical traps (additive) */
export const RAIN_MALFUNCTION_BONUS = 0.10;

/** Rain: fire-based trap damage multiplier */
export const RAIN_FIRE_DAMAGE_MULTIPLIER = 0.50;

/** Blood Moon: zombie speed multiplier */
export const BLOOD_MOON_SPEED_MULTIPLIER = 1.25;

/** Blood Moon: zombie HP multiplier */
export const BLOOD_MOON_HP_MULTIPLIER = 1.25;

/** Storm: how many structures take damage at night start */
export const STORM_STRUCTURE_DAMAGE_COUNT = 2;

/** Storm: how much HP each struck structure loses */
export const STORM_STRUCTURE_DAMAGE_AMOUNT = 15;

/** Bombardment: interval between explosions (ms) */
const BOMBARDMENT_INTERVAL_MS = 4000;

/** Bombardment: radius of damage per explosion (px) */
const BOMBARDMENT_RADIUS = 80;

/** Bombardment: damage per explosion to zombies and structures in radius */
const BOMBARDMENT_DAMAGE = 30;

// ------------------------------------------------------------------
// Particle/visual constants
// ------------------------------------------------------------------

/** Rain: target number of rain drops per frame burst */
const RAIN_DROP_COUNT = 3;

/** Rain: drop alpha */
const RAIN_DROP_ALPHA = 0.35;

// ------------------------------------------------------------------
// NightEventManager
// ------------------------------------------------------------------

/**
 * Manages weather and special night-events for a single NightScene run.
 *
 * Responsibilities:
 *  - Pick which events are active for this zone + night number (via JSON config).
 *  - Create and update visual overlays (fog overlay, rain particles, storm flash, etc.).
 *  - Expose runtime flags/multipliers that NightScene reads to apply gameplay effects.
 *  - Emit 'night-event-active' and 'night-event-expired' on the scene event bus.
 */
export class NightEventManager {
  private scene: Phaser.Scene;
  private zone: ZoneId;
  private nightNumber: number;

  /** Currently active events */
  private activeEvents: NightEvent[] = [];

  // ---- Overlay graphics objects (created lazily when event activates) ----

  /** Semi-transparent white/grey overlay for fog effect */
  private fogOverlay: Phaser.GameObjects.Graphics | null = null;

  /** Pulsing blood-red full-screen overlay for Blood Moon */
  private bloodMoonOverlay: Phaser.GameObjects.Graphics | null = null;
  private bloodMoonTime: number = 0;

  /** Dark overlay for Power Outage */
  private powerOutageOverlay: Phaser.GameObjects.Graphics | null = null;

  /** Graphics used to draw rain drops each frame */
  private rainGraphics: Phaser.GameObjects.Graphics | null = null;

  /** Storm flash overlay */
  private stormFlash: Phaser.GameObjects.Graphics | null = null;

  /** Bombardment timer accumulator (ms) */
  private bombardmentTimer: number = 0;

  /** Whether a storm flash is currently fading */
  private stormFlashing: boolean = false;

  /** Banner container shown at start of night (auto-dismissed) */
  private bannerContainer: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene, zone: ZoneId, nightNumber: number) {
    this.scene = scene;
    this.zone = zone;
    this.nightNumber = nightNumber;

    this.pickActiveEvents();
    this.createVisuals();
    this.showNightBanner();
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /** Returns snapshot of currently active events */
  getActiveEvents(): NightEvent[] {
    return [...this.activeEvents];
  }

  /** True if the named event is currently active */
  hasEvent(id: string): boolean {
    return this.activeEvents.some(e => e.id === id);
  }

  /**
   * Call every frame from NightScene.update().
   * @param delta Frame time in milliseconds.
   */
  update(delta: number): void {
    // Tick down timed events
    for (let i = this.activeEvents.length - 1; i >= 0; i--) {
      const ev = this.activeEvents[i];
      if (!ev) continue;
      if (ev.timeLeft > 0) {
        ev.timeLeft -= delta;
        if (ev.timeLeft <= 0) {
          this.expireEvent(ev.id);
          this.activeEvents.splice(i, 1);
        }
      }
    }

    // Update visuals
    if (this.hasEvent('blood_moon')) {
      this.bloodMoonTime += delta;
      this.updateBloodMoonOverlay();
    }

    if (this.hasEvent('rain')) {
      this.updateRain();
    }

    if (this.hasEvent('bombardment')) {
      this.bombardmentTimer += delta;
      if (this.bombardmentTimer >= BOMBARDMENT_INTERVAL_MS) {
        this.bombardmentTimer -= BOMBARDMENT_INTERVAL_MS;
        this.triggerBombardment();
      }
    }
  }

  /** Clean up all visuals -- call on scene shutdown */
  destroy(): void {
    this.fogOverlay?.destroy();
    this.bloodMoonOverlay?.destroy();
    this.powerOutageOverlay?.destroy();
    this.rainGraphics?.destroy();
    this.stormFlash?.destroy();
    this.bannerContainer?.destroy();
    this.fogOverlay = null;
    this.bloodMoonOverlay = null;
    this.powerOutageOverlay = null;
    this.rainGraphics = null;
    this.stormFlash = null;
    this.bannerContainer = null;
  }

  // ------------------------------------------------------------------
  // Event selection
  // ------------------------------------------------------------------

  /**
   * Iterate night-events.json and pick which events fire this run.
   * Uses Math.random() -- no seeded random needed here (night variance is intentional).
   */
  private pickActiveEvents(): void {
    const defs: NightEventDef[] = nightEventsData.events as NightEventDef[];

    for (const def of defs) {
      // Zone filter
      if (!def.zones.includes(this.zone)) continue;
      // Night filter
      if (!def.nights.includes(this.nightNumber)) continue;
      // Chance roll
      if (Math.random() > def.chance) continue;

      this.activeEvents.push({
        id: def.id,
        name: def.name,
        timeLeft: def.duration, // -1 = lasts entire night
      });
    }
  }

  // ------------------------------------------------------------------
  // Visual creation
  // ------------------------------------------------------------------

  private createVisuals(): void {
    if (this.hasEvent('fog')) this.createFogOverlay();
    if (this.hasEvent('blood_moon')) this.createBloodMoonOverlay();
    if (this.hasEvent('power_outage')) this.createPowerOutageOverlay();
    if (this.hasEvent('rain')) this.createRainGraphics();
    if (this.hasEvent('storm')) this.triggerStormVisual();
    if (this.hasEvent('bombardment')) {
      // Initialize timer at a random offset so first explosion isn't instant
      this.bombardmentTimer = Math.random() * BOMBARDMENT_INTERVAL_MS * 0.5;
    }
  }

  // ---- Fog ----

  private createFogOverlay(): void {
    // Semi-transparent white/grey rectangle covering the entire screen.
    // Scroll-factor 0 so it stays fixed relative to camera (screen-space).
    this.fogOverlay = this.scene.add.graphics();
    this.fogOverlay.setScrollFactor(0);
    this.fogOverlay.setDepth(85); // above terrain (1-50), below HUD (150+) and damage overlay (99)
    this.fogOverlay.fillStyle(0xCCCCCC, 1);
    this.fogOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.fogOverlay.setAlpha(0.22); // subtle but noticeable
  }

  // ---- Blood Moon ----

  private createBloodMoonOverlay(): void {
    this.bloodMoonOverlay = this.scene.add.graphics();
    this.bloodMoonOverlay.setScrollFactor(0);
    this.bloodMoonOverlay.setDepth(85);
    this.bloodMoonOverlay.setAlpha(0);
    this.bloodMoonTime = 0;
  }

  private updateBloodMoonOverlay(): void {
    if (!this.bloodMoonOverlay) return;
    // Pulse: alpha oscillates between 0.08 and 0.18 over ~5 seconds
    const rampSeconds = 60; // Grow from 0 to max over 60 seconds
    const ramp = Math.min(1, (this.bloodMoonTime / 1000) / rampSeconds);
    const maxAlpha = 0.05 + ramp * 0.13; // 0.05..0.18
    const pulse = 0.5 + 0.5 * Math.sin(this.bloodMoonTime * 0.00125); // ~0.2 Hz
    const alpha = maxAlpha * pulse;

    const w = GAME_WIDTH;
    const h = GAME_HEIGHT;
    this.bloodMoonOverlay.clear();
    this.bloodMoonOverlay.fillStyle(0xCC0000, 1);
    this.bloodMoonOverlay.fillRect(0, 0, w, h);
    this.bloodMoonOverlay.setAlpha(alpha);
  }

  // ---- Power Outage ----

  private createPowerOutageOverlay(): void {
    // Near-black overlay -- "lights out" effect.
    // Player position is already lighter due to the regular night background;
    // this overlay just darkens everything further.
    this.powerOutageOverlay = this.scene.add.graphics();
    this.powerOutageOverlay.setScrollFactor(0);
    this.powerOutageOverlay.setDepth(86);
    this.powerOutageOverlay.fillStyle(0x000000, 1);
    this.powerOutageOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.powerOutageOverlay.setAlpha(0.5);
  }

  /** Called when power_outage expires -- fade out and remove overlay */
  private removePowerOutageOverlay(): void {
    if (!this.powerOutageOverlay) return;
    this.scene.tweens.add({
      targets: this.powerOutageOverlay,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => {
        this.powerOutageOverlay?.destroy();
        this.powerOutageOverlay = null;
      },
    });
  }

  // ---- Rain ----

  private createRainGraphics(): void {
    // A Graphics object that we clear and redraw each frame with animated drops.
    // Depth 84 -- just below fog overlay so fog-rain combo looks layered.
    this.rainGraphics = this.scene.add.graphics();
    this.rainGraphics.setScrollFactor(0);
    this.rainGraphics.setDepth(84);
  }

  /**
   * Draw a sparse set of rain streaks each frame.
   * Uses a simple deterministic frame-based approach to avoid allocations.
   */
  private updateRain(): void {
    if (!this.rainGraphics) return;
    const g = this.rainGraphics;
    g.clear();

    const now = this.scene.time.now;
    g.lineStyle(1, 0xAAAADD, RAIN_DROP_ALPHA);

    // Animate ~40 drops; their positions shift downward over time
    for (let i = 0; i < 40; i++) {
      // Each drop has a stable screen-X derived from its index + a noise offset
      const seedX = (i * 79 + 1) % 997; // pseudo-unique per drop
      const x = (seedX / 997) * GAME_WIDTH;

      // Y position scrolls downward; wrap around when it leaves the screen
      const scrollSpeed = 280 + (i % 5) * 30; // px/s, vary by drop
      const yOffset = (now * scrollSpeed / 1000) % (GAME_HEIGHT + 20);
      const y = (yOffset + (i * 23)) % (GAME_HEIGHT + 20) - 20;

      // Angle: drop travels at ~80deg (mostly downward, slight angle)
      const dropLen = 8 + (i % 4) * 3;
      const dx = dropLen * 0.22;
      const dy = dropLen * 0.975;

      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + dx, y + dy);
      g.strokePath();
    }

    // Burst of RAIN_DROP_COUNT extra drops per frame for density variation
    for (let j = 0; j < RAIN_DROP_COUNT; j++) {
      const rx = Math.random() * GAME_WIDTH;
      const ry = Math.random() * GAME_HEIGHT;
      g.beginPath();
      g.moveTo(rx, ry);
      g.lineTo(rx + 2, ry + 8);
      g.strokePath();
    }
  }

  // ---- Storm ----

  /**
   * Trigger a storm flash visual: white/grey overlay that fades in quickly
   * then slowly fades out. Called once when the event is created.
   * Does NOT apply gameplay damage -- that is handled by NightScene.
   */
  private triggerStormVisual(): void {
    if (this.stormFlashing) return;
    this.stormFlashing = true;

    this.stormFlash = this.scene.add.graphics();
    this.stormFlash.setScrollFactor(0);
    this.stormFlash.setDepth(92); // above other overlays, below damage overlay
    this.stormFlash.fillStyle(0xEEEEFF, 1);
    this.stormFlash.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.stormFlash.setAlpha(0);

    // Initial lightning flash: fade in to 0.35 alpha over 120ms
    this.scene.tweens.add({
      targets: this.stormFlash,
      alpha: 0.35,
      duration: 120,
      ease: 'Power3',
      onComplete: () => {
        // Hold for 80ms then fade out to a faint persistent darker overlay
        this.scene.time.delayedCall(80, () => {
          this.scene.tweens.add({
            targets: this.stormFlash,
            alpha: 0.06, // residual darkening -- "darker night"
            duration: 800,
            ease: 'Power1',
            onComplete: () => {
              this.stormFlashing = false;
            },
          });
        });
      },
    });

    // Schedule a second lightning flash after ~8-15s for atmosphere
    const delay = 8000 + Math.random() * 7000;
    this.scene.time.delayedCall(delay, () => {
      this.triggerLightningFlash();
    });
  }

  /**
   * Subsequent lightning flashes -- briefer and more random than the initial one.
   * Re-schedules itself while the storm event is active.
   */
  private triggerLightningFlash(): void {
    if (!this.hasEvent('storm') || !this.stormFlash) return;

    // Quick flash: 0.06 -> 0.30 -> back to 0.06
    this.scene.tweens.add({
      targets: this.stormFlash,
      alpha: 0.30,
      duration: 80,
      ease: 'Power3',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.stormFlash,
          alpha: 0.06,
          duration: 500,
          ease: 'Power1',
        });
      },
    });

    // Schedule next flash
    const delay = 5000 + Math.random() * 12000;
    this.scene.time.delayedCall(delay, () => {
      this.triggerLightningFlash();
    });
  }

  // ---- Bombardment ----

  /**
   * Fire a single bombardment explosion at a random map position.
   * Emits 'bombardment-explosion' with { x, y, radius, damage } so NightScene
   * can apply damage without NightEventManager needing direct zombie references.
   */
  private triggerBombardment(): void {
    // Map dimensions: MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE (40*32=1280, 30*32=960)
    const mapW = 40 * 32;
    const mapH = 30 * 32;

    // Avoid spawning right on the base center (center of map) -- offset by at least 200px
    let x: number;
    let y: number;
    let attempts = 0;
    do {
      x = 100 + Math.random() * (mapW - 200);
      y = 100 + Math.random() * (mapH - 200);
      const distFromCenter = Math.sqrt((x - mapW / 2) ** 2 + (y - mapH / 2) ** 2);
      attempts++;
      if (distFromCenter > 200 || attempts > 10) break;
    } while (true);

    // Visual: explosion flash at world position (converted to screen via camera)
    this.showExplosionFlash(x, y);

    // Emit so NightScene applies actual damage
    this.scene.events.emit('bombardment-explosion', {
      x,
      y,
      radius: BOMBARDMENT_RADIUS,
      damage: BOMBARDMENT_DAMAGE,
    });
  }

  /**
   * Show an orange/yellow flash at a world-space position.
   * @param worldX World X coordinate
   * @param worldY World Y coordinate
   */
  private showExplosionFlash(worldX: number, worldY: number): void {
    const cam = this.scene.cameras.main;
    // Convert world position to screen position
    const sx = (worldX - cam.scrollX) * cam.zoom;
    const sy = (worldY - cam.scrollY) * cam.zoom;

    // Short-lived graphics object; destroyed after animation
    const flash = this.scene.add.graphics();
    flash.setScrollFactor(0);
    flash.setDepth(91);

    const radius = 40;
    flash.fillStyle(0xFF6600, 1);
    flash.fillCircle(sx, sy, radius);
    flash.setAlpha(0.85);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2.5,
      scaleY: 2.5,
      duration: 350,
      ease: 'Power2',
      onComplete: () => flash.destroy(),
    });
  }

  // ------------------------------------------------------------------
  // Event expiry
  // ------------------------------------------------------------------

  private expireEvent(id: string): void {
    this.scene.events.emit('night-event-expired', id);

    // Clean up event-specific visuals
    if (id === 'fog') {
      this.scene.tweens.add({
        targets: this.fogOverlay,
        alpha: 0,
        duration: 2000,
        onComplete: () => {
          this.fogOverlay?.destroy();
          this.fogOverlay = null;
        },
      });
    }
    if (id === 'power_outage') {
      this.removePowerOutageOverlay();
    }
  }

  // ------------------------------------------------------------------
  // Night start banner
  // ------------------------------------------------------------------

  /**
   * Display an event-name banner at the top of the screen for ~3 seconds.
   * Shows "NIGHT 3 -- FOGGY" style text for weather events, or special text
   * for Blood Moon. If no events are active, shows a plain "NIGHT X" banner.
   */
  private showNightBanner(): void {
    if (this.activeEvents.length === 0) return;

    const defs: NightEventDef[] = nightEventsData.events as NightEventDef[];

    // Resolve label string for each active event (in priority order)
    const labels: string[] = [];

    // Blood Moon gets its own banner first, then others
    const bloodMoon = this.activeEvents.find(e => e.id === 'blood_moon');
    if (bloodMoon) {
      labels.push('BLOOD MOON RISES');
    }

    // Add other event labels (fog, rain, storm, bombardment, power_outage)
    for (const ev of this.activeEvents) {
      if (ev.id === 'blood_moon') continue;
      const def = defs.find(d => d.id === ev.id);
      if (!def) continue;
      const label = def.label.replace('{n}', String(this.nightNumber));
      labels.push(label);
    }

    if (labels.length === 0) return;

    // Show banners sequentially: first label immediately, subsequent with delay
    labels.forEach((label, index) => {
      this.scene.time.delayedCall(index * 2800, () => {
        this.showSingleBanner(label, index === 0 && bloodMoon !== undefined);
      });
    });
  }

  /**
   * Show a single line banner with fade-in/hold/fade-out animation.
   * @param label Text to display
   * @param isBloodMoon Use blood moon styling (red, larger)
   */
  private showSingleBanner(label: string, isBloodMoon: boolean): void {
    const cx = GAME_WIDTH / 2;
    const cy = 60;

    const container = this.scene.add.container(0, 0)
      .setDepth(175)
      .setScrollFactor(0);

    // Background bar
    const barH = 32;
    const bar = this.scene.add.graphics();
    bar.fillStyle(isBloodMoon ? 0x2A0000 : 0x0A0A14, 0.88);
    bar.fillRect(0, cy - barH / 2, GAME_WIDTH, barH);
    bar.lineStyle(1, isBloodMoon ? 0xAA2200 : 0x446688, 0.7);
    bar.lineBetween(0, cy - barH / 2, GAME_WIDTH, cy - barH / 2);
    bar.lineBetween(0, cy + barH / 2, GAME_WIDTH, cy + barH / 2);
    container.add(bar);

    const fontSize = isBloodMoon ? '12px' : '9px';
    const color = isBloodMoon ? '#FF2200' : '#CCDDFF';

    const text = this.scene.add.text(cx, cy, label, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize,
      color,
    }).setOrigin(0.5, 0.5).setAlpha(0);
    container.add(text);

    this.scene.tweens.add({
      targets: container,
      alpha: { from: 0, to: 1 },
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        this.scene.time.delayedCall(2000, () => {
          this.scene.tweens.add({
            targets: container,
            alpha: 0,
            duration: 600,
            onComplete: () => container.destroy(),
          });
        });
      },
    });

    // Blood moon also shakes the camera slightly
    if (isBloodMoon) {
      this.scene.cameras.main.shake(400, 0.008);
    }
  }
}
