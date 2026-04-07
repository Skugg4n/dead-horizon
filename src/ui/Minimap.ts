import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/constants';

// Minimap display dimensions
const MINIMAP_W = 120;
const MINIMAP_H = 90;
// Position: top-right corner, below wave panel
const MINIMAP_X = GAME_WIDTH - 130;
const MINIMAP_Y = 40;

// Update interval in milliseconds -- not every frame, only twice per second
const UPDATE_INTERVAL_MS = 500;

// Dot colors
const COLOR_ZOMBIE = 0xff2222;
const COLOR_STRUCTURE = 0x44ff44;
const COLOR_BASE = 0xffffff;
const COLOR_PLAYER = 0x66aaff;
const COLOR_BG = 0x111111;
const COLOR_BORDER = 0x555555;

/** Structure data passed to the minimap for rendering. */
export interface MinimapStructurePoint {
  x: number;
  y: number;
  active: boolean;
}

/**
 * Minimap component for the night phase.
 * Renders a scaled-down overview of the map including zombies, structures, base and player.
 * Updates at 500ms intervals for performance -- not every frame.
 */
export class Minimap {
  private container: Phaser.GameObjects.Container;
  private graphics: Phaser.GameObjects.Graphics;

  // World dimensions used for scaling world coords -> minimap coords
  private mapPixelWidth: number;
  private mapPixelHeight: number;

  // Accumulated time since last render
  private timeSinceUpdate: number = 0;

  // Cache last known positions so we can redraw without re-collecting data
  private lastPlayerX: number = 0;
  private lastPlayerY: number = 0;
  private lastBaseX: number = 0;
  private lastBaseY: number = 0;
  private lastZombies: Array<{ x: number; y: number }> = [];
  private lastStructures: MinimapStructurePoint[] = [];

  constructor(scene: Phaser.Scene, mapWidth: number, mapHeight: number) {
    this.mapPixelWidth = mapWidth;
    this.mapPixelHeight = mapHeight;

    this.container = scene.add.container(MINIMAP_X, MINIMAP_Y);
    // Fixed to screen -- does not scroll with camera
    this.container.setScrollFactor(0);
    // Depth 150: above game world, below menus
    this.container.setDepth(150);

    // Background panel (semi-transparent dark)
    const bg = scene.add.graphics();
    bg.fillStyle(COLOR_BG, 0.7);
    bg.fillRect(0, 0, MINIMAP_W, MINIMAP_H);
    bg.lineStyle(1, COLOR_BORDER, 1);
    bg.strokeRect(0, 0, MINIMAP_W, MINIMAP_H);
    this.container.add(bg);

    // Graphics object used for all dot rendering (cleared and redrawn each update)
    this.graphics = scene.add.graphics();
    this.container.add(this.graphics);
  }

  /**
   * Update minimap data. Call this every frame from NightScene.update().
   * Actual re-render only happens every UPDATE_INTERVAL_MS milliseconds.
   *
   * @param playerX - Player world X position
   * @param playerY - Player world Y position
   * @param zombies - Phaser Group containing active Zombie game objects
   * @param structures - Array of structure positions and active state
   * @param baseX - Base center world X position
   * @param baseY - Base center world Y position
   * @param delta - Frame delta in milliseconds
   */
  update(
    playerX: number,
    playerY: number,
    zombies: Phaser.GameObjects.Group,
    structures: MinimapStructurePoint[],
    baseX: number,
    baseY: number,
    delta: number,
  ): void {
    this.timeSinceUpdate += delta;
    if (this.timeSinceUpdate < UPDATE_INTERVAL_MS) return;
    this.timeSinceUpdate = 0;

    // Collect zombie positions (only active ones)
    this.lastZombies = (zombies.getChildren() as Phaser.GameObjects.GameObject[])
      .filter(c => (c as Phaser.GameObjects.Sprite).active)
      .map(c => {
        const sprite = c as Phaser.GameObjects.Sprite;
        return { x: sprite.x, y: sprite.y };
      });

    this.lastStructures = structures;
    this.lastPlayerX = playerX;
    this.lastPlayerY = playerY;
    this.lastBaseX = baseX;
    this.lastBaseY = baseY;

    this.render();
  }

  /** Convert a world X coordinate to minimap local X. */
  private toMapX(worldX: number): number {
    return (worldX / this.mapPixelWidth) * MINIMAP_W;
  }

  /** Convert a world Y coordinate to minimap local Y. */
  private toMapY(worldY: number): number {
    return (worldY / this.mapPixelHeight) * MINIMAP_H;
  }

  /** Clamp a value within minimap bounds. */
  private clampX(x: number): number {
    return Math.max(0, Math.min(MINIMAP_W - 1, x));
  }

  private clampY(y: number): number {
    return Math.max(0, Math.min(MINIMAP_H - 1, y));
  }

  /** Redraw all dots using cached position data. */
  private render(): void {
    this.graphics.clear();

    // Draw structures as 2x2 green rectangles
    this.graphics.fillStyle(COLOR_STRUCTURE, 0.9);
    for (const s of this.lastStructures) {
      if (!s.active) continue;
      const mx = this.clampX(this.toMapX(s.x));
      const my = this.clampY(this.toMapY(s.y));
      this.graphics.fillRect(mx - 1, my - 1, 2, 2);
    }

    // Draw zombies as 1x1 red dots -- simple and cheap
    this.graphics.fillStyle(COLOR_ZOMBIE, 1);
    for (const z of this.lastZombies) {
      const mx = this.clampX(this.toMapX(z.x));
      const my = this.clampY(this.toMapY(z.y));
      this.graphics.fillRect(mx, my, 1, 1);
    }

    // Draw base as white circle (radius 3)
    if (this.lastBaseX !== 0 || this.lastBaseY !== 0) {
      const bx = this.clampX(this.toMapX(this.lastBaseX));
      const by = this.clampY(this.toMapY(this.lastBaseY));
      this.graphics.fillStyle(COLOR_BASE, 1);
      this.graphics.fillCircle(bx, by, 3);
    }

    // Draw player as light-blue circle (radius 2)
    const px = this.clampX(this.toMapX(this.lastPlayerX));
    const py = this.clampY(this.toMapY(this.lastPlayerY));
    this.graphics.fillStyle(COLOR_PLAYER, 1);
    this.graphics.fillCircle(px, py, 2);
  }

  /** Show the minimap. */
  show(): void {
    this.container.setVisible(true);
  }

  /** Hide the minimap. */
  hide(): void {
    this.container.setVisible(false);
  }

  /** Toggle minimap visibility. Returns new visible state. */
  toggle(): boolean {
    const next = !this.container.visible;
    this.container.setVisible(next);
    return next;
  }

  /** Returns the Phaser container that holds the minimap. */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
}
