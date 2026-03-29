import Phaser from 'phaser';
import type { GameState } from '../config/types';
import { FOG_BLOCK_SIZE } from '../config/constants';

/**
 * FogOfWar system for NightScene.
 * Grid-based overlay that hides unexplored areas.
 * Revealed areas: circle around base (radius based on base level) + explored destinations.
 * Zombies outside revealed area are hidden but still active.
 */
export class FogOfWar {
  private gameState: GameState;
  private graphics: Phaser.GameObjects.Graphics;
  private gridWidth: number;
  private gridHeight: number;
  private revealed: boolean[][];
  private dirty: boolean = true;

  // Base center in fog grid coordinates
  private baseCenterGridX: number;
  private baseCenterGridY: number;

  // Fog radius in blocks (from base-levels.json)
  private fogRadius: number;

  // Safe grid access -- bounds already checked by callers
  private getCell(gy: number, gx: number): boolean {
    const row = this.revealed[gy];
    return row ? (row[gx] ?? false) : false;
  }

  private setCell(gy: number, gx: number, value: boolean): void {
    const row = this.revealed[gy];
    if (row) row[gx] = value;
  }

  constructor(
    scene: Phaser.Scene,
    gameState: GameState,
    mapPixelWidth: number,
    mapPixelHeight: number,
    fogRadius: number
  ) {
    this.gameState = gameState;
    this.fogRadius = fogRadius;

    this.gridWidth = Math.ceil(mapPixelWidth / FOG_BLOCK_SIZE);
    this.gridHeight = Math.ceil(mapPixelHeight / FOG_BLOCK_SIZE);

    // Initialize revealed grid from game state or create new
    if (gameState.map.fogOfWar.length === this.gridHeight &&
        gameState.map.fogOfWar[0] &&
        gameState.map.fogOfWar[0].length === this.gridWidth) {
      this.revealed = gameState.map.fogOfWar.map(row => [...row]);
    } else {
      this.revealed = Array.from({ length: this.gridHeight }, () =>
        Array.from({ length: this.gridWidth }, () => false)
      );
    }

    // Calculate base center in fog grid coords
    this.baseCenterGridX = Math.floor((mapPixelWidth / 2) / FOG_BLOCK_SIZE);
    this.baseCenterGridY = Math.floor((mapPixelHeight / 2) / FOG_BLOCK_SIZE);

    // Reveal area around base
    this.revealAroundBase();

    // Create graphics object for fog rendering
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(80);

    this.redraw();
  }

