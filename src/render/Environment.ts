// src/render/Environment.ts
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

export function buildEnvironment(scene: THREE.Scene): void {
  const floorGeo = new THREE.PlaneGeometry(300, 300);

  const mirror = new Reflector(floorGeo, {
    clipBias: 0.003,
    textureWidth: window.innerWidth * window.devicePixelRatio,
    textureHeight: window.innerHeight * window.devicePixelRatio,
    color: 0x443355, 
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = -9.0; 

  // THE ULTIMATE REFLECTION FIX: 
  // We use `smoothstep` to create a soft, gradient-like falloff for the glow.
  // This eliminates the pixelated "nasty" look and perfectly matches the CSS sprites.
  const mirrorMat = mirror.material as THREE.ShaderMaterial;
  mirrorMat.transparent = true;
  mirrorMat.blending = THREE.NormalBlending;
  mirrorMat.depthWrite = false; 
  mirrorMat.fragmentShader = mirrorMat.fragmentShader.replace(
    'gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',
    `
    float brightness = max(max(base.r, base.g), base.b);
    // Create a buttery soft fade, and cap the max opacity at 40%
    float softAlpha = smoothstep(0.1, 0.8, brightness) * 0.4;
    gl_FragColor = vec4( blendOverlay( base.rgb, color ), softAlpha );
    `
  );
  scene.add(mirror);

  // Floating Occult Ash
  const particleCount = 600;
  const posArray = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const offset = i * 3;
    posArray[offset + 0] = (Math.random() - 0.5) * 150;
    posArray[offset + 1] = (Math.random() - 0.5) * 70;
    posArray[offset + 2] = (Math.random() - 0.5) * 150;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const pMat = new THREE.PointsMaterial({
    size: 0.2, color: '#ff42d0', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const particles = new THREE.Points(particleGeo, pMat);
  particles.position.y = -4;
  scene.add(particles);
}