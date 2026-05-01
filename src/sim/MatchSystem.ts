import { colorOf, isMatchable } from './CellBits';
import type { BreachBoard } from './BreachBoard';

export type MatchResult = {
  removed: number;
  dominantColor: number;
  colorCounts: Int32Array;
};

export class MatchSystem {
  readonly removeMask: Uint8Array;
  readonly colorCounts: Int32Array;
  private readonly minimum: number;

  constructor(cellCount: number, colorCount: number, minimum = 3) {
    this.removeMask = new Uint8Array(cellCount);
    this.colorCounts = new Int32Array(Math.max(16, colorCount + 1));
    this.minimum = Math.max(3, minimum | 0);
  }

  resolve(board: BreachBoard): MatchResult {
    this.removeMask.fill(0);
    this.colorCounts.fill(0);

    this.scanAxis(board, 1, 0, 0);
    this.scanAxis(board, 0, 1, 0);
    this.scanAxis(board, 0, 0, 1);

    let removed = 0;
    let dominantColor = 0;
    let dominantCount = 0;

    for (let i = 0; i < board.cellCount; i++) {
      if (this.removeMask[i] === 0) continue;
      const color = colorOf(board.cells[i]);
      board.cells[i] = 0;
      this.colorCounts[color]++;
      removed++;
      if (this.colorCounts[color] > dominantCount) {
        dominantColor = color;
        dominantCount = this.colorCounts[color];
      }
    }

    return { removed, dominantColor, colorCounts: this.colorCounts };
  }

  private scanAxis(board: BreachBoard, dx: number, dy: number, dz: number): void {
    const s = board.maxSize;
    for (let z = 0; z < s; z++) for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const px = x - dx, py = y - dy, pz = z - dz;
      if (board.inBounds(px, py, pz)) continue;

      let runColor = 0;
      let runStart = -1;
      let runLength = 0;
      let cx = x, cy = y, cz = z;

      while (board.inBounds(cx, cy, cz)) {
        const index = board.index(cx, cy, cz);
        const cell = board.cells[index];
        const color = isMatchable(cell) ? colorOf(cell) : 0;

        if (color !== 0 && color === runColor) {
          runLength++;
        } else {
          this.markRun(board, runStart, dx, dy, dz, runLength);
          runColor = color;
          runStart = color === 0 ? -1 : index;
          runLength = color === 0 ? 0 : 1;
        }

        cx += dx; cy += dy; cz += dz;
      }
      this.markRun(board, runStart, dx, dy, dz, runLength);
    }
  }

  private markRun(board: BreachBoard, start: number, dx: number, dy: number, dz: number, length: number): void {
    if (start < 0 || length < this.minimum) return;
    let index = start;
    for (let i = 0; i < length; i++) {
      this.removeMask[index] = 1;
      index = board.addIndex(index, dx, dy, dz);
      if (index < 0) break;
    }
  }
}