  /** Reveal cells in a circle around the base */
  private revealAroundBase(): void {
    const r = this.fogRadius;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          const gx = this.baseCenterGridX + dx;
          const gy = this.baseCenterGridY + dy;
          if (gx >= 0 && gx < this.gridWidth && gy >= 0 && gy < this.gridHeight) {
            this.setCell(gy, gx, true);
          }
        }
      }
    }
    this.dirty = true;
  }

  /** Reveal a specific grid cell (e.g., from loot runs) */
  revealCell(gridX: number, gridY: number): void {
    if (gridX >= 0 && gridX < this.gridWidth && gridY >= 0 && gridY < this.gridHeight) {
      if (!this.getCell(gridY, gridX)) {
        this.setCell(gridY, gridX, true);
        this.dirty = true;
      }
    }
  }

  /** Check if a world position is in a revealed area */
  isRevealed(worldX: number, worldY: number): boolean {
    const gx = Math.floor(worldX / FOG_BLOCK_SIZE);
    const gy = Math.floor(worldY / FOG_BLOCK_SIZE);
    if (gx < 0 || gx >= this.gridWidth || gy < 0 || gy >= this.gridHeight) {
      return false;
    }
    return this.getCell(gy, gx);
  }

  /** Check if a world position is near the fog boundary (within N blocks of revealed edge) */
  isNearFogEdge(worldX: number, worldY: number, blocks: number): boolean {
    const gx = Math.floor(worldX / FOG_BLOCK_SIZE);
    const gy = Math.floor(worldY / FOG_BLOCK_SIZE);

    // Must be in unrevealed area
    if (this.isRevealed(worldX, worldY)) return false;

    // Check if any revealed cell is within 'blocks' distance
    for (let dy = -blocks; dy <= blocks; dy++) {
      for (let dx = -blocks; dx <= blocks; dx++) {
        const cx = gx + dx;
        const cy = gy + dy;
        if (cx >= 0 && cx < this.gridWidth && cy >= 0 && cy < this.gridHeight) {
          if (this.getCell(cy, cx)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /** Get the direction from the nearest fog edge toward a hidden zombie */
  getFogEdgeDirection(zombieX: number, zombieY: number): { x: number; y: number; edgeX: number; edgeY: number } | null {
    const gx = Math.floor(zombieX / FOG_BLOCK_SIZE);
    const gy = Math.floor(zombieY / FOG_BLOCK_SIZE);

    // Find the nearest revealed cell
    let nearestDist = Infinity;
    let nearestX = 0;
    let nearestY = 0;

    const searchRange = 5;
    for (let dy = -searchRange; dy <= searchRange; dy++) {
      for (let dx = -searchRange; dx <= searchRange; dx++) {
        const cx = gx + dx;
        const cy = gy + dy;
        if (cx >= 0 && cx < this.gridWidth && cy >= 0 && cy < this.gridHeight) {
          if (this.getCell(cy, cx)) {
            const dist = dx * dx + dy * dy;
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestX = cx;
              nearestY = cy;
            }
          }
        }
      }
    }

    if (nearestDist === Infinity) return null;

    // Direction from edge toward zombie
    const edgeWorldX = nearestX * FOG_BLOCK_SIZE + FOG_BLOCK_SIZE / 2;
    const edgeWorldY = nearestY * FOG_BLOCK_SIZE + FOG_BLOCK_SIZE / 2;
    const dx = zombieX - edgeWorldX;
    const dy = zombieY - edgeWorldY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return null;

    return {
      x: dx / len,
      y: dy / len,
      edgeX: edgeWorldX,
      edgeY: edgeWorldY,
    };
  }

  /** Redraw the fog overlay -- only when dirty flag is set.
   *  NOTE: Visual fog rendering is disabled because NightScene's
   *  lighting overlay already provides darkness. FogOfWar only
   *  handles zombie visibility and directional indicators now. */
  private redraw(): void {
    this.graphics.clear();
    // Fog graphics disabled -- lighting overlay handles darkness.
    // Zombie visibility is still controlled by isRevealed().
    this.dirty = false;
  }

  /**
   * Update zombie visibility based on fog.
   * Called each frame from NightScene.
   * Also draws directional indicators for nearby hidden zombies.
   */
  updateZombieVisibility(zombieGroup: Phaser.Physics.Arcade.Group, indicatorGraphics: Phaser.GameObjects.Graphics): void {
    indicatorGraphics.clear();

    zombieGroup.getChildren().forEach(child => {
      const zombie = child as Phaser.Physics.Arcade.Sprite;
      if (!zombie.active) return;

      const visible = this.isRevealed(zombie.x, zombie.y);
      zombie.setVisible(visible);

      // Draw directional indicator for hidden zombies near fog edge
      if (!visible && this.isNearFogEdge(zombie.x, zombie.y, 3)) {
        const dir = this.getFogEdgeDirection(zombie.x, zombie.y);
        if (dir) {
          // Draw arrow at fog edge pointing toward hidden zombie
          const arrowSize = 8;
          const ax = dir.edgeX;
          const ay = dir.edgeY;

          indicatorGraphics.fillStyle(0xFF4444, 0.7);
          // Triangle pointing in the direction of the zombie
          const angle = Math.atan2(dir.y, dir.x);
          const tipX = ax + Math.cos(angle) * arrowSize;
          const tipY = ay + Math.sin(angle) * arrowSize;
          const leftX = ax + Math.cos(angle + 2.5) * arrowSize * 0.6;
          const leftY = ay + Math.sin(angle + 2.5) * arrowSize * 0.6;
          const rightX = ax + Math.cos(angle - 2.5) * arrowSize * 0.6;
          const rightY = ay + Math.sin(angle - 2.5) * arrowSize * 0.6;

          indicatorGraphics.fillTriangle(tipX, tipY, leftX, leftY, rightX, rightY);
        }
      }
    });
  }

  /** Sync revealed state back to GameState for saving */
  syncToState(): void {
    this.gameState.map.fogOfWar = this.revealed.map(row => [...row]);
  }

  /** Force a redraw if dirty */
  update(): void {
    if (this.dirty) {
      this.redraw();
    }
  }

  getGraphics(): Phaser.GameObjects.Graphics {
    return this.graphics;
  }
}
