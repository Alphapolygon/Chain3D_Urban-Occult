import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js';

type CameraMode = 'tactical' | 'action';

type FixedControls = {
  enabled: boolean;
  target: THREE.Vector3;
  update: () => void;
};

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: FixedControls;
  private mode: CameraMode = 'tactical';
  private shakeUntil = 0;
  private shakeStart = 0;
  private shakeDuration = 1;
  private shakeStrength = 0;
  private lastShakeOffset = new THREE.Vector3();
  private readonly tacticalPosition = new THREE.Vector3(16, 12, 18);

  constructor(_canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.copy(this.tacticalPosition);
    this.camera.lookAt(0, 0, 0);

    // Compatibility shim: main.ts still toggles controls.enabled to gate input,
    // but the camera no longer orbits. Dragging rotates the Breach group instead.
    this.controls = {
      enabled: true,
      target: new THREE.Vector3(0, 0, 0),
      update: () => undefined
    };
  }

  triggerActionCamera(_speedMode = false): void {
    // Cinematic pullback disabled. The camera stays locked in tactical view.
    this.mode = 'tactical';
    this.controls.enabled = true;
  }

  resetToTacticalCamera(): void {
    this.mode = 'tactical';
    new TWEEN.Tween(this.camera.position)
      .to({ x: this.tacticalPosition.x, y: this.tacticalPosition.y, z: this.tacticalPosition.z }, 320)
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

    const now = performance.now();
    if (now < this.shakeUntil) {
      const elapsed = now - this.shakeStart;
      const fade = 1 - Math.min(1, elapsed / this.shakeDuration);
      const amount = this.shakeStrength * fade;
      this.lastShakeOffset.set(
        (Math.random() - 0.5) * amount,
        (Math.random() - 0.5) * amount,
        (Math.random() - 0.5) * amount
      );
      this.camera.position.add(this.lastShakeOffset);
    } else {
      this.shakeStrength = 0;
    }

    this.camera.lookAt(0, 0, 0);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  get cameraMode(): CameraMode { return this.mode; }
}
