import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js';
import type { BreachBoard } from '../../sim/BreachBoard';
import { colorToCss } from '../../sim/CellBits';
import type { PowerCollectReport } from '../../sim/RunState';
import type { BreachRenderer } from '../BreachRenderer';
import type { FighterBillboard } from '../fighters/FighterBillboard';

export class BoardEffects {
  readonly particleGroup = new THREE.Group();
  private readonly particleMaterial = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  constructor(
    private readonly scene: THREE.Scene,
    private readonly cubeGeometry: THREE.BufferGeometry,
    private readonly cubeMaterial: THREE.Material
  ) {}

  attachToBreach(renderer: BreachRenderer): void {
    renderer.group.add(this.particleGroup);
  }

  spawnMatchParticles(indices: readonly number[], board: BreachBoard): void {
    const spacing = 1.08;
    const maxParticles = Math.min(indices.length, 80);
    for (let k = 0; k < maxParticles; k++) {
      const idx = indices[k];
      const mesh = new THREE.Mesh(this.cubeGeometry, this.particleMaterial.clone());
      const p = board.xyzOf(idx);
      mesh.position.set((p.x - board.center) * spacing, (p.y - board.center) * spacing, (p.z - board.center) * spacing);
      this.particleGroup.add(mesh);

      new TWEEN.Tween({ scale: 1, opacity: 1 })
        .to({ scale: 1.8, opacity: 0 }, 350)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate((obj: { scale: number; opacity: number }) => {
          mesh.scale.setScalar(obj.scale);
          (mesh.material as THREE.MeshBasicMaterial).opacity = obj.opacity;
        })
        .onComplete(() => {
          (mesh.material as THREE.Material).dispose();
          this.particleGroup.remove(mesh);
        })
        .start();
    }
  }

  spawnPowerCollectCubes(
    collects: readonly PowerCollectReport[] | undefined,
    board: BreachBoard,
    renderer: BreachRenderer,
    heroBillboards: readonly FighterBillboard[]
  ): void {
    if (!collects || collects.length === 0) return;

    for (const collect of collects) {
      const heroBillboard = heroBillboards[collect.heroIndex];
      if (!heroBillboard || collect.fromIndices.length === 0) continue;

      const target = heroBillboard.getPowerCollectWorldTarget();
      const cubeCount = Math.min(10, Math.max(1, Math.ceil(collect.amount / 6)));

      for (let i = 0; i < cubeCount; i++) {
        const fromIndex = collect.fromIndices[i % collect.fromIndices.length];
        const localStart = renderer.localPositionOf(board, fromIndex);
        const start = renderer.group.localToWorld(localStart.clone());
        const material = this.makeEffectCubeMaterial(collect.color);
        const cube = new THREE.Mesh(this.cubeGeometry, material);
        cube.position.copy(start);
        cube.scale.setScalar(0.25 + Math.random() * 0.08);
        cube.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        cube.renderOrder = 90;
        this.scene.add(cube);

        const delay = i * 34;
        const arc = 1.2 + Math.random() * 1.4;
        const startScale = cube.scale.x;
        const flight = { t: 0 };
        new TWEEN.Tween(flight)
          .delay(delay)
          .to({ t: 1 }, 620)
          .easing(TWEEN.Easing.Cubic.InOut)
          .onUpdate(() => {
            const t = flight.t;
            cube.position.lerpVectors(start, target, t);
            cube.position.y += Math.sin(t * Math.PI) * arc;
            cube.rotation.x += 0.16;
            cube.rotation.y += 0.21;
            const pulse = Math.sin(t * Math.PI);
            cube.scale.setScalar(startScale * (1 + pulse * 0.42) * (1 - t * 0.55));
            material.opacity = Math.max(0, 1 - Math.max(0, t - 0.72) / 0.28);
          })
          .onComplete(() => {
            material.dispose();
            this.scene.remove(cube);
          })
          .start();
      }
    }
  }

  private makeEffectCubeMaterial(color: number): THREE.MeshStandardMaterial {
    const material = this.cubeMaterial.clone() as THREE.MeshStandardMaterial;
    material.transparent = true;
    material.opacity = 0.96;
    material.depthWrite = false;
    material.color = new THREE.Color(colorToCss(color));
    material.emissive = new THREE.Color(colorToCss(color));
    material.emissiveIntensity = 0.65;
    return material;
  }
}
