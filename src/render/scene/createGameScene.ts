import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { CameraRig } from '../CameraRig';
import { buildEnvironment } from '../Environment';

export type GameScene = {
  scene: THREE.Scene;
  renderer: any;
  cameraRig: CameraRig;
  mirrorTarget: THREE.RenderTarget;
  mirrorCamera: THREE.PerspectiveCamera;
  mirrorMesh: THREE.Mesh;
};

export function createGameScene(sceneRoot: HTMLDivElement): GameScene {
  const scene = new THREE.Scene();
  scene.background = null;

  const renderer = new WebGPURenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  sceneRoot.appendChild(renderer.domElement);

  addLights(scene);
  
  // Extract the mirror assets!
  const { mirrorTarget, mirrorCamera, mirrorMesh } = buildEnvironment(scene);

  const cameraRig = new CameraRig(renderer.domElement);

  return { scene, renderer, cameraRig, mirrorTarget, mirrorCamera, mirrorMesh };
}

function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight('#ffffff', '#15111f', 4.0));
  const key = new THREE.DirectionalLight('#ffffff', 5.0);
  key.position.set(8, 12, 10);
  scene.add(key);
  const rim = new THREE.PointLight('#ff42d0', 150, 60);
  rim.position.set(-10, 8, -12);
  scene.add(rim);
  const cyanRim = new THREE.PointLight('#27e7ff', 90, 52);
  cyanRim.position.set(12, -2, 14);
  scene.add(cyanRim);
  const bounceLight = new THREE.DirectionalLight('#ff42d0', 6.0);
  bounceLight.position.set(0, -20, 0);
  scene.add(bounceLight);
}