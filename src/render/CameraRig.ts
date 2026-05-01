import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type CameraMode = 'tactical' | 'action';

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private changedDuringGesture = false;
  private mode: CameraMode = 'tactical';
  private shakeUntil = 0;
  private shakeStart = 0;
  private shakeDuration = 1;
  private shakeStrength = 0;
  private lastShakeOffset = new THREE.Vector3();
  private readonly tacticalPosition = new THREE.Vector3(16, 12, 18);
  private readonly actionPosition = new THREE.Vector3(35, 25, 35);

  constructor(canvas: HTMLCanvasElement, onCommittedRotation: () => void) {
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.copy(this.tacticalPosition);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 9;
    this.controls.maxDistance = 58;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 0.75;
    this.controls.target.set(0, 0, 0);

    this.controls.addEventListener('start', () => { this.changedDuringGesture = false; });
    this.controls.addEventListener('change', () => { this.changedDuringGesture = true; });
    this.controls.addEventListener('end', () => {
      if (this.changedDuringGesture) onCommittedRotation();
      this.changedDuringGesture = false;
    });
  }

  triggerActionCamera(_speedMode = false): void {
    // Cinematic pullback disabled for the current prototype.
    // Keep the camera locked in tactical puzzle view; impact is handled by
    // panel-anchored strike VFX, hit stop, particles, and screen shake.
    this.mode = 'tactical';
    this.controls.enabled = true;
  }

  resetToTacticalCamera(): void {
    this.mode = 'tactical';
    new TWEEN.Tween(this.camera.position)
      .to({ x: this.tacticalPosition.x, y: this.tacticalPosition.y, z: this.tacticalPosition.z }, 420)
      .easing(TWEEN.Easing.Cubic.Out)
      .onComplete(() => { this.controls.enabled = true; })
      .start();
  }

  shake(strength: number, durationMs: number): void {
    const now = performance.now();
    this.shakeStrength = Math.max(this.shakeStrength, strength);
    this.shakeStart = now;
    this.shakeDuration = Math.max(1, durationMs);
    this.shakeUntil = Math.max(this.shakeUntil, now + durationMs);
  }

  update(): void {
    this.camera.position.sub(this.lastShakeOffset);
    this.lastShakeOffset.set(0, 0, 0);
    this.controls.update();
    const now = performance.now();
    if (now < this.shakeUntil) {
      const elapsed = now - this.shakeStart;
      const fade = 1 - Math.min(1, elapsed / this.shakeDuration);
      const amount = this.shakeStrength * fade;
      this.lastShakeOffset.set((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
      this.camera.position.add(this.lastShakeOffset);
    } else {
      this.shakeStrength = 0;
    }
    this.camera.lookAt(0, 0, 0);
  }

  resize(width: number, height: number): void { this.camera.aspect = width / Math.max(1, height); this.camera.updateProjectionMatrix(); }
  get cameraMode(): CameraMode { return this.mode; }
}
