// PathGrid.ts -- Grid-based local steering for zombie navigation
// Zombies use this to navigate around walls and barricades without expensive A* pathfinding.
// Strategy: local "probe and turn" steering -- check nearby cells, pick the least blocked direction.

import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '../config/constants';
import type { NaturalBlockerRect, StructureInstance } from '../config/types';

// Structure types that physically block movement (wall bodies in physics)
const BLOCKING_STRUCTURE_IDS: ReadonlySet<string> = new Set([
  'wall',
  'cart_wall',
  'chain_wall',
  'barricade',
]);

// A normalized 2D direction vector returned by getSteeringDirection
export interface SteeringVector {
  x: number;
  y: number;
}

export class PathGrid {
  private readonly gridWidth: number;
  private readonly gridHeight: number;
  // Flat Uint8Array: 0 = walkable, 1 = blocked. Index = gridY * gridWidth + gridX.
  private grid: Uint8Array;

  constructor() {
    this.gridWidth = MAP_WIDTH;
    this.gridHeight = MAP_HEIGHT;
    this.grid = new Uint8Array(this.gridWidth * this.gridHeight);
  }

  /** Mark all blocking structures as occupied in the grid */
  updateFromStructures(structures: StructureInstance[]): void {
    // Reset grid to all walkable
    this.grid.fill(0);

    for (const s of structures) {
      if (!BLOCKING_STRUCTURE_IDS.has(s.structureId)) continue;

      // Convert world pixel position to tile index
      const tileX = Math.floor(s.x / TILE_SIZE);
      const tileY = Math.floor(s.y / TILE_SIZE);
      this.setBlocked(tileX, tileY);
    }
  }

  /**
   * Mark natural terrain blockers (building ruins, bunkers) as occupied.
   * Must be called AFTER updateFromStructures() so the grid is not reset.
   * Each rect is axis-aligned; all tiles overlapping the rect are marked blocked.
   */
  addNaturalBlockers(blockers: NaturalBlockerRect[]): void {
    for (const b of blockers) {
      // Convert AABB to tile range (inclusive)
      const tileLeft  = Math.floor((b.x - b.w / 2) / TILE_SIZE);
      const tileRight = Math.floor((b.x + b.w / 2) / TILE_SIZE);
      const tileTop   = Math.floor((b.y - b.h / 2) / TILE_SIZE);
      const tileBot   = Math.floor((b.y + b.h / 2) / TILE_SIZE);

      for (let ty = tileTop; ty <= tileBot; ty++) {
        for (let tx = tileLeft; tx <= tileRight; tx++) {
          this.setBlocked(tx, ty);
        }
      }
    }
  }

  /** Returns true if the given tile coordinate is blocked or out of bounds */
  isCellBlocked(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileX >= this.gridWidth || tileY < 0 || tileY >= this.gridHeight) {
      // Treat out-of-bounds as blocked so zombies stay on map
      return true;
    }
    return this.grid[tileY * this.gridWidth + tileX] === 1;
  }

  private setBlocked(tileX: number, tileY: number): void {
    if (tileX < 0 || tileX >= this.gridWidth || tileY < 0 || tileY >= this.gridHeight) return;
    this.grid[tileY * this.gridWidth + tileX] = 1;
  }

  /**
   * Local steering: returns a normalized direction vector that tries to steer
   * the entity from (fromX, fromY) toward (targetX, targetY) while avoiding
   * blocked cells in the immediate vicinity.
   *
   * Algorithm (runs every pathfind tick, NOT every frame -- controlled by Zombie.pathfindTimer):
   * 1. Compute the ideal angle toward the target.
   * 2. Build a set of candidate angles: ideal, then rotated by increments of 45 deg up to 135 deg.
   * 3. For each candidate, probe one tile ahead in that direction.
   * 4. Return the first unblocked direction. If all blocked (cornered), return direct-to-target fallback.
   *
   * This gives smooth wall-following behavior at very low CPU cost (no graph search).
   */
  getSteeringDirection(fromX: number, fromY: number, targetX: number, targetY: number): SteeringVector {
    const dx = targetX - fromX;
    const dy = targetY - fromY;

    // Already at target (avoid NaN from atan2)
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      return { x: 0, y: 0 };
    }

    const idealAngle = Math.atan2(dy, dx);

    // Probe distance: slightly more than one tile so zombies start turning before hitting the wall
    const probeDistance = TILE_SIZE * 1.2;

    // Candidate angles: ideal direction first, then rotate left/right by 45, 90, 135 degrees
    // Alternating left/right gives unbiased turning
    const offsets = [0, -Math.PI / 4, Math.PI / 4, -Math.PI / 2, Math.PI / 2, -(3 * Math.PI) / 4, (3 * Math.PI) / 4];

    for (const offset of offsets) {
      const angle = idealAngle + offset;
      const probeX = fromX + Math.cos(angle) * probeDistance;
      const probeY = fromY + Math.sin(angle) * probeDistance;

      const tileX = Math.floor(probeX / TILE_SIZE);
      const tileY = Math.floor(probeY / TILE_SIZE);

      if (!this.isCellBlocked(tileX, tileY)) {
        // This direction is clear -- return it normalized
        return {
          x: Math.cos(angle),
          y: Math.sin(angle),
        };
      }
    }

    // All probed directions blocked (zombie is surrounded by walls).
    // Fall back to raw direction toward target so physics can push them out.
    const len = Math.sqrt(dx * dx + dy * dy);
    return { x: dx / len, y: dy / len };
  }
}
