import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';

/**
 * ShadowSystem -- dynamic sun shadows for all placed structures and decorations.
 *
 * Each registered shadow caster gets a soft dark ellipse drawn underneath it.
 * The ellipse offset and stretch change based on the current "sun position"
 * derived from remaining AP hours:
 *
 *   17-14h (morning)  : sun low in east  -> shadow stretches LEFT
 *   14-8h  (midday)   : sun high         -> shadow short, centered
 *   8-3h   (afternoon): sun low in west  -> shadow stretches RIGHT
 *   3-0h   (evening)  : sun very low west -> long shadow RIGHT, dimmer
 *
 * The system redraws only when the hour changes (not every frame).
 */

interface ShadowCaster {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Shadow visual tuning
const SHADOW_ALPHA = 0.22;
const SHADOW_COLOR = 0x000000;
const MAX_SHADOW_OFFSET_X = 14; // pixels at longest stretch
const MIN_SHADOW_SCALE_X = 0.7; // ellipse width multiplier at midday
const MAX_SHADOW_SCALE_X = 1.6; // ellipse width multiplier at morning/evening
const SHADOW_Y_OFFSET = 4;      // always slightly below the object

export class ShadowSystem {
  private graphics: Phaser.GameObjects.Graphics;
  private casters: ShadowCaster[] = [];
  private lastHour: number = -1;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(1); // just above ground, below structures
  }

  /** Register a shadow caster (structure, tree, decoration). */
  addCaster(x: number, y: number, width: number = TILE_SIZE, height: number = TILE_SIZE): void {
    this.casters.push({ x, y, width, height });
  }

  /** Register multiple casters from structure instances. */
  addStructureCasters(structures: Array<{ x: number; y: number; widthTiles?: number; rotation?: number }>): void {
    for (const s of structures) {
      const tiles = s.widthTiles ?? 1;
      const isVertical = s.rotation === 1;
      const w = isVertical ? TILE_SIZE : tiles * TILE_SIZE;
      const h = isVertical ? tiles * TILE_SIZE : TILE_SIZE;
      this.casters.push({ x: s.x, y: s.y, width: w, height: h });
    }
  }

  /** Update shadows based on current hour (AP remaining). Only redraws on change. */
  update(currentAP: number): void {
    const hour = Math.floor(currentAP);
    if (hour === this.lastHour) return;
    this.lastHour = hour;
    this.redraw(currentAP);
  }

  /** Force a full redraw. */
  redraw(currentAP: number): void {
    this.graphics.clear();

    // Sun position: 0 = far east (morning), 0.5 = zenith, 1 = far west (evening)
    // Map AP hours to sun position: 17h = sunrise (0.0), ~10h = zenith (0.5), 0h = sunset (1.0)
    const maxAP = 17;
    const sunProgress = 1 - (currentAP / maxAP); // 0 at 17h, 1 at 0h

    // Shadow X offset: negative = left (morning), 0 = midday, positive = right (afternoon)
    // Use a sine curve so it sweeps smoothly
    const shadowAngle = (sunProgress - 0.5) * Math.PI; // -PI/2 to PI/2
    const offsetX = Math.sin(shadowAngle) * MAX_SHADOW_OFFSET_X;

    // Shadow length: longest at sunrise/sunset, shortest at midday
    const distFromZenith = Math.abs(sunProgress - 0.5) * 2; // 0 at midday, 1 at edges
    const scaleX = MIN_SHADOW_SCALE_X + (MAX_SHADOW_SCALE_X - MIN_SHADOW_SCALE_X) * distFromZenith;

    // Alpha: slightly dimmer in evening
    const alpha = sunProgress > 0.8
      ? SHADOW_ALPHA * (1 - (sunProgress - 0.8) * 2.5) // fade out 0.8->1.0
      : SHADOW_ALPHA;

    if (alpha <= 0.01) return;

    this.graphics.fillStyle(SHADOW_COLOR, alpha);

    for (const c of this.casters) {
      const cx = c.x + c.width / 2 + offsetX;
      const cy = c.y + c.height + SHADOW_Y_OFFSET;
      const rx = (c.width / 2) * scaleX;
      const ry = c.height * 0.25;
      this.graphics.fillEllipse(cx, cy, rx * 2, ry * 2);
    }
  }

  /** Get the underlying graphics object for camera/container management. */
  getGraphics(): Phaser.GameObjects.Graphics {
    return this.graphics;
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
