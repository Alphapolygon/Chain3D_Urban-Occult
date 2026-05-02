import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CubeModelAssets } from './CubeModelAssets';

export async function loadCubeModel(): Promise<CubeModelAssets> {
  const loader = new GLTFLoader();
  const cubeUrl = new URL('../../assets/models/cube.glb', import.meta.url).href;
  const gltf = await loader.loadAsync(cubeUrl);

  let geometry: THREE.BufferGeometry | undefined;
  let material: THREE.Material | undefined;

  gltf.scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || geometry) return;

    const geo = child.geometry.clone();
    geo.applyMatrix4(child.matrixWorld);
    normalizeGeometryToBoardCell(geo);

    const sourceMat = child.material instanceof THREE.MeshStandardMaterial
      ? child.material
      : new THREE.MeshStandardMaterial();
    const mat = sourceMat.clone();
    mat.roughness = 0.15;
    mat.metalness = 0.2;
    mat.emissive = new THREE.Color('#2a1b42');
    mat.emissiveIntensity = 0.6;
    mat.color = new THREE.Color('#ffffff');

    geometry = geo;
    material = mat;
  });

  if (!geometry || !material) throw new Error('Failed to load cube.glb mesh');
  return { geometry, material };
}

function normalizeGeometryToBoardCell(geometry: THREE.BufferGeometry): void {
  geometry.computeBoundingBox();
  if (!geometry.boundingBox) return;

  const center = new THREE.Vector3();
  geometry.boundingBox.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);

  geometry.computeBoundingBox();
  if (!geometry.boundingBox) return;

  const size = new THREE.Vector3();
  geometry.boundingBox.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) geometry.scale(0.94 / maxDim, 0.94 / maxDim, 0.94 / maxDim);
}
