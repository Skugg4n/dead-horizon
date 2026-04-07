/**
 * SpatialBucketGrid -- generic spatial hash for fast proximity queries.
 *
 * Items are bucketed into cells of fixed size. A query returns all items in
 * the cells that overlap a circle of the given radius around (x, y).
 *
 * Typical usage in Dead Horizon:
 *   - Build once per structural change (structures don't move).
 *   - Query once per zombie per frame to get the ~3-5 nearby structures
 *     instead of checking all 49+ structure arrays.
 *
 * Cell key format: "<cellCol>,<cellRow>" -- cheap string, no hashing library needed.
 */
export class SpatialBucketGrid<T> {
  private readonly cellSize: number;
  private grid: Map<string, T[]>;

  constructor(cellSize: number = 64) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  /** Remove all items from the grid (call before rebuild). */
  clear(): void {
    this.grid.clear();
  }

  /** Insert an item at world position (x, y). */
  insert(x: number, y: number, item: T): void {
    const key = this._cellKey(x, y);
    let bucket = this.grid.get(key);
    if (!bucket) {
      bucket = [];
      this.grid.set(key, bucket);
    }
    bucket.push(item);
  }

  /**
   * Return all items whose insertion cell overlaps a square of side (2*radius)
   * centred on (x, y).  Results may include items slightly outside the strict
   * circle -- callers do their own precise distance/bounds check afterwards.
   *
   * The query expands by one extra cell on every side to handle items whose
   * centre is in a neighbouring cell but whose footprint reaches into (x,y)'s cell.
   */
  query(x: number, y: number, radius: number): T[] {
    const cs = this.cellSize;

    // Cell range that covers the query AABB
    const minCol = Math.floor((x - radius) / cs);
    const maxCol = Math.floor((x + radius) / cs);
    const minRow = Math.floor((y - radius) / cs);
    const maxRow = Math.floor((y + radius) / cs);

    const results: T[] = [];

    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const bucket = this.grid.get(`${col},${row}`);
        if (bucket) {
          for (const item of bucket) {
            results.push(item);
          }
        }
      }
    }

    return results;
  }

  /** Compute the cell key for a world position. */
  private _cellKey(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }
}
