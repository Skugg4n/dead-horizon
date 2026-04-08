// PathGrid.ts -- A* pathfinding using PathFinding.js library
// Replaces homegrown BFS flowfield with battle-tested A* implementation.
// Key features: diagonal movement, corner-cutting prevention, path caching.

import PF from 'pathfinding';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '../config/constants';
import type { NaturalBlockerRect, StructureInstance } from '../config/types';

// Structure types that physically block movement
const BLOCKING_STRUCTURE_IDS: ReadonlySet<string> = new Set([
  'wall',
  'cart_wall',
  'chain_wall',
  'barricade',
  'electric_fence',
  'shopping_cart_wall',
  'car_wreck_barrier',
  'dumpster_fortress',
]);

export interface SteeringVector {
  x: number;
  y: number;
}

export class PathGrid {
  private readonly gridWidth: number;
  private readonly gridHeight: number;
  private pfGrid: PF.Grid;
  private finder: PF.AStarFinder;

  // Path cache: key = "tileX,tileY", value = next step direction
  private directionCache: Map<string, SteeringVector> = new Map();

  constructor() {
    this.gridWidth = MAP_WIDTH;
    this.gridHeight = MAP_HEIGHT;
    this.pfGrid = new PF.Grid(this.gridWidth, this.gridHeight);
    this.finder = new PF.AStarFinder({
      allowDiagonal: true,
      dontCrossCorners: true, // prevents corner-cutting through diagonal walls
      heuristic: PF.Heuristic.octile,
    } as PF.FinderOptions);
  }

  /** Mark all blocking structures as unwalkable */
  updateFromStructures(structures: StructureInstance[]): void {
    // Reset all cells to walkable
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        this.pfGrid.setWalkableAt(x, y, true);
      }
    }

    for (const s of structures) {
      if (!BLOCKING_STRUCTURE_IDS.has(s.structureId)) continue;
      const tileX = Math.floor(s.x / TILE_SIZE);
      const tileY = Math.floor(s.y / TILE_SIZE);
      if (tileX >= 0 && tileX < this.gridWidth && tileY >= 0 && tileY < this.gridHeight) {
        this.pfGrid.setWalkableAt(tileX, tileY, false);
      }
    }

    this.directionCache.clear();
  }

  /** Mark natural terrain blockers (building ruins, bunkers) */
  addNaturalBlockers(blockers: NaturalBlockerRect[]): void {
    for (const b of blockers) {
      const tileLeft = Math.floor((b.x - b.w / 2) / TILE_SIZE);
      const tileRight = Math.floor((b.x + b.w / 2) / TILE_SIZE);
      const tileTop = Math.floor((b.y - b.h / 2) / TILE_SIZE);
      const tileBot = Math.floor((b.y + b.h / 2) / TILE_SIZE);

      for (let ty = tileTop; ty <= tileBot; ty++) {
        for (let tx = tileLeft; tx <= tileRight; tx++) {
          if (tx >= 0 && tx < this.gridWidth && ty >= 0 && ty < this.gridHeight) {
            this.pfGrid.setWalkableAt(tx, ty, false);
          }
        }
      }
    }
    this.directionCache.clear();
  }

  /** Check if a cell is blocked */
  isCellBlocked(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileX >= this.gridWidth || tileY < 0 || tileY >= this.gridHeight) return true;
    return !this.pfGrid.isWalkableAt(tileX, tileY);
  }

  /** Clear direction cache -- called when structures change */
  rebuildFlowfield(_baseCenterX: number, _baseCenterY: number): void {
    this.directionCache.clear();
    // Cache is built lazily on first query -- avoids computing paths for cells no zombie visits
  }

  // Kept for backward compatibility -- same as rebuildFlowfield
  computeFlowfield(targetX: number, targetY: number): void {
    this.rebuildFlowfield(targetX, targetY);
  }

  /**
   * Get steering direction for a zombie at (fromX, fromY) toward the base.
   * Uses A* pathfinding with result caching per tile.
   */
  getSteeringDirection(fromX: number, fromY: number, targetX: number, targetY: number): SteeringVector {
    const dx = targetX - fromX;
    const dy = targetY - fromY;

    // Already at target
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      return { x: 0, y: 0 };
    }

    const fromTileX = Math.max(0, Math.min(this.gridWidth - 1, Math.floor(fromX / TILE_SIZE)));
    const fromTileY = Math.max(0, Math.min(this.gridHeight - 1, Math.floor(fromY / TILE_SIZE)));

    const toTileX = Math.max(0, Math.min(this.gridWidth - 1, Math.floor(targetX / TILE_SIZE)));
    const toTileY = Math.max(0, Math.min(this.gridHeight - 1, Math.floor(targetY / TILE_SIZE)));

    // Same tile as target -- go straight
    if (fromTileX === toTileX && fromTileY === toTileY) {
      const len = Math.sqrt(dx * dx + dy * dy);
      return len > 0 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
    }

    // Check direction cache
    const cacheKey = `${fromTileX},${fromTileY}`;
    const cached = this.directionCache.get(cacheKey);
    if (cached) return cached;

    // Compute A* path (grid.clone() required -- PathFinding.js mutates the grid)
    try {
      const path = this.finder.findPath(
        fromTileX, fromTileY,
        toTileX, toTileY,
        this.pfGrid.clone()
      );

      if (path.length >= 2) {
        // Next step is path[1] (path[0] is current position)
        const nextStep = path[1] as number[] | undefined;
        if (nextStep && nextStep.length >= 2) {
          const stepDx = (nextStep[0] ?? fromTileX) - fromTileX;
          const stepDy = (nextStep[1] ?? fromTileY) - fromTileY;
          // Normalize (diagonal = 0.707, cardinal = 1.0)
          const len = Math.sqrt(stepDx * stepDx + stepDy * stepDy);
          const dir: SteeringVector = len > 0
            ? { x: stepDx / len, y: stepDy / len }
            : { x: 0, y: 0 };

          // Cache result
          this.directionCache.set(cacheKey, dir);
          return dir;
        }
      }
    } catch {
      // A* failed (shouldn't happen but be safe)
    }

    // No path found -- zombie is enclosed or something weird. Go straight.
    const len = Math.sqrt(dx * dx + dy * dy);
    const fallback: SteeringVector = len > 0 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
    this.directionCache.set(cacheKey, fallback);
    return fallback;
  }
}
