import * as THREE from 'three';
import type { BreachBoard } from '../sim/BreachBoard';
import type { Vec3 } from '../sim/CellBits';
import type { BreachRenderer } from './BreachRenderer';

export type BreachPick = { cellIndex: number; placementIndex: number; normal: Vec3; point: THREE.Vector3; };

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

    const normal = normalizeFaceNormal(hit.face.normal);
    const placementIndex = board.addIndex(cellIndex, normal.x, normal.y, normal.z);
    return { cellIndex, placementIndex: placementIndex >= 0 && board.isValidPlacementIndex(placementIndex) ? placementIndex : -1, normal, point: hit.point.clone() };
  }
}

function normalizeFaceNormal(n: THREE.Vector3): Vec3 {
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
  if (ax >= ay && ax >= az) return { x: n.x >= 0 ? 1 : -1, y: 0, z: 0 };
  if (ay >= ax && ay >= az) return { x: 0, y: n.y >= 0 ? 1 : -1, z: 0 };
  return { x: 0, y: 0, z: n.z >= 0 ? 1 : -1 };
}
