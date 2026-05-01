import * as THREE from 'three';
import type { BreachBoard } from '../sim/BreachBoard';
import type { IslandSnapMove } from '../sim/IslandSnapSystem';
import { colorOf, colorToCss, isCore, isLocked, isOccupied, isStatic } from '../sim/CellBits';

export class BreachRenderer {
  readonly group: THREE.Group;
  readonly mesh: THREE.InstancedMesh;
  readonly edgeMesh: THREE.InstancedMesh;
  readonly instanceIdToCellIndex: Int32Array;
  readonly cellIndexToInstanceId: Int32Array;

  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private readonly spacing = 1.08;
  private readonly previousCells: Uint16Array;
  private readonly pendingFromIndexByTarget: Int32Array;
  private readonly cellAtInstance: Int32Array;
  private readonly visualX: Float32Array;
  private readonly visualY: Float32Array;
  private readonly visualZ: Float32Array;
  private readonly startX: Float32Array;
  private readonly startY: Float32Array;
  private readonly startZ: Float32Array;
  private readonly targetX: Float32Array;
  private readonly targetY: Float32Array;
  private readonly targetZ: Float32Array;
  private readonly animStart: Float32Array;
  private readonly animDuration: Float32Array;
  private readonly scaleByCell: Float32Array;
  private instanceCount = 0;

  constructor(scene: THREE.Scene, maxInstances: number) {
    this.group = new THREE.Group();
    this.group.name = 'Breach visual rotation root';
    scene.add(this.group);

    this.instanceIdToCellIndex = new Int32Array(maxInstances);
    this.cellIndexToInstanceId = new Int32Array(maxInstances);
    this.previousCells = new Uint16Array(maxInstances);
    this.pendingFromIndexByTarget = new Int32Array(maxInstances);
    this.cellAtInstance = new Int32Array(maxInstances);
    this.visualX = new Float32Array(maxInstances);
    this.visualY = new Float32Array(maxInstances);
    this.visualZ = new Float32Array(maxInstances);
    this.startX = new Float32Array(maxInstances);
    this.startY = new Float32Array(maxInstances);
    this.startZ = new Float32Array(maxInstances);
    this.targetX = new Float32Array(maxInstances);
    this.targetY = new Float32Array(maxInstances);
    this.targetZ = new Float32Array(maxInstances);
    this.animStart = new Float32Array(maxInstances);
    this.animDuration = new Float32Array(maxInstances);
    this.scaleByCell = new Float32Array(maxInstances);

    this.instanceIdToCellIndex.fill(-1);
    this.cellIndexToInstanceId.fill(-1);
    this.pendingFromIndexByTarget.fill(-1);
    this.cellAtInstance.fill(-1);

    const geometry = new THREE.BoxGeometry(0.94, 0.94, 0.94);
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.2,
      metalness: 0.1,
      emissive: new THREE.Color('#2a1b42'),
      emissiveIntensity: 0.6
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, maxInstances);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.group.add(this.mesh);

