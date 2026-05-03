// src/render/Environment.ts
import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { texture, max, smoothstep, mix, vec4, color, vec2, screenUV } from 'three/tsl';

export type EnvironmentAssets = {
  mirrorTarget: THREE.RenderTarget;
  mirrorCamera: THREE.PerspectiveCamera;
  mirrorMesh: THREE.Mesh;
};

export function buildEnvironment(scene: THREE.Scene): EnvironmentAssets {
  // 1. Create a raw RenderTarget for our WebGPU camera


  


  return {} as any;
}