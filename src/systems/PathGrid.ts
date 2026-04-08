// PathGrid.ts -- BFS flowfield navigation for zombie pathfinding
// Strategy: precompute a flowfield from the base outward (BFS). Each cell stores a
// direction vector pointing toward the shortest path to the base. Zombies look up
// their current cell's vector -- O(1) per query. BFS is rebuilt only when structures
// change (wall placed or destroyed), not every frame.

import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE } from '../config/constants';
import type { NaturalBlockerRect, StructureInstance } from '../config/types';

// Structure types that physically block movement (wall bodies in physics)
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

  // Flowfield: 2 floats per cell (dx, dy). Packed as [dx0, dy0, dx1, dy1, ...].
  // Unvisited cells are (0, 0) -- flowfield is invalid/not computed for that cell.
  // Built by computeFlowfield(); used by getSteeringDirection().
  private flowfield: Float32Array;

  // True if flowfield has been computed at least once and is valid
  private flowfieldReady: boolean = false;

  constructor() {
    this.gridWidth = MAP_WIDTH;
    this.gridHeight = MAP_HEIGHT;
    this.grid = new Uint8Array(this.gridWidth * this.gridHeight);
    // 2 floats per cell (dx, dy)
    this.flowfield = new Float32Array(this.gridWidth * this.gridHeight * 2);
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
   * Compute a BFS flowfield from the target cell outward.
   * Every reachable cell gets a (dx, dy) unit vector pointing toward the
   * neighbor that is one step closer to the target along the shortest path.
   *
   * Grid: 40x30 = 1200 cells -- BFS completes in ~0.1ms. Run only on demand,
   * never every frame.
   *
   * @param targetX  World-pixel X of the target (base center)
   * @param targetY  World-pixel Y of the target (base center)
   */
  computeFlowfield(targetX: number, targetY: number): void {
    const totalCells = this.gridWidth * this.gridHeight;

    // Reset flowfield to zero (unvisited)
    this.flowfield.fill(0);

    const targetTX = Math.floor(targetX / TILE_SIZE);
    const targetTY = Math.floor(targetY / TILE_SIZE);

    // Clamp target to grid bounds
    const clampedTX = Math.max(0, Math.min(this.gridWidth - 1, targetTX));
    const clampedTY = Math.max(0, Math.min(this.gridHeight - 1, targetTY));

    // visited[index] = true if BFS has processed this cell
    const visited = new Uint8Array(totalCells);

    // BFS queue: store flat cell indices (gridY * gridWidth + gridX)
    // Max queue size = total cells. Use a simple circular buffer for O(1) enqueue/dequeue.
    const queue = new Int32Array(totalCells);
    let head = 0;
    let tail = 0;

    // Seed: start BFS at the target cell
    const startIdx = clampedTY * this.gridWidth + clampedTX;
    queue[tail++] = startIdx;
    visited[startIdx] = 1;
    // Target cell direction: no movement needed (0, 0) -- already initialized to 0

    // 8-connectivity: cardinals + diagonals
    // Diagonals help zombies navigate corners smoothly instead of getting stuck
    const dirs: Array<[number, number]> = [
      [0, -1],  // up
      [0,  1],  // down
      [-1, 0],  // left
      [1,  0],  // right
      [-1, -1], // up-left
      [1, -1],  // up-right
      [-1, 1],  // down-left
      [1,  1],  // down-right
    ];

    while (head < tail) {
      const idx = queue[head++];
      // noUncheckedIndexedAccess: Int32Array index access returns number | undefined
      if (idx === undefined) break;
      const cx = idx % this.gridWidth;
      const cy = Math.floor(idx / this.gridWidth);

      for (const [ddx, ddy] of dirs) {
        const nx = cx + ddx;
        const ny = cy + ddy;

        // Bounds check
        if (nx < 0 || nx >= this.gridWidth || ny < 0 || ny >= this.gridHeight) continue;

        const nIdx = ny * this.gridWidth + nx;

        // Skip if already visited or blocked
        if (visited[nIdx] || this.grid[nIdx] === 1) continue;

        // Diagonal: both adjacent cardinal cells must be clear (no corner-cutting)
        if (ddx !== 0 && ddy !== 0) {
          const adj1 = cy * this.gridWidth + nx; // horizontal neighbor
          const adj2 = ny * this.gridWidth + cx; // vertical neighbor
          if (this.grid[adj1] === 1 || this.grid[adj2] === 1) continue;
        }

        visited[nIdx] = 1;

        // The neighbor's direction points BACK toward the current cell.
        // Normalize diagonals to unit length (cardinal = 1, diagonal = 0.707)
        const isDiag = ddx !== 0 && ddy !== 0;
        const norm = isDiag ? 0.7071 : 1;
        this.flowfield[nIdx * 2]     = -ddx * norm;
        this.flowfield[nIdx * 2 + 1] = -ddy * norm;

        queue[tail++] = nIdx;
      }
    }

    this.flowfieldReady = true;
  }

  /**
   * Rebuild the flowfield after structures change (wall placed or destroyed).
   * Uses the last known target position stored by computeFlowfield().
   * Call this from NightScene after createStructures() and after wall destruction.
   *
   * @param baseCenterX  World-pixel X of the base center
   * @param baseCenterY  World-pixel Y of the base center
   */
  rebuildFlowfield(baseCenterX: number, baseCenterY: number): void {
    this.computeFlowfield(baseCenterX, baseCenterY);
  }

  /**
   * Returns a normalized direction vector for a zombie at (fromX, fromY) to
   * navigate toward the base using the precomputed BFS flowfield.
   *
   * O(1): simple array lookup. Falls back to local probe steering if flowfield
   * is not ready or the zombie's cell has no flowfield data (e.g. inside a wall).
   *
   * The fallback (direct line) is intentionally simple -- if a zombie is inside
   * a blocked cell the physics engine will push it out anyway.
   */
  getSteeringDirection(fromX: number, fromY: number, targetX: number, targetY: number): SteeringVector {
    const dx = targetX - fromX;
    const dy = targetY - fromY;

    // Already at target (avoid NaN from atan2)
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
      return { x: 0, y: 0 };
    }

    // --- Flowfield lookup (primary path) ---
    if (this.flowfieldReady) {
      const tileX = Math.floor(fromX / TILE_SIZE);
      const tileY = Math.floor(fromY / TILE_SIZE);

      // Clamp to grid bounds (zombie spawned slightly off-map)
      const clampedX = Math.max(0, Math.min(this.gridWidth - 1, tileX));
      const clampedY = Math.max(0, Math.min(this.gridHeight - 1, tileY));

      const idx = clampedY * this.gridWidth + clampedX;
      // noUncheckedIndexedAccess: Float32Array access returns number | undefined
      const fdx = this.flowfield[idx * 2] ?? 0;
      const fdy = this.flowfield[idx * 2 + 1] ?? 0;

      // Non-zero vector means the cell was reached by BFS -- use it
      if (fdx !== 0 || fdy !== 0) {
        // Flowfield vectors are already unit-length (cardinal: length = 1)
        return { x: fdx, y: fdy };
      }

      // fdx == fdy == 0: either the target cell itself (zombie is ON the base -- charge directly)
      // or an unreachable cell (zombie is fully enclosed by walls).
      // Check if zombie is close to target -- if so, go straight
      const distSq = dx * dx + dy * dy;
      if (distSq < (TILE_SIZE * 2) * (TILE_SIZE * 2)) {
        const len = Math.sqrt(distSq);
        return { x: dx / len, y: dy / len };
      }

      // Unreachable cell: fall through to local steering fallback below
    }

    // --- Local steering fallback (used before flowfield is ready or for unreachable cells) ---
    // Same probe-and-turn algorithm as the original implementation.
    const idealAngle = Math.atan2(dy, dx);
    const probeNear = TILE_SIZE * 1.2;
    const probeFar  = TILE_SIZE * 2.5;

    const offsets = [
      0,
      -Math.PI / 6, Math.PI / 6,
      -Math.PI / 3, Math.PI / 3,
      -Math.PI / 2, Math.PI / 2,
      -(2 * Math.PI) / 3, (2 * Math.PI) / 3,
    ];

    for (const offset of offsets) {
      const angle = idealAngle + offset;
      const nearX = fromX + Math.cos(angle) * probeNear;
      const nearY = fromY + Math.sin(angle) * probeNear;
      const farX  = fromX + Math.cos(angle) * probeFar;
      const farY  = fromY + Math.sin(angle) * probeFar;

      if (
        !this.isCellBlocked(Math.floor(nearX / TILE_SIZE), Math.floor(nearY / TILE_SIZE)) &&
        !this.isCellBlocked(Math.floor(farX  / TILE_SIZE), Math.floor(farY  / TILE_SIZE))
      ) {
        return { x: Math.cos(angle), y: Math.sin(angle) };
      }
    }

    // Second pass: accept near-cell-only clear directions
    for (const offset of offsets) {
      const angle = idealAngle + offset;
      const nearX = fromX + Math.cos(angle) * probeNear;
      const nearY = fromY + Math.sin(angle) * probeNear;
      if (!this.isCellBlocked(Math.floor(nearX / TILE_SIZE), Math.floor(nearY / TILE_SIZE))) {
        return { x: Math.cos(angle), y: Math.sin(angle) };
      }
    }

    // All directions blocked -- head directly toward target and let physics sort it out
    const len = Math.sqrt(dx * dx + dy * dy);
    return { x: dx / len, y: dy / len };
  }
}
