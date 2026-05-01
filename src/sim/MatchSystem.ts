import { DIRECTIONS, colorOf, isMatchable } from './CellBits';
import type { BreachBoard } from './BreachBoard';

export type MatchResult = {
  removed: number;
  dominantColor: number;
  colorCounts: Int32Array;
  removedIndices: number[];
};

export class MatchSystem {
  readonly removeMask: Uint8Array;
  readonly colorCounts: Int32Array;

  private readonly visitStamp: Int32Array;
  private readonly queue: Int32Array;
  private readonly cluster: Int32Array;
  private readonly minimum: number;
  private stamp = 1;

  constructor(cellCount: number, colorCount: number, minimum = 3) {
    this.removeMask = new Uint8Array(cellCount);
    this.visitStamp = new Int32Array(cellCount);
    this.queue = new Int32Array(cellCount);
    this.cluster = new Int32Array(cellCount);
    this.colorCounts = new Int32Array(Math.max(16, colorCount + 1));
    this.minimum = Math.max(3, minimum | 0);
  }

  /**
   * Resolves seeded 3D cluster matches.
   *
   * This intentionally does not scan the whole board. A connected color blob only
   * clears when one of the seed cells belongs to it, e.g. the block the player
   * just placed or a block that moved during Island Snap. Old blobs can be huge,
   * but they stay dormant until touched by a seed of the same color.
   */
  resolve(board: BreachBoard, seedIndices?: readonly number[]): MatchResult {
    this.removeMask.fill(0);
    this.colorCounts.fill(0);

    if (!seedIndices || seedIndices.length === 0) {
      return { removed: 0, dominantColor: 0, colorCounts: this.colorCounts, removedIndices: [] };
    }

    for (const seed of seedIndices) {
      this.tryMarkConnectedGroup(board, seed | 0);
    }

    let removed = 0;
    let dominantColor = 0;
    let dominantCount = 0;
    const removedIndices: number[] = [];

    for (let i = 0; i < board.cellCount; i++) {
      if (this.removeMask[i] === 0) continue;

      const color = colorOf(board.cells[i]);
      board.cells[i] = 0;
      this.colorCounts[color]++;
      removed++;
      removedIndices.push(i);

      if (this.colorCounts[color] > dominantCount) {
        dominantColor = color;
        dominantCount = this.colorCounts[color];
      }
    }

    return { removed, dominantColor, colorCounts: this.colorCounts, removedIndices };
  }

  private tryMarkConnectedGroup(board: BreachBoard, seed: number): void {
    if (!board.inBoundsIndex(seed)) return;
    if (this.removeMask[seed] !== 0) return;

    const seedCell = board.cells[seed];
    if (!isMatchable(seedCell)) return;

    const targetColor = colorOf(seedCell);
    const stamp = this.nextStamp();

    let head = 0;
    let tail = 0;
    let count = 0;

    this.visitStamp[seed] = stamp;
    this.queue[tail++] = seed;

    while (head < tail) {
      const index = this.queue[head++];
      this.cluster[count++] = index;

      for (const direction of DIRECTIONS) {
        const next = board.addIndex(index, direction.x, direction.y, direction.z);
        if (next < 0 || this.visitStamp[next] === stamp || this.removeMask[next] !== 0) continue;

        const cell = board.cells[next];
        if (!isMatchable(cell) || colorOf(cell) !== targetColor) continue;

        this.visitStamp[next] = stamp;
        this.queue[tail++] = next;
      }
    }

    if (count < this.minimum) return;

    for (let i = 0; i < count; i++) {
      this.removeMask[this.cluster[i]] = 1;
    }
  }

  private nextStamp(): number {
    this.stamp++;
    if (this.stamp >= 0x3fffffff) {
      this.visitStamp.fill(0);
      this.stamp = 1;
    }
    return this.stamp;
  }
}
