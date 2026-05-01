import * as THREE from 'three';
import type { BreachBoard } from '../sim/BreachBoard';
import { DIRECTIONS, type Vec3 } from '../sim/CellBits';
import type { BreachRenderer } from './BreachRenderer';

export type BreachPick = { cellIndex: number; placementIndex: number; normal: Vec3; point: THREE.Vector3; reason?: string; };

export class BreachPicking {
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();

  pick(event: PointerEvent, canvas: HTMLCanvasElement, camera: THREE.Camera, renderer: BreachRenderer, board: BreachBoard): BreachPick | null {
    const rect = canvas.getBoundingClientRect();
    this.ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.ndc, camera);
    const hits = this.raycaster.intersectObject(renderer.mesh, false);
    if (hits.length === 0) return null;

    const hit = hits[0];
    if (hit.instanceId === undefined || !hit.face) return null;
    const cellIndex = renderer.cellIndexForInstance(hit.instanceId);
    if (cellIndex < 0) return null;

    const normal = placementNormalFromHit(hit.point, renderer, board, cellIndex);
    const direct = board.addIndex(cellIndex, normal.x, normal.y, normal.z);
    if (direct >= 0 && board.isValidPlacementIndex(direct)) {
      return { cellIndex, placementIndex: direct, normal, point: hit.point.clone() };
    }

    const fallback = findBestAdjacentPlacement(board, cellIndex, normal);
    if (fallback >= 0) {
      return { cellIndex, placementIndex: fallback, normal, point: hit.point.clone(), reason: 'Used nearest exposed empty neighbor.' };
    }

    return {
      cellIndex,
      placementIndex: -1,
      normal,
      point: hit.point.clone(),
      reason: 'No empty exposed neighbor around that block. Rotate or choose an outer face.'
    };
  }
}

function findBestAdjacentPlacement(board: BreachBoard, cellIndex: number, preferred: Vec3): number {
  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  const p = board.xyzOf(cellIndex);

  for (const d of DIRECTIONS) {
    const n = board.addIndex(cellIndex, d.x, d.y, d.z);
    if (n < 0 || !board.isValidPlacementIndex(n)) continue;

    const np = board.xyzOf(n);
    const distanceFromCore = Math.max(Math.abs(np.x - board.center), Math.abs(np.y - board.center), Math.abs(np.z - board.center));
    const preferredDot = d.x * preferred.x + d.y * preferred.y + d.z * preferred.z;
    const outwardDot = d.x * Math.sign(p.x - board.center) + d.y * Math.sign(p.y - board.center) + d.z * Math.sign(p.z - board.center);
    const score = distanceFromCore * 10 + preferredDot * 5 + outwardDot * 2;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = n;
    }
  }

  return bestIndex;
}

function placementNormalFromHit(point: THREE.Vector3, renderer: BreachRenderer, board: BreachBoard, cellIndex: number): Vec3 {
  // The Breach now rotates as a visual group while the camera stays fixed.
  // Convert the clicked point back into Breach-local space, compare it to the
  // clicked cell center, then choose the dominant local axis as the placement face.
  const localPoint = renderer.worldPointToBreachLocal(point);
  const localCenter = renderer.localPositionOf(board, cellIndex);
  return normalizeFaceNormal(localPoint.sub(localCenter));
}

function normalizeFaceNormal(n: THREE.Vector3): Vec3 {
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
  if (ax >= ay && ax >= az) return { x: n.x >= 0 ? 1 : -1, y: 0, z: 0 };
  if (ay >= ax && ay >= az) return { x: 0, y: n.y >= 0 ? 1 : -1, z: 0 };
  return { x: 0, y: 0, z: n.z >= 0 ? 1 : -1 };
}
