import * as THREE from 'three';

export function buildEnvironment(scene: THREE.Scene): THREE.Points {
  // Wet asphalt floor. This is intentionally huge so the Breach feels staged
  // inside a city block rather than floating in empty debug space.
  const floorGeo = new THREE.PlaneGeometry(300, 300);
  const floorMat = new THREE.MeshStandardMaterial({
    color: '#05040a',
    roughness: 0.15,
    metalness: 0.8
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -10;
  scene.add(floor);

  const grid = new THREE.GridHelper(100, 50, '#44308f', '#120d2b');
  grid.position.y = -9.98;
  scene.add(grid);

  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  const buildingMat = new THREE.MeshStandardMaterial({
    color: '#080611',
    roughness: 0.9,
    metalness: 0.1
  });

  const neonMatPink = new THREE.MeshBasicMaterial({ color: '#ff42d0' });
  const neonMatCyan = new THREE.MeshBasicMaterial({ color: '#27e7ff' });

  const spawnBuildings = (sideMultiplier: number): void => {
    for (let i = 0; i < 12; i++) {
      const h = 20 + Math.random() * 40;
      const w = 5 + Math.random() * 15;
      const d = 5 + Math.random() * 15;

      const building = new THREE.Mesh(buildingGeo, buildingMat);
      building.scale.set(w, h, d);
      building.position.set(
        (20 + Math.random() * 30) * sideMultiplier,
        -10 + h / 2,
        -15 - Math.random() * 60
      );
      scene.add(building);

      if (Math.random() > 0.4) {
        const strip = new THREE.Mesh(buildingGeo, Math.random() > 0.5 ? neonMatPink : neonMatCyan);
        strip.scale.set(0.3, h * (0.5 + Math.random() * 0.4), 0.3);
        strip.position.set(
          building.position.x - (w / 2 * sideMultiplier),
          building.position.y,
          building.position.z + d / 2 + 0.1
        );
        scene.add(strip);
      }
    }
  };

  spawnBuildings(-1);
  spawnBuildings(1);

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
  const particleMat = new THREE.PointsMaterial({
    size: 0.2,
    color: '#ff42d0',
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const particles = new THREE.Points(particleGeo, particleMat);
  particles.position.y = 5;
  scene.add(particles);

  return particles;
}
