export const COLOR_MASK = 0x00ff;
export const OCCUPIED = 1 << 8;
export const LOCKED = 1 << 9;
export const STATIC = 1 << 10;
export const CORE = 1 << 11;
export const PINNED = 1 << 12;
export const CORRUPTION = 1 << 13;

export type Cell = number;
export type Vec3 = { x: number; y: number; z: number };

export enum CubeFace { PosX = 0, NegX = 1, PosY = 2, NegY = 3, PosZ = 4, NegZ = 5 }

export const DIRECTIONS: readonly Vec3[] = Object.freeze([
  Object.freeze({ x: 1, y: 0, z: 0 }), Object.freeze({ x: -1, y: 0, z: 0 }),
  Object.freeze({ x: 0, y: 1, z: 0 }), Object.freeze({ x: 0, y: -1, z: 0 }),
  Object.freeze({ x: 0, y: 0, z: 1 }), Object.freeze({ x: 0, y: 0, z: -1 })
]);

export const FACE_NORMALS: readonly Vec3[] = DIRECTIONS;

export function makeColorCell(color: number, flags = 0): Cell { return ((color & COLOR_MASK) | OCCUPIED | flags) & 0xffff; }
export function makeCorruptionCell(color: number, flags = 0): Cell { return makeColorCell(color, CORRUPTION | flags); }
export function makeStaticCoreCell(): Cell { return (OCCUPIED | STATIC | CORE) & 0xffff; }
export function colorOf(cell: Cell): number { return cell & COLOR_MASK; }
export function isOccupied(cell: Cell): boolean { return (cell & OCCUPIED) !== 0; }
export function isStatic(cell: Cell): boolean { return (cell & STATIC) !== 0; }
export function isCore(cell: Cell): boolean { return (cell & CORE) !== 0; }
export function isLocked(cell: Cell): boolean { return (cell & LOCKED) !== 0; }
export function isCorruption(cell: Cell): boolean { return (cell & CORRUPTION) !== 0; }

// Match rule: any face-connected same-color group of 3+ matchable cells clears.
// Locked cells, the white core anchor, and colorless static noise are not matchable.
// Colored corruption/core-growth cells are matchable and removable by matches.
export function isMatchable(cell: Cell): boolean { return isOccupied(cell) && !isCore(cell) && !isLocked(cell) && colorOf(cell) > 0; }

// Bombs/manual destruction should not erase corruption. Corruption is removable only by matches or by core stabilizer shrink.
export function isDestructible(cell: Cell): boolean { return isOccupied(cell) && !isStatic(cell) && !isCore(cell) && !isCorruption(cell); }
export function withoutFlag(cell: Cell, flag: number): Cell { return (cell & ~flag) & 0xffff; }
export function chebyshevDistanceFromCenter(x: number, y: number, z: number, center: number): number { return Math.max(Math.abs(x - center), Math.abs(y - center), Math.abs(z - center)); }
export function signNonZero(value: number): number { return value < 0 ? -1 : value > 0 ? 1 : 0; }
export function colorToCss(color: number): string {
  switch (color) {
    case 1: return '#ff3bd4'; case 2: return '#28f7ff'; case 3: return '#ffe45e'; case 4: return '#7dff6b';
    case 5: return '#ff8a2b'; case 6: return '#a776ff'; case 7: return '#ff4e5f'; case 8: return '#ffffff';
    default: return '#7d7d8e';
  }
}
