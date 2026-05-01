import { chebyshevDistanceFromCenter, isOccupied, makeCorruptionCell, makeStaticCoreCell, signNonZero } from './CellBits';
import type { BreachBoard } from './BreachBoard';

export type CoreGrowthResult = {
  success: boolean;
  oldRadius: number;
  newRadius: number;
  displacedBlocks: number;
  createdStaticBlocks: number;
};

export function expandStaticCore(board: BreachBoard, amount: number): CoreGrowthResult {
  const oldRadius = board.coreRadius;
  const newRadius = Math.min(board.center, oldRadius + Math.max(1, amount | 0));
  const displaced: number[] = [];
  const values: number[] = [];

  // Only the newly-grown shell pushes existing blocks outward. Previous colored
  // growth layers stay in place; empty holes inside the growth radius are filled
  // below, but they do not trigger match checks by themselves.
  for (let i = 0; i < board.cellCount; i++) {
    const p = board.xyzOf(i);
    const dist = chebyshevDistanceFromCenter(p.x, p.y, p.z, board.center);
    if (dist <= oldRadius || dist > newRadius) continue;

    const cell = board.cells[i];
    if (isOccupied(cell)) {
      displaced.push(i);
      values.push(cell);
      board.cells[i] = 0;
    }
  }

  let success = true;
  for (let i = 0; i < displaced.length; i++) {
    const target = findPushTarget(board, displaced[i], newRadius);
    if (target < 0) { success = false; continue; }
    board.cells[target] = values[i];
  }

  let createdGrowthBlocks = 0;
  for (let i = 0; i < board.cellCount; i++) {
    const p = board.xyzOf(i);
    const dist = chebyshevDistanceFromCenter(p.x, p.y, p.z, board.center);

    if (dist === 0) {
      if (board.cells[i] !== makeStaticCoreCell()) createdGrowthBlocks++;
      board.cells[i] = makeStaticCoreCell();
      continue;
    }

    if (dist <= newRadius && board.cells[i] === 0) {
      board.cells[i] = makeCorruptionCell(board.randomColor());
      createdGrowthBlocks++;
    }
  }

  board.coreRadius = newRadius;
  board.growActiveRadius(amount);
  if (!success) board.containmentFailure = true;
  return { success, oldRadius, newRadius, displacedBlocks: displaced.length, createdStaticBlocks: createdGrowthBlocks };
}

export function shrinkStaticCore(board: BreachBoard, amount: number): CoreGrowthResult {
  const oldRadius = board.coreRadius;
  const newRadius = Math.max(0, oldRadius - Math.max(1, amount | 0));
  let removed = 0;
  for (let i = 0; i < board.cellCount; i++) {
    const p = board.xyzOf(i);
    const dist = chebyshevDistanceFromCenter(p.x, p.y, p.z, board.center);
    if (dist > newRadius && dist <= oldRadius) {
      board.cells[i] = 0;
      removed++;
    }
  }
  const centerIndex = board.index(board.center, board.center, board.center);
  board.cells[centerIndex] = makeStaticCoreCell();
  board.coreRadius = newRadius;
  return { success: true, oldRadius, newRadius, displacedBlocks: 0, createdStaticBlocks: -removed };
}

function findPushTarget(board: BreachBoard, startIndex: number, newRadius: number): number {
  const p = board.xyzOf(startIndex);
  let dx = signNonZero(p.x - board.center), dy = signNonZero(p.y - board.center), dz = signNonZero(p.z - board.center);
  if (dx === 0 && dy === 0 && dz === 0) dx = 1;
  let x = p.x, y = p.y, z = p.z;
  for (let step = 0; step <= board.maxSize; step++) {
    x += dx; y += dy; z += dz;
    if (!board.inBounds(x, y, z)) return -1;
    const dist = chebyshevDistanceFromCenter(x, y, z, board.center);
    if (dist <= newRadius) continue;
    const index = board.index(x, y, z);
    if (board.cells[index] === 0) return index;
  }
  return -1;
}
