import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private changedDuringGesture = false;

  constructor(canvas: HTMLCanvasElement, onCommittedRotation: () => void) {
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(22, 18, 24);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 14;
    this.controls.maxDistance = 58;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 0.75;

    this.controls.addEventListener('start', () => { this.changedDuringGesture = false; });
    this.controls.addEventListener('change', () => { this.changedDuringGesture = true; });
    this.controls.addEventListener('end', () => {
      if (this.changedDuringGesture) onCommittedRotation();
      this.changedDuringGesture = false;
    });
  }

  update(): void { this.controls.update(); }
  resize(width: number, height: number): void { this.camera.aspect = width / Math.max(1, height); this.camera.updateProjectionMatrix(); }
}
