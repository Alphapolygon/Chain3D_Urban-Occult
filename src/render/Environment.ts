// src/render/Environment.ts
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

export function buildEnvironment(scene: THREE.Scene): void {
  const floorGeo = new THREE.PlaneGeometry(300, 300);

  const mirror = new Reflector(floorGeo, {
    clipBias: 0.003,
    textureWidth: window.innerWidth * window.devicePixelRatio,
    textureHeight: window.innerHeight * window.devicePixelRatio,
   // color: 0x443355, 
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = -6.01; 

  const mirrorMat = mirror.material as THREE.ShaderMaterial;
  mirrorMat.transparent = true;
  mirrorMat.blending = THREE.NormalBlending;
  mirrorMat.depthWrite = false; 
  mirrorMat.fragmentShader = mirrorMat.fragmentShader.replace(
    'gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',
    `
    float brightness = max(max(base.r, base.g), base.b);

    vec2 screenUv = vUv.xy / vUv.w;
    float depthFade = smoothstep(0.02, 0.2, screenUv.y);
  
    float softAlpha = smoothstep(0.1, 0.8, brightness) * 0.4;
    gl_FragColor = vec4( blendOverlay( base.rgb, color ), softAlpha * depthFade );
    `
  );
  scene.add(mirror);


}