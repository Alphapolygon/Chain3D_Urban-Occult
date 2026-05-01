import { DIRECTIONS, isOccupied, isStatic, type Vec3 } from './CellBits';
import type { BreachBoard } from './BreachBoard';

export type IslandSnapResult = {
  clustersMoved: number;
  cellsMoved: number;
  snapSteps: number;
};

const MAX_DISTANCE = 0x3fff;

export class IslandSnapSystem {
  readonly visit: Uint8Array;
  readonly queue: Int32Array;
  readonly cluster: Int32Array;
  readonly clusterValues: Uint16Array;
  readonly distance: Int16Array;
  readonly stuck: Uint8Array;

  constructor(cellCount: number) {
    this.visit = new Uint8Array(cellCount);
    this.queue = new Int32Array(cellCount);
    this.cluster = new Int32Array(cellCount);
    this.clusterValues = new Uint16Array(cellCount);
    this.distance = new Int16Array(cellCount);
    this.stuck = new Uint8Array(cellCount);
  }

  resolve(board: BreachBoard, maxClusters = 256): IslandSnapResult {
    let clustersMoved = 0;
    let cellsMoved = 0;
    let snapSteps = 0;
    this.stuck.fill(0);

    for (let pass = 0; pass < maxClusters; pass++) {
      this.markAnchored(board);
      const start = this.findLooseStart(board);
      if (start < 0) break;

      const clusterCount = this.collectCluster(board, start);
      this.clearClusterFromBoard(board, clusterCount);
      this.buildDistanceField(board);

      let movedThisCluster = false;
      for (let step = 0; step < board.maxSize * 2; step++) {
        if (this.touchesAnchored(board, clusterCount)) break;
        const direction = this.findBestDirection(board, clusterCount);
        if (!direction) break;
        this.translateCluster(board, clusterCount, direction.x, direction.y, direction.z);
        movedThisCluster = true;
        snapSteps++;
      }

      this.writeClusterToBoard(board, clusterCount);
      if (movedThisCluster) {
        clustersMoved++;
        cellsMoved += clusterCount;
        this.stuck.fill(0);
      } else {
        for (let i = 0; i < clusterCount; i++) this.stuck[this.cluster[i]] = 1;
      }
    }

    return { clustersMoved, cellsMoved, snapSteps };
  }

  private markAnchored(board: BreachBoard): void {
    this.visit.fill(0);
    let head = 0, tail = 0;
    for (let i = 0; i < board.cellCount; i++) {
      const cell = board.cells[i];
      if (!isOccupied(cell) || (cell & (1 << 11)) === 0) continue; // CORE flag
      this.visit[i] = 1;
      this.queue[tail++] = i;
    }

    while (head < tail) {
      const index = this.queue[head++];
      const x = board.xOf(index), y = board.yOf(index), z = board.zOf(index);
      for (const d of DIRECTIONS) {
        const nx = x + d.x, ny = y + d.y, nz = z + d.z;
        if (!board.inBounds(nx, ny, nz)) continue;
        const n = board.index(nx, ny, nz);
        if (this.visit[n] !== 0 || !isOccupied(board.cells[n]) || isStatic(board.cells[n])) continue;
        this.visit[n] = 1;
        this.queue[tail++] = n;
      }
    }
  }

  private findLooseStart(board: BreachBoard): number {
    for (let i = 0; i < board.cellCount; i++) {
      if (this.visit[i] === 0 && this.stuck[i] === 0 && isOccupied(board.cells[i]) && !isStatic(board.cells[i])) return i;
    }
    return -1;
  }

  private collectCluster(board: BreachBoard, start: number): number {
    let head = 0, tail = 0, count = 0;
    this.queue[tail++] = start;
    this.visit[start] = 2;

    while (head < tail) {
      const index = this.queue[head++];
      this.cluster[count] = index;
      this.clusterValues[count] = board.cells[index];
      count++;

      const x = board.xOf(index), y = board.yOf(index), z = board.zOf(index);
      for (const d of DIRECTIONS) {
        const nx = x + d.x, ny = y + d.y, nz = z + d.z;
        if (!board.inBounds(nx, ny, nz)) continue;
        const n = board.index(nx, ny, nz);
        if (this.visit[n] !== 0 || !isOccupied(board.cells[n])) continue;
        this.visit[n] = 2;
        this.queue[tail++] = n;
      }
    }
    return count;
  }

  private clearClusterFromBoard(board: BreachBoard, count: number): void {
    for (let i = 0; i < count; i++) board.cells[this.cluster[i]] = 0;
  }

  private writeClusterToBoard(board: BreachBoard, count: number): void {
    for (let i = 0; i < count; i++) board.cells[this.cluster[i]] = this.clusterValues[i];
  }

  private buildDistanceField(board: BreachBoard): void {
    this.distance.fill(MAX_DISTANCE);
    let head = 0, tail = 0;
    for (let i = 0; i < board.cellCount; i++) {
      if (this.visit[i] === 1) {
        this.distance[i] = 0;
        this.queue[tail++] = i;
      }
    }

    while (head < tail) {
      const index = this.queue[head++];
      const nextDist = this.distance[index] + 1;
      const x = board.xOf(index), y = board.yOf(index), z = board.zOf(index);
      for (const d of DIRECTIONS) {
        const nx = x + d.x, ny = y + d.y, nz = z + d.z;
        if (!board.inBounds(nx, ny, nz)) continue;
        const n = board.index(nx, ny, nz);
        if (this.distance[n] <= nextDist) continue;
        if (isOccupied(board.cells[n]) && this.visit[n] !== 1) continue;
        this.distance[n] = nextDist;
        this.queue[tail++] = n;
      }
    }
  }

  private touchesAnchored(board: BreachBoard, count: number): boolean {
    for (let i = 0; i < count; i++) {
      const index = this.cluster[i];
      const x = board.xOf(index), y = board.yOf(index), z = board.zOf(index);
      for (const d of DIRECTIONS) {
        const nx = x + d.x, ny = y + d.y, nz = z + d.z;
        if (!board.inBounds(nx, ny, nz)) continue;
        const n = board.index(nx, ny, nz);
        if (this.visit[n] === 1) return true;
      }
    }
    return false;
  }

  private findBestDirection(board: BreachBoard, count: number): Vec3 | null {
    let best: Vec3 | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const d of DIRECTIONS) {
      if (!this.canTranslate(board, count, d.x, d.y, d.z)) continue;
      let score = 0;
      let reachable = false;
      for (let i = 0; i < count; i++) {
        const index = this.cluster[i];
        const n = board.addIndex(index, d.x, d.y, d.z);
        if (n < 0) { score += MAX_DISTANCE; continue; }
        const dist = this.distance[n];
        if (dist < MAX_DISTANCE) reachable = true;
        score += dist;
      }
      if (reachable && score < bestScore) {
        bestScore = score;
        best = d;
      }
    }

    return best;
  }

  private canTranslate(board: BreachBoard, count: number, dx: number, dy: number, dz: number): boolean {
    for (let i = 0; i < count; i++) {
      const n = board.addIndex(this.cluster[i], dx, dy, dz);
      if (n < 0 || board.cells[n] !== 0) return false;
    }
    return true;
  }

  private translateCluster(board: BreachBoard, count: number, dx: number, dy: number, dz: number): void {
    for (let i = 0; i < count; i++) this.cluster[i] = board.addIndex(this.cluster[i], dx, dy, dz);
  }
}