    const edgeGeometry = new THREE.BoxGeometry(0.982, 0.982, 0.982);
    const edgeMaterial = new THREE.MeshBasicMaterial({
      color: '#e9f7ff',
      transparent: true,
      opacity: 0.24,
      wireframe: true,
      depthWrite: false
    });
    this.edgeMesh = new THREE.InstancedMesh(edgeGeometry, edgeMaterial, maxInstances);
    this.edgeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.edgeMesh.frustumCulled = false;
    this.edgeMesh.renderOrder = 11;
    this.group.add(this.edgeMesh);
  }

  rotateByDrag(deltaX: number, deltaY: number): void {
    this.group.rotation.y += deltaX * 0.008;
    this.group.rotation.x = THREE.MathUtils.clamp(this.group.rotation.x + deltaY * 0.008, -1.28, 1.28);
  }

  resetVisualRotation(): void { this.group.rotation.set(0, 0, 0); }

  localPositionOf(board: BreachBoard, index: number): THREE.Vector3 {
    const p = this.worldPositionOf(board, index);
    return new THREE.Vector3(p.x, p.y, p.z);
  }

  worldPointToBreachLocal(point: THREE.Vector3): THREE.Vector3 {
    this.group.updateWorldMatrix(true, false);
    return this.group.worldToLocal(point.clone());
  }

  prepareSnapAnimation(moves: readonly IslandSnapMove[] | undefined): void {
    if (!moves || moves.length === 0) return;
    this.pendingFromIndexByTarget.fill(-1);
    for (const move of moves) {
      if (move.to >= 0 && move.to < this.pendingFromIndexByTarget.length) this.pendingFromIndexByTarget[move.to] = move.from;
    }
  }

  syncFromBoard(board: BreachBoard): void {
    const now = performance.now();
    this.cellIndexToInstanceId.fill(-1);
    this.cellAtInstance.fill(-1);
    let instance = 0;

    for (let i = 0; i < board.cellCount; i++) {
      const cell = board.cells[i];
      if (!isOccupied(cell)) continue;

      const target = this.worldPositionOf(board, i);
      const fromIndex = this.pendingFromIndexByTarget[i];
      let start = target;

      if (fromIndex >= 0) start = this.worldPositionOf(board, fromIndex);
      else if (isOccupied(this.previousCells[i])) start = { x: this.visualX[i], y: this.visualY[i], z: this.visualZ[i] };

      this.startX[i] = start.x; this.startY[i] = start.y; this.startZ[i] = start.z;
      this.visualX[i] = start.x; this.visualY[i] = start.y; this.visualZ[i] = start.z;
      this.targetX[i] = target.x; this.targetY[i] = target.y; this.targetZ[i] = target.z;
      this.animStart[i] = now;
      this.animDuration[i] = fromIndex >= 0 ? 220 : isOccupied(this.previousCells[i]) ? 90 : 160;
      this.scaleByCell[i] = isCore(cell) ? 1.03 : isStatic(cell) ? 0.98 : 0.91;

      this.writeInstance(instance, i, cell, start.x, start.y, start.z, this.scaleByCell[i]);
      instance++;
    }

    this.instanceCount = instance;
    this.mesh.count = instance;
    this.edgeMesh.count = instance;
    this.previousCells.set(board.cells);
    this.pendingFromIndexByTarget.fill(-1);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.edgeMesh.instanceMatrix.needsUpdate = true;
  }

  update(): void {
    if (this.instanceCount <= 0) return;
    const now = performance.now();
    let changed = false;

    for (let instance = 0; instance < this.instanceCount; instance++) {
      const cellIndex = this.cellAtInstance[instance];
      if (cellIndex < 0) continue;
      const duration = Math.max(1, this.animDuration[cellIndex]);
      const t = Math.min(1, (now - this.animStart[cellIndex]) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const x = this.startX[cellIndex] + (this.targetX[cellIndex] - this.startX[cellIndex]) * eased;
      const y = this.startY[cellIndex] + (this.targetY[cellIndex] - this.startY[cellIndex]) * eased;
      const z = this.startZ[cellIndex] + (this.targetZ[cellIndex] - this.startZ[cellIndex]) * eased;
      this.visualX[cellIndex] = x; this.visualY[cellIndex] = y; this.visualZ[cellIndex] = z;
      this.dummy.position.set(x, y, z);
      const slam = t < 1 ? 1 + Math.sin(t * Math.PI) * 0.08 : 1;
      this.dummy.scale.setScalar(this.scaleByCell[cellIndex] * slam);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(instance, this.dummy.matrix);
      this.edgeMesh.setMatrixAt(instance, this.dummy.matrix);
      changed = true;
    }

    if (changed) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.edgeMesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.group);
    this.mesh.geometry.dispose();
    this.edgeMesh.geometry.dispose();
    if (Array.isArray(this.mesh.material)) for (const m of this.mesh.material) m.dispose();
    else this.mesh.material.dispose();
    if (Array.isArray(this.edgeMesh.material)) for (const m of this.edgeMesh.material) m.dispose();
    else this.edgeMesh.material.dispose();
  }

  cellIndexForInstance(instanceId: number): number {
    return instanceId >= 0 && instanceId < this.instanceIdToCellIndex.length ? this.instanceIdToCellIndex[instanceId] : -1;
  }

  private worldPositionOf(board: BreachBoard, index: number): { x: number; y: number; z: number } {
    return {
      x: (board.xOf(index) - board.center) * this.spacing,
      y: (board.yOf(index) - board.center) * this.spacing,
      z: (board.zOf(index) - board.center) * this.spacing
    };
  }

  private writeInstance(instance: number, cellIndex: number, cell: number, x: number, y: number, z: number, scale: number): void {
    this.dummy.position.set(x, y, z);
    this.dummy.scale.setScalar(scale);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(instance, this.dummy.matrix);
    this.edgeMesh.setMatrixAt(instance, this.dummy.matrix);

    if (isCore(cell)) this.color.set('#ffffff');
    else if (isStatic(cell)) this.color.set('#8d7bff');
    else {
      this.color.set(colorToCss(colorOf(cell)));
      if (isLocked(cell)) this.color.lerp(new THREE.Color('#ffffff'), 0.38);
    }
    this.mesh.setColorAt(instance, this.color);

    this.instanceIdToCellIndex[instance] = cellIndex;
    this.cellIndexToInstanceId[cellIndex] = instance;
    this.cellAtInstance[instance] = cellIndex;
  }
}
