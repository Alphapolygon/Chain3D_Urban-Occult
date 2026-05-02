import { chebyshevDistanceFromCenter, CubeFace, FACE_NORMALS, isOccupied, LOCKED, makeColorCell, makeCorruptionCell, makeStaticCoreCell, type Vec3 } from './CellBits';

export type BreachBoardConfig = {
  maxSize: number; initialRadius: number; initialCoreRadius: number; fillPercent: number;
  colorCount: number; lockedPercent: number; staticNoisePercent: number; seed: number;
};

export class Mulberry32 {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }
  next(): number { let t = (this.state += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  int(minInclusive: number, maxExclusive: number): number { return minInclusive + Math.floor(this.next() * (maxExclusive - minInclusive)); }
}

export class BreachBoard {
  readonly maxSize: number; readonly cellCount: number; readonly center: number; readonly cells: Uint16Array; readonly config: BreachBoardConfig;
  activeRadius: number; coreRadius: number; colorCount: number; containmentFailure = false;
  private rng: Mulberry32;

  constructor(config: BreachBoardConfig) {
    const size = Math.max(3, Math.floor(config.maxSize));
    this.config = { ...config, maxSize: size }; this.maxSize = size; this.cellCount = size * size * size;
    this.center = Math.floor(size / 2); this.cells = new Uint16Array(this.cellCount);
    this.activeRadius = config.initialRadius; this.coreRadius = config.initialCoreRadius;
    this.colorCount = Math.max(3, Math.min(8, config.colorCount)); this.rng = new Mulberry32(config.seed);
  }

  reset(seed = this.config.seed): void { this.rng = new Mulberry32(seed); this.cells.fill(0); this.activeRadius = this.config.initialRadius; this.coreRadius = this.config.initialCoreRadius; this.containmentFailure = false; this.generateInitialBreach(); }

  generateInitialBreach(): void {
    for (let z = 0; z < this.maxSize; z++) for (let y = 0; y < this.maxSize; y++) for (let x = 0; x < this.maxSize; x++) {
      const distance = chebyshevDistanceFromCenter(x, y, z, this.center); const index = this.index(x, y, z);
      if (distance === 0) { this.cells[index] = makeStaticCoreCell(); continue; }
      if (distance <= this.coreRadius) { this.cells[index] = makeCorruptionCell(this.randomColor()); continue; }
      if (distance > this.activeRadius || this.rng.next() > this.config.fillPercent) continue;
      const color = this.rng.int(1, this.colorCount + 1); const locked = this.rng.next() < this.config.lockedPercent ? LOCKED : 0;
      this.cells[index] = makeColorCell(color, locked);
    }
  }

  index(x: number, y: number, z: number): number { return x + y * this.maxSize + z * this.maxSize * this.maxSize; }
  xOf(index: number): number { return index % this.maxSize; }
  yOf(index: number): number { return Math.floor(index / this.maxSize) % this.maxSize; }
  zOf(index: number): number { return Math.floor(index / (this.maxSize * this.maxSize)); }
  xyzOf(index: number): Vec3 { return { x: this.xOf(index), y: this.yOf(index), z: this.zOf(index) }; }
  inBounds(x: number, y: number, z: number): boolean { return x >= 0 && y >= 0 && z >= 0 && x < this.maxSize && y < this.maxSize && z < this.maxSize; }
  inBoundsIndex(index: number): boolean { return index >= 0 && index < this.cellCount; }
  isValidPlacementIndex(index: number): boolean { if (!this.inBoundsIndex(index) || this.cells[index] !== 0) return false; const p = this.xyzOf(index); return chebyshevDistanceFromCenter(p.x, p.y, p.z, this.center) > this.coreRadius; }
  placeAtIndex(index: number, color: number): boolean { if (!this.isValidPlacementIndex(index)) return false; this.cells[index] = makeColorCell(color); return true; }
  placeAdjacentToCell(cellIndex: number, normal: Vec3, color: number): number { const p = this.xyzOf(cellIndex); const index = this.inBounds(p.x + normal.x, p.y + normal.y, p.z + normal.z) ? this.index(p.x + normal.x, p.y + normal.y, p.z + normal.z) : -1; return index >= 0 && this.placeAtIndex(index, color) ? index : -1; }
  placeFromFace(face: CubeFace, u: number, v: number, color: number): number { const normal = FACE_NORMALS[face]; const s = this.maxSize; let x = this.center, y = this.center, z = this.center; const a = Math.max(0, Math.min(s - 1, u)), b = Math.max(0, Math.min(s - 1, v)); if (face <= 1) { x = face === CubeFace.PosX ? s - 1 : 0; y = a; z = b; } else if (face <= 3) { y = face === CubeFace.PosY ? s - 1 : 0; x = a; z = b; } else { z = face === CubeFace.PosZ ? s - 1 : 0; x = a; y = b; } for (let step = 0; step < s; step++) { if (!this.inBounds(x, y, z)) return -1; const i = this.index(x, y, z); if (this.isValidPlacementIndex(i)) { this.cells[i] = makeColorCell(color); return i; } if (isOccupied(this.cells[i])) return -1; x -= normal.x; y -= normal.y; z -= normal.z; } return -1; }
  addIndex(index: number, dx: number, dy: number, dz: number): number { const x = this.xOf(index) + dx, y = this.yOf(index) + dy, z = this.zOf(index) + dz; return this.inBounds(x, y, z) ? this.index(x, y, z) : -1; }
  randomColor(): number { return this.rng.int(1, this.colorCount + 1); }
  growActiveRadius(amount: number): void { this.activeRadius = Math.min(this.center, this.activeRadius + amount); }
  countOccupied(): number { let c = 0; for (let i = 0; i < this.cellCount; i++) if (isOccupied(this.cells[i])) c++; return c; }
}
