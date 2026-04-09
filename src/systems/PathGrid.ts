// PathGrid.ts -- A* pathfinding using PathFinding.js library
// Replaces homegrown BFS flowfield with battle-tested A* implementation.
// Key features: diagonal movement, corner-cutting prevention, path caching.

import Phaser from 'phaser';
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

  /**
   * Mark every static physics body in a Phaser StaticGroup as unwalkable.
   * Used for terrain colliders (trees, large stones) that are not in the
   * structures array but still block movement. Without this, A* plots
   * paths straight through trees and zombies get stuck colliding with them.
   */
  addColliderGroup(group: Phaser.Physics.Arcade.StaticGroup | null | undefined): void {
    if (!group) return;
    const children = group.getChildren();
    for (const child of children) {
      const body = (child as Phaser.GameObjects.GameObject & { body?: Phaser.Physics.Arcade.StaticBody | Phaser.Physics.Arcade.Body | null }).body;
      if (!body) continue;
      // Both Body and StaticBody expose x/y/width/height in pixel coordinates.
      const bx = body.x;
      const by = body.y;
      const bw = body.width;
      const bh = body.height;
      const tileLeft = Math.floor(bx / TILE_SIZE);
      const tileRight = Math.floor((bx + bw) / TILE_SIZE);
      const tileTop = Math.floor(by / TILE_SIZE);
      const tileBot = Math.floor((by + bh) / TILE_SIZE);
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

  /** Expose grid dimensions for debug overlays */
  getGridDimensions(): { width: number; height: number } {
    return { width: this.gridWidth, height: this.gridHeight };
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
   * Find the nearest walkable tile to a target tile using a spiral search.
   * Used when the path target itself is on a blocked cell (e.g. base center
   * sitting on top of a structure tile). Without this, A* finds no path and
   * zombies fall back to "walk straight into the wall" behavior.
   */
  private nearestWalkableTile(tx: number, ty: number, maxRadius: number = 8): { x: number; y: number } | null {
    if (tx >= 0 && tx < this.gridWidth && ty >= 0 && ty < this.gridHeight && this.pfGrid.isWalkableAt(tx, ty)) {
      return { x: tx, y: ty };
    }
    for (let r = 1; r <= maxRadius; r++) {
      for (let oy = -r; oy <= r; oy++) {
        for (let ox = -r; ox <= r; ox++) {
          // Only check the ring at distance r
          if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
          const nx = tx + ox;
          const ny = ty + oy;
          if (nx < 0 || nx >= this.gridWidth || ny < 0 || ny >= this.gridHeight) continue;
          if (this.pfGrid.isWalkableAt(nx, ny)) return { x: nx, y: ny };
        }
      }
    }
    return null;
  }

  /**
   * Get steering direction for a zombie at (fromX, fromY) toward the base.
   * Uses A* pathfinding with result caching per tile.
   *
   * Cache invariant: ONLY successful A* paths are cached. Fallback "go straight"
   * results are NEVER cached, otherwise zombies stuck against a wall would
   * forever receive the same broken direction.
   */
  getSteeringDirection(fromX: number, fromY: number, targetX: number, targetY: number): SteeringVector {
    const dx = targetX - fromX;
    const dy = targetY - fromY;

    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      return { x: 0, y: 0 };
    }

    const fromTileX = Math.max(0, Math.min(this.gridWidth - 1, Math.floor(fromX / TILE_SIZE)));
    const fromTileY = Math.max(0, Math.min(this.gridHeight - 1, Math.floor(fromY / TILE_SIZE)));

    const rawToTileX = Math.max(0, Math.min(this.gridWidth - 1, Math.floor(targetX / TILE_SIZE)));
    const rawToTileY = Math.max(0, Math.min(this.gridHeight - 1, Math.floor(targetY / TILE_SIZE)));

    // If target tile is blocked (e.g. base center sits on a wall/shelter cell),
    // re-target to the nearest walkable tile so A* can find SOMETHING. Otherwise
    // every path fails and zombies just walk into the nearest wall forever.
    let toTileX = rawToTileX;
    let toTileY = rawToTileY;
    if (!this.pfGrid.isWalkableAt(rawToTileX, rawToTileY)) {
      const nearest = this.nearestWalkableTile(rawToTileX, rawToTileY, 8);
      if (nearest) {
        toTileX = nearest.x;
        toTileY = nearest.y;
      }
    }

    if (fromTileX === toTileX && fromTileY === toTileY) {
      const len = Math.sqrt(dx * dx + dy * dy);
      return len > 0 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
    }

    // Cache key includes target so different targets don't poison each other.
    const cacheKey = `${fromTileX},${fromTileY}->${toTileX},${toTileY}`;
    if (this.directionCache.size > 400) this.directionCache.clear();
    const cached = this.directionCache.get(cacheKey);
    if (cached) return cached;

    let startX = fromTileX;
    let startY = fromTileY;
    if (!this.pfGrid.isWalkableAt(startX, startY)) {
      const nearest = this.nearestWalkableTile(startX, startY, 4);
      if (nearest) {
        startX = nearest.x;
        startY = nearest.y;
      } else {
        // Fully surrounded -- go straight (NOT cached)
        const len = Math.sqrt(dx * dx + dy * dy);
        return len > 0 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
      }
    }

    try {
      const path = this.finder.findPath(
        startX, startY,
        toTileX, toTileY,
        this.pfGrid.clone()
      );

      if (path.length >= 2) {
        const nextStep = path[1] as number[] | undefined;
        if (nextStep && nextStep.length >= 2) {
          const stepDx = (nextStep[0] ?? fromTileX) - fromTileX;
          const stepDy = (nextStep[1] ?? fromTileY) - fromTileY;
          const len = Math.sqrt(stepDx * stepDx + stepDy * stepDy);
          const dir: SteeringVector = len > 0
            ? { x: stepDx / len, y: stepDy / len }
            : { x: 0, y: 0 };

          // Cache only SUCCESSFUL A* results
          this.directionCache.set(cacheKey, dir);
          return dir;
        }
      }
    } catch {
      // A* failed -- fall through
    }

    // No path found -- DO NOT cache. Caller retries next frame.
    const len = Math.sqrt(dx * dx + dy * dy);
    return len > 0 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
  }
}
