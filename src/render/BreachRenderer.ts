import * as THREE from 'three';
import type { BreachBoard } from '../sim/BreachBoard';
import { colorOf, colorToCss, isCore, isLocked, isOccupied, isStatic } from '../sim/CellBits';

export class BreachRenderer {
  readonly mesh: THREE.InstancedMesh;
  readonly instanceIdToCellIndex: Int32Array;
  readonly cellIndexToInstanceId: Int32Array;
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private readonly spacing = 1.08;

  constructor(scene: THREE.Scene, maxInstances: number) {
    this.instanceIdToCellIndex = new Int32Array(maxInstances);
    this.cellIndexToInstanceId = new Int32Array(maxInstances);
    this.instanceIdToCellIndex.fill(-1);
    this.cellIndexToInstanceId.fill(-1);

    const geometry = new THREE.BoxGeometry(0.94, 0.94, 0.94);
    const material = new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.1, emissive: new THREE.Color('#2a1b42'), emissiveIntensity: 0.6 });
    this.mesh = new THREE.InstancedMesh(geometry, material, maxInstances);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  syncFromBoard(board: BreachBoard): void {
    this.cellIndexToInstanceId.fill(-1);
    let instance = 0;
    for (let i = 0; i < board.cellCount; i++) {
      const cell = board.cells[i];
      if (!isOccupied(cell)) continue;
      const x = (board.xOf(i) - board.center) * this.spacing;
      const y = (board.yOf(i) - board.center) * this.spacing;
      const z = (board.zOf(i) - board.center) * this.spacing;
      this.dummy.position.set(x, y, z);
      const scale = isCore(cell) ? 1.03 : isStatic(cell) ? 0.98 : 0.91;
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(instance, this.dummy.matrix);

      if (isCore(cell)) this.color.set('#ffffff');
      else if (isStatic(cell)) this.color.set('#7b6cff');
      else {
        this.color.set(colorToCss(colorOf(cell)));
        if (isLocked(cell)) this.color.lerp(new THREE.Color('#ffffff'), 0.38);
      }
      this.mesh.setColorAt(instance, this.color);

      this.instanceIdToCellIndex[instance] = i;
      this.cellIndexToInstanceId[i] = instance;
      instance++;
    }
    this.mesh.count = instance;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  cellIndexForInstance(instanceId: number): number {
    return instanceId >= 0 && instanceId < this.instanceIdToCellIndex.length ? this.instanceIdToCellIndex[instanceId] : -1;
  }
}
