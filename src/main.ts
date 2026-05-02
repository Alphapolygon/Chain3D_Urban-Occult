// src/main.ts
import './style.css';
import * as THREE from 'three';
import React from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createRoot } from 'react-dom/client';
import * as TWEEN from '@tweenjs/tween.js';
import { BreachBoard } from './sim/BreachBoard';

import { HEROES } from './data/heroes';
import type { HeroDefinition } from './sim/CombatSystem';
import { RunState, type LastActionReport, type RunConfig, type RunSnapshot } from './sim/RunState';
import type { ShopItemId } from './sim/ShopSystem';
import { colorToCss } from './sim/CellBits';
import { BreachRenderer } from './render/BreachRenderer';
import { BreachPicking } from './render/BreachPicking';
import { CameraRig } from './render/CameraRig';
import { QueuePreview } from './ui/QueuePreview';
import { DarkwebBodega } from './ui/DarkwebBodega';
import { PostRunScreen } from './ui/PostRunScreen';
import { DraftScreen } from './ui/DraftScreen';
import { SoundEngine } from './render/SoundEngine';
import { FighterBillboard } from './render/fighters/FighterBillboard';
import { buildEnvironment } from './render/Environment';
import { CharacterInfoPopup, type CharacterInfoSelection } from './ui/CharacterInfoPopup';
import type { PowerCollectReport } from './sim/RunState';

const h = React.createElement;
const sceneRoot = document.querySelector<HTMLDivElement>('#scene-root');
const uiRoot = document.querySelector<HTMLDivElement>('#ui-root');
if (!sceneRoot || !uiRoot) throw new Error('Missing #scene-root or #ui-root.');


let runConfig: RunConfig = {
  board: { maxSize: 15, initialRadius: 4, initialCoreRadius: 1, fillPercent: 0.44, colorCount: 5, lockedPercent: 0.055, staticNoisePercent: 0, seed: 1337 },
  movesPerTurn: 3,
  queueLength: 5,
  scorePerBlock: 100,
  matchMinimum: 3,
  maxChains: 12,
  enemyCoreGrowthChanceMin: 0.10,
  enemyCoreGrowthChanceMax: 0.25
};

let draftedHeroes: HeroDefinition[] = HEROES.slice(0, 3);
let gameStarted = false;
let run = new RunState(runConfig, draftedHeroes);

const scene = new THREE.Scene();
scene.background = null;


const webglRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
webglRenderer.setSize(window.innerWidth, window.innerHeight);
webglRenderer.outputColorSpace = THREE.SRGBColorSpace;
webglRenderer.setClearColor(0x000000, 0);
sceneRoot.appendChild(webglRenderer.domElement);

const gltfLoader = new GLTFLoader();
const cubeUrl = new URL('./assets/models/cube.glb', import.meta.url).href;
const gltf = await gltfLoader.loadAsync(cubeUrl);

let loadedGeo: THREE.BufferGeometry | undefined;
let loadedMat: THREE.Material | undefined;

gltf.scene.traverse((child) => {
  if (child instanceof THREE.Mesh && !loadedGeo) {
    loadedGeo = child.geometry.clone();
    loadedGeo.applyMatrix4(child.matrixWorld);
    
    // Center and normalize the imported model so board coordinates, ray hits,
    // preview/effect cubes, and the visible GLB mesh all agree.
    loadedGeo.computeBoundingBox();
    const center = new THREE.Vector3();
    loadedGeo.boundingBox!.getCenter(center);
    loadedGeo.translate(-center.x, -center.y, -center.z);
    loadedGeo.computeBoundingBox();
    const size = new THREE.Vector3();
    loadedGeo.boundingBox!.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    loadedGeo.scale(0.94 / maxDim, 0.94 / maxDim, 0.94 / maxDim);

    // Keep the model's baked texture, but apply our neon game-feel to it. Clone
    // the material so rebuilding/disposal never mutates GLTF-loader internals.
    const sourceMat = child.material instanceof THREE.MeshStandardMaterial ? child.material : new THREE.MeshStandardMaterial();
    const mat = sourceMat.clone();
    mat.roughness = 0.15;
    mat.metalness = 0.2;
    mat.emissive = new THREE.Color('#2a1b42');
    mat.emissiveIntensity = 0.6;
    mat.color = new THREE.Color('#ffffff'); // InstancedMesh multiplies this with instanceColor
    loadedMat = mat;
  }
});

if (!loadedGeo || !loadedMat) throw new Error("Failed to load cube.glb mesh");
const cubeGeo = loadedGeo;
const cubeMat = loadedMat;



let speedMode = false;
let selectedCharacter: CharacterInfoSelection | null = null;
const cameraRig = new CameraRig(webglRenderer.domElement);
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

// The Bounce Light (ESSENTIAL so the mirror can see the bottom of the cube)
const bounceLight = new THREE.DirectionalLight('#ff42d0', 6.0); 
bounceLight.position.set(0, -20, 0); 
scene.add(bounceLight);

buildEnvironment(scene);

// ---> 3. PASS THE ASSETS TO BREACH RENDERER <---
// (Scroll down to line ~54 and update the instantiation)
let breachRenderer = new BreachRenderer(scene, run.board.cellCount, cubeGeo, cubeMat);
const picking = new BreachPicking();

// REPOSITIONED FOR 2X ZOOM: Heroes on the left, Enemy on the right, floor raised to Y: -9.0
const heroBillboardBasePositions = [
  new THREE.Vector3(-19.0, -9.0, -3.0), // Back row (hugs left edge)
  new THREE.Vector3(-16.0, -9.0, 0.0),  // Middle row
  new THREE.Vector3(-13.0, -9.0, 3.0)   // Front row
];
const enemyBillboardBasePosition = new THREE.Vector3(13.0, -9.0, 0.0);

const heroBillboards = heroBillboardBasePositions.map((position) => new FighterBillboard(scene, position, false));
const enemyBillboard = new FighterBillboard(scene, enemyBillboardBasePosition, true);

heroBillboards.forEach((billboard, index) => {
  billboard.setClickHandler(() => {
    if (!gameStarted) return;
    selectedCharacter = { kind: 'hero', index };
    invalidate(false);
  });
});
enemyBillboard.setClickHandler(() => {
  if (!gameStarted) return;
  selectedCharacter = { kind: 'enemy' };
  invalidate(false);
});

const root = createRoot(uiRoot);
let sceneDirty = true;
let pointerDownX = 0;
let pointerDownY = 0;
let lastPointerX = 0;
let lastPointerY = 0;
let pointerIsDown = false;
let dragRotatedBreach = false;
let dragExceededClickThreshold = false;
let processedAction: LastActionReport | null = null;
let hitStopUntil = 0;
let koShopTimeout: number | null = null;
let enemyTurnTimeout: number | null = null;
const sfx = new SoundEngine();

const MIN_TEXT_DISPLAY_MS = 1000;
const ENEMY_TURN_DELAY_MS = 1080;
const KO_TO_SHOP_DELAY_MS = 1500;

function canInteractWithBreach(): boolean {
  return gameStarted && run.phase === 'playing' && !run.shopOpen && !run.runOver;
}

function syncBreachInputEnabled(): void {
  cameraRig.controls.enabled = canInteractWithBreach();
}

const particleGroup = new THREE.Group();
breachRenderer.group.add(particleGroup);
const particleGeo = cubeGeo;
const particleMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });

function spawnMatchParticles(indices: readonly number[], board: BreachBoard): void {
  const spacing = 1.08;
  const maxParticles = Math.min(indices.length, 80);
  for (let k = 0; k < maxParticles; k++) {
    const idx = indices[k];
    const mesh = new THREE.Mesh(particleGeo, particleMat.clone());
    const p = board.xyzOf(idx);
    mesh.position.set((p.x - board.center) * spacing, (p.y - board.center) * spacing, (p.z - board.center) * spacing);
    particleGroup.add(mesh);

    new TWEEN.Tween({ scale: 1, opacity: 1 })
      .to({ scale: 1.8, opacity: 0 }, 350)
      .easing(TWEEN.Easing.Quadratic.Out)
      .onUpdate((obj: { scale: number; opacity: number }) => {
        mesh.scale.setScalar(obj.scale);
        const material = mesh.material as THREE.MeshBasicMaterial;
        material.opacity = obj.opacity;
      })
      .onComplete(() => {
        (mesh.material as THREE.Material).dispose();
        particleGroup.remove(mesh);
      })
      .start();
  }
}

function makeEffectCubeMaterial(color: number): THREE.MeshStandardMaterial {
  const material = cubeMat.clone() as THREE.MeshStandardMaterial;
  material.transparent = true;
  material.opacity = 0.96;
  material.depthWrite = false;
  material.color = new THREE.Color(colorToCss(color));
  material.emissive = new THREE.Color(colorToCss(color));
  material.emissiveIntensity = 0.65;
  return material;
}

function spawnPowerCollectCubes(collects: readonly PowerCollectReport[] | undefined): void {
  if (!collects || collects.length === 0) return;

  for (const collect of collects) {
    const heroBillboard = heroBillboards[collect.heroIndex];
    if (!heroBillboard || collect.fromIndices.length === 0) continue;

    const target = heroBillboard.getPowerCollectWorldTarget();
    const cubeCount = Math.min(10, Math.max(1, Math.ceil(collect.amount / 6)));

    for (let i = 0; i < cubeCount; i++) {
      const fromIndex = collect.fromIndices[i % collect.fromIndices.length];
      const localStart = breachRenderer.localPositionOf(run.board, fromIndex);
      const start = breachRenderer.group.localToWorld(localStart.clone());
      const material = makeEffectCubeMaterial(collect.color);
      const cube = new THREE.Mesh(cubeGeo, material);
      cube.position.copy(start);
      cube.scale.setScalar(0.25 + Math.random() * 0.08);
      cube.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      cube.renderOrder = 90;
      scene.add(cube);

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
          scene.remove(cube);
        })
        .start();
    }
  }
}

type CombatEffectKind = 'player' | 'enemy' | 'ko' | 'invalid' | 'enemy-turn';
type CombatEffectAnchor = 'enemy' | 'heroes' | 'screen';

function combatEffectDuration(kind: CombatEffectKind): number {
  if (kind === 'ko') return Math.max(MIN_TEXT_DISPLAY_MS, 1350);
  if (kind === 'enemy-turn') return Math.max(MIN_TEXT_DISPLAY_MS, ENEMY_TURN_DELAY_MS);
  if (kind === 'invalid') return MIN_TEXT_DISPLAY_MS;
  return 620;
}

function effectAnchorPoint(anchor: CombatEffectAnchor): { x: number; y: number } {
  if (anchor === 'enemy') return enemyBillboard.getScreenAnchor(cameraRig.camera, webglRenderer.domElement, 5.7);
  if (anchor === 'heroes') {
    const hero = heroBillboards[Math.max(0, Math.min(heroBillboards.length - 1, run.frontlineIndex))];
    return hero.getScreenAnchor(cameraRig.camera, webglRenderer.domElement, 4.4);
  }
  return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 };
}

function spawnCombatSlash(kind: CombatEffectKind, anchor: CombatEffectAnchor): void {
  const el = document.createElement('div');
  el.className = `combat-slash ${kind} anchor-${anchor} world-anchored`;
  el.textContent = kind === 'ko' ? 'K.O.' : kind === 'invalid' ? 'BLOCKED' : kind === 'enemy-turn' ? 'ENEMY TURN' : '';

  const width = kind === 'invalid' ? 420 : kind === 'ko' ? 620 : 520;
  const height = kind === 'invalid' ? 150 : kind === 'ko' ? 210 : 190;
  const point = effectAnchorPoint(anchor);
  el.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, point.x - width * 0.5))}px`;
  el.style.top = `${Math.max(8, Math.min(window.innerHeight - height - 8, point.y - height * 0.55))}px`;
  el.style.width = `${Math.min(window.innerWidth - 16, width)}px`;
  el.style.height = `${height}px`;
  document.body.appendChild(el);

  window.setTimeout(() => el.remove(), combatEffectDuration(kind));
}

function hitStop(ms: number): void {
  hitStopUntil = Math.max(hitStopUntil, performance.now() + (speedMode ? Math.min(40, ms) : ms));
}

function clearKoShopTimer(): void {
  if (koShopTimeout !== null) {
    window.clearTimeout(koShopTimeout);
    koShopTimeout = null;
  }
}

function clearEnemyTurnTimer(): void {
  if (enemyTurnTimeout !== null) {
    window.clearTimeout(enemyTurnTimeout);
    enemyTurnTimeout = null;
  }
}

function scheduleShopAfterKo(): void {
  if (koShopTimeout !== null || run.getSnapshot().phase !== 'ko') return;
  koShopTimeout = window.setTimeout(() => {
    koShopTimeout = null;
    if (run.openShopAfterKo()) invalidate(false);
  }, KO_TO_SHOP_DELAY_MS);
}

function scheduleEnemyAttackAfterTurnBanner(): void {
  if (enemyTurnTimeout !== null || run.getSnapshot().phase !== 'enemy-turn') return;
  enemyTurnTimeout = window.setTimeout(() => {
    enemyTurnTimeout = null;
    if (run.resolveEnemyTurnAttack()) {
      playLastActionVisuals();
      invalidate(true);
    }
  }, ENEMY_TURN_DELAY_MS);
}

function playLastActionVisuals(): void {
  const action = run.lastAction;
  if (processedAction === action) return;
  processedAction = action;

  const snapCells = action.snap?.cellsMoved ?? 0;
  const snapClusters = action.snap?.clustersMoved ?? 0;

  if (action.invalidPlacement) sfx.playError();
  if (action.removedIndices && action.removedIndices.length > 0) sfx.playMatch(Math.max(1, action.chain));
  if (snapClusters > 0) sfx.playSnap(snapCells);
  if (action.playerAttack) sfx.playSlash(false);
  if (action.enemyAttack) sfx.playSlash(true);

  if (action.snap?.movedIndices && action.snap.movedIndices.length > 0) breachRenderer.prepareSnapAnimation(action.snap.movedIndices);
  if (action.removedIndices && action.removedIndices.length > 0) spawnMatchParticles(action.removedIndices, run.board);
  spawnPowerCollectCubes(action.powerCollects);

  if (action.enemyTurn) {
    spawnCombatSlash('enemy-turn', 'enemy');
    cameraRig.triggerActionCamera(speedMode);
    cameraRig.shake(0.32, 180);
  }
  if (action.playerAttack) {
    const snapshot = run.getSnapshot();
    const attackerIndex = Math.max(0, Math.min(heroBillboards.length - 1, action.sourceHeroIndex ?? snapshot.frontlineIndex));
    const attacker = heroBillboards[attackerIndex];
    if (action.heroPower) attacker?.triggerSpecial(760);
    else attacker?.triggerAttack(540);

    if (action.enemyDefeated) enemyBillboard.triggerDeath();
    else enemyBillboard.triggerHit(0.55);

    spawnCombatSlash(action.enemyDefeated ? 'ko' : 'player', 'enemy');
    cameraRig.triggerActionCamera(speedMode);
    cameraRig.shake(action.enemyDefeated ? 2.4 : 0.75, action.enemyDefeated ? 620 : 240);
    hitStop(action.enemyDefeated ? 220 : 80);
  }
  if (action.heroPower && !action.playerAttack) {
    const snapshot = run.getSnapshot();
    const casterIndex = Math.max(0, Math.min(heroBillboards.length - 1, action.sourceHeroIndex ?? snapshot.frontlineIndex));
    heroBillboards[casterIndex]?.triggerSpecial(760);
  }
  if (action.enemyAttack) {
    const snapshot = run.getSnapshot();
    enemyBillboard.triggerAttack(620);
    if (snapshot.wave >= 11) {
      for (let i = 0; i < snapshot.heroes.length; i++) {
        const hero = snapshot.heroes[i];
        if (!hero) continue;
        if (hero.hp <= 0) heroBillboards[i]?.triggerDeath();
        else heroBillboards[i]?.triggerHit(0.42);
      }
    } else {
      const defenderIndex = Math.max(0, Math.min(heroBillboards.length - 1, snapshot.frontlineIndex));
      const defender = snapshot.heroes[defenderIndex];
      if (defender?.hp <= 0) heroBillboards[defenderIndex]?.triggerDeath();
      else heroBillboards[defenderIndex]?.triggerHit(0.46);
    }
    spawnCombatSlash('enemy', 'heroes');
    cameraRig.triggerActionCamera(speedMode);
    cameraRig.shake(action.coreGrew ? 1.35 : 0.9, action.coreGrew ? 420 : 280);
    hitStop(110);
  }
  if (action.invalidPlacement) {
    spawnCombatSlash('invalid', 'screen');
    cameraRig.shake(0.22, 120);
  }

  if (snapClusters > 0) {
    const shake = Math.min(2.2, 0.35 + snapCells * 0.035 + snapClusters * 0.14);
    cameraRig.shake(shake, Math.min(480, 130 + snapCells * 12));
  }
  if (action.hardKnockdown || snapCells > 5 || action.chain >= 2) {
    cameraRig.triggerActionCamera(speedMode);
    hitStop(action.hardKnockdown ? 160 : 100);
  }
  if (action.enemyTurn) scheduleEnemyAttackAfterTurnBanner();
  if (action.enemyDefeated) scheduleShopAfterKo();
}

function syncFighterVisuals(): void {
  const snapshot = run.getSnapshot();
  const visible = gameStarted;
  for (const billboard of heroBillboards) billboard.setVisible(visible);
  enemyBillboard.setVisible(visible);
  if (!visible) return;

  for (let i = 0; i < heroBillboards.length; i++) {
    const hero = snapshot.heroes[i];
    const billboard = heroBillboards[i];
    if (!hero) { billboard.setVisible(false); continue; }
    billboard.setVisible(true);

    const isFrontline = i === snapshot.frontlineIndex;
    const base = heroBillboardBasePositions[i];
    const target = base.clone();
    
    // UPDATE FRONTLINE STEP DISTANCE
    if (isFrontline) {
      target.x = -9.5; // Walk up, but safely stay on the left side
      target.z = 2.0; 
    }
    
    billboard.setBasePosition(target);
    billboard.group.position.lerp(target, 0.14);
    billboard.syncState(hero, isFrontline, cameraRig.camera, {
      showAp: true,
      ready: hero.hp > 0 && hero.ap >= hero.maxAp,
      attackTimerText: hero.hp > 0 && hero.ap >= hero.maxAp ? 'SPECIAL READY' : ''
    });
  }

  enemyBillboard.setBasePosition(enemyBillboardBasePosition);
  enemyBillboard.group.position.lerp(enemyBillboardBasePosition, 0.08);
  const timerText = snapshot.phase === 'enemy-turn'
    ? 'ATTACK INCOMING'
    : snapshot.phase === 'ko'
      ? 'BANISHED'
      : `ATTACKS IN ${snapshot.enemy.attackTimer} MOVES`;
  enemyBillboard.syncState(snapshot.enemy, false, cameraRig.camera, { showAp: false, attackTimerText: timerText });
}

function applyDebugConfig(newConfig: RunConfig): void {
  clearKoShopTimer();
  clearEnemyTurnTimer();
  const maxSize = newConfig.board.maxSize % 2 === 0 ? newConfig.board.maxSize + 1 : newConfig.board.maxSize;
  const initialRadius = Math.min(newConfig.board.initialRadius, Math.floor(maxSize / 2) - 1);
  runConfig = { ...newConfig, board: { ...newConfig.board, maxSize, initialRadius } };
  run = new RunState(runConfig, draftedHeroes);
  run.startRun();
  gameStarted = true;
  breachRenderer.dispose(scene);
  breachRenderer = new BreachRenderer(scene, run.board.cellCount, cubeGeo, cubeMat);
  breachRenderer.group.add(particleGroup);
  processedAction = null;
  selectedCharacter = null;
  invalidate(true);
}

function DebugMenu({ config, onApply, speed, onToggleSpeed, onClose }: { config: RunConfig; onApply: (c: RunConfig) => void; speed: boolean; onToggleSpeed: () => void; onClose: () => void }) {
  const [maxSize, setMaxSize] = React.useState(config.board.maxSize);
  const [initRadius, setInitRadius] = React.useState(config.board.initialRadius);
  const [fillPercent, setFillPercent] = React.useState(config.board.fillPercent);

  return h('div', { className: 'panel debug-config' },
    h('div', { className: 'debug-config-title' },
      h('div', { className: 'shop-title' }, 'Debug Config'),
      h('button', { className: 'debug-close', onClick: onClose, title: 'Close debug menu' }, 'x')
    ),
    h('label', null, `Max Grid Boundary: ${maxSize}`),
    h('input', { type: 'range', min: 7, max: 31, step: 2, value: maxSize, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setMaxSize(parseInt(e.target.value, 10)) }),
    h('label', null, `Starting Radius: ${initRadius}`),
    h('input', { type: 'range', min: 2, max: Math.max(2, Math.floor(maxSize / 2) - 1), value: Math.min(initRadius, Math.floor(maxSize / 2) - 1), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setInitRadius(parseInt(e.target.value, 10)) }),
    h('label', null, `Fill: ${Math.round(fillPercent * 100)}%`),
    h('input', { type: 'range', min: 0.2, max: 0.8, step: 0.01, value: fillPercent, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFillPercent(parseFloat(e.target.value)) }),
    h('button', { onClick: () => onApply({ ...config, board: { ...config.board, maxSize, initialRadius: initRadius, fillPercent } }) }, 'Apply & Rebuild Board'),
    h('button', { className: speed ? 'speed enabled' : 'speed', onClick: onToggleSpeed }, speed ? 'Speed Mode ON' : 'Speed Mode OFF')
  );
}

function SpecialControls({ snapshot }: { snapshot: RunSnapshot }) {
  return h('div', { className: 'special-strip' },
    h('div', { className: 'queue-title' }, 'Specials'),
    ...snapshot.heroes.map((hero, index) => {
      const ready = hero.hp > 0 && hero.ap >= hero.maxAp;
      const isFront = index === snapshot.frontlineIndex;
      return h('button', {
        key: hero.id,
        className: ready ? 'special-button ready' : 'special-button',
        style: { '--hero-color': colorToCss(hero.color) } as React.CSSProperties,
        disabled: !ready || snapshot.phase !== 'playing',
        onClick: () => onActivateHero(index)
      }, `${hero.name}${isFront ? ' // FRONT' : ''} · ${ready ? 'CAST' : `AP ${hero.ap}/${hero.maxAp}`}`);
    })
  );
}

function RunMiniPanel({ snapshot }: { snapshot: RunSnapshot }) {
  return h('div', { className: 'run-mini-panel' },
    h('div', null, h('strong', null, `Wave ${snapshot.wave}`), h('span', null, `Score ${snapshot.score}`)),
    h('div', null, h('span', null, `${snapshot.enemy.name}`), h('strong', null, `HP ${snapshot.enemy.hp}/${snapshot.enemy.maxHp}`)),
    h('div', null, h('span', null, `Breach ${snapshot.occupiedBlocks} blocks`), h('span', null, `Core ${snapshot.coreRadius}`)),
    h('div', { className: 'debug-row mini-buttons' },
      h('button', { onClick: onForceAttack }, 'Force attack'),
      h('button', { onClick: () => onGrowCore(1) }, 'Core +1'),
      h('button', { onClick: () => onGrowCore(2) }, 'Core +2'),
      h('button', { onClick: restartRun }, 'Restart')
    ),
    h('div', { className: 'last-action' }, snapshot.lastAction.text),
    h('div', { className: 'selected-cell' }, `Selected cell: ${snapshot.selectedCellIndex >= 0 ? snapshot.selectedCellIndex : 'none'}`)
  );
}

function invalidate(boardChanged = true): void {
  sceneDirty = sceneDirty || boardChanged;
  renderUi();
}

function renderUi(): void {
  sceneRoot!.classList.toggle('draft-active', !gameStarted);
  root.render(h(App, { snapshot: run.getSnapshot() }));
}

function startRunWithDraft(draft: HeroDefinition[]): void {
  clearKoShopTimer();
  clearEnemyTurnTimer();
  draftedHeroes = draft.slice(0, 3);
  if (draftedHeroes.length < 3) draftedHeroes = HEROES.slice(0, 3);
  run = new RunState(runConfig, draftedHeroes);
  run.startRun((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  gameStarted = true;
  breachRenderer.dispose(scene);
  breachRenderer = new BreachRenderer(scene, run.board.cellCount, cubeGeo, cubeMat);
  breachRenderer.group.add(particleGroup);
  processedAction = null;
  selectedCharacter = null;
  invalidate(true);
}

function restartRun(): void {
  if (!gameStarted) { renderUi(); return; }
  clearKoShopTimer();
  clearEnemyTurnTimer();
  run.startRun((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  processedAction = null;
  selectedCharacter = null;
  invalidate(true);
}

function returnToDraft(): void {
  clearKoShopTimer();
  clearEnemyTurnTimer();
  gameStarted = false;
  processedAction = null;
  selectedCharacter = null;
  invalidate(true);
}

function onActivateHero(heroIndex: number): void { if (run.tryActivateHeroPower(heroIndex)) { playLastActionVisuals(); invalidate(true); } }
function onSwapCache(): void { if (run.playerSwapCache()) invalidate(false); }
function onBuy(itemId: ShopItemId): void { if (run.tryBuy(itemId)) { playLastActionVisuals(); invalidate(true); } else invalidate(false); }
function onContinueAfterShop(): void { clearKoShopTimer(); clearEnemyTurnTimer(); run.continueAfterShop(); invalidate(true); }
function onForceAttack(): void { run.forceEnemyAttack(); playLastActionVisuals(); invalidate(true); }
function onGrowCore(amount: number): void { run.forceCoreGrowth(amount); playLastActionVisuals(); invalidate(true); }
function toggleSpeedMode(): void { speedMode = !speedMode; invalidate(false); }
function closeCharacterInfo(): void { selectedCharacter = null; invalidate(false); }

function App({ snapshot }: { snapshot: RunSnapshot }) {
  const [debugOpen, setDebugOpen] = React.useState(true);
  if (!gameStarted) {
    return h(DraftScreen, { heroes: HEROES, initialSelectedIds: draftedHeroes.map((hero) => hero.id), onStart: startRunWithDraft });
  }
  const helpText = snapshot.phase === 'ko'
    ? 'K.O. Nightmare banished. Darkweb Bodega is connecting...'
    : snapshot.phase === 'enemy-turn'
      ? 'ENEMY TURN. Brace for impact.'
      : snapshot.shopOpen
        ? 'Shop is open. Breach input is locked until you continue to the next monster.'
        : 'Click an exposed cube face to place the next block. Drag the Breach itself to rotate it freely.';

  return h(React.Fragment, null,
    debugOpen
      ? h(DebugMenu, { config: runConfig, onApply: applyDebugConfig, speed: speedMode, onToggleSpeed: toggleSpeedMode, onClose: () => setDebugOpen(false) })
      : h('button', { className: 'debug-toggle', onClick: () => setDebugOpen(true), title: 'Open debug menu' }, 'Debug'),
    h('div', { className: 'hud world-fighter-overlay' },
      h('div', { className: 'side-column left-side' },
        h(QueuePreview, { queue: snapshot.queue, cacheColor: snapshot.cacheColor, cacheUsedThisTurn: snapshot.cacheUsedThisTurn, onSwapCache }),
        h(SpecialControls, { snapshot })
      ),
      h('div', { className: 'center-help' }, helpText),
      h('div', { className: 'side-column right-side' },
        h(RunMiniPanel, { snapshot })
      )
    ),
    h(CharacterInfoPopup, { selection: selectedCharacter, heroes: snapshot.heroes, enemy: snapshot.enemy, frontlineIndex: snapshot.frontlineIndex, onClose: closeCharacterInfo }),
    h(DarkwebBodega, { open: snapshot.shopOpen, credits: snapshot.credits, selectedCellIndex: snapshot.selectedCellIndex, rerollsUsedThisShop: snapshot.rerollsUsedThisShop, onBuy, onContinue: onContinueAfterShop }),
    snapshot.phase === 'enemy-turn' ? h('div', { className: 'enemy-turn-banner' }, 'ENEMY TURN') : null,
    snapshot.phase === 'ko' ? h('div', { className: 'ko-banner' }, 'NIGHTMARE BANISHED') : null,
    snapshot.runOver ? h(PostRunScreen, {
      lossReason: snapshot.lossReason,
      score: snapshot.score,
      enemiesDefeated: snapshot.enemiesDefeated,
      xpAwarded: snapshot.metaXpAwarded,
      heroes: snapshot.heroes,
      report: snapshot.metaProgressReport,
      onRestart: restartRun,
      onDraft: returnToDraft
    }) : null
  );
}

webglRenderer.domElement.addEventListener('pointerdown', (event: PointerEvent) => {
  sfx.init();
  pointerDownX = event.clientX;
  pointerDownY = event.clientY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  pointerIsDown = true;
  dragRotatedBreach = false;
  dragExceededClickThreshold = false;
  syncBreachInputEnabled();
  try { webglRenderer.domElement.setPointerCapture(event.pointerId); } catch { }
});

webglRenderer.domElement.addEventListener('pointermove', (event: PointerEvent) => {
  if (!pointerIsDown || !canInteractWithBreach()) return;
  const totalDistance = Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY);
  const dx = event.clientX - lastPointerX;
  const dy = event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;

  if (totalDistance <= 5 && !dragExceededClickThreshold) return;
  dragExceededClickThreshold = true;
  if (Math.abs(dx) + Math.abs(dy) <= 0) return;

  breachRenderer.rotateByDrag(dx, dy);
  dragRotatedBreach = true;
  event.preventDefault();
});

webglRenderer.domElement.addEventListener('pointerup', (event: PointerEvent) => {
  const totalDistance = Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY);
  const shouldTreatAsRotation = dragRotatedBreach || totalDistance > 5;
  pointerIsDown = false;
  try { webglRenderer.domElement.releasePointerCapture(event.pointerId); } catch { }

  if (shouldTreatAsRotation) {
    // Rotation is now purely tactical viewing. It must not spend a move or
    // advance enemy attack timing.
    dragRotatedBreach = false;
    dragExceededClickThreshold = false;
    invalidate(false);
    return;
  }

  if (!canInteractWithBreach()) {
    syncBreachInputEnabled();
    return;
  }

  const pick = picking.pick(event, webglRenderer.domElement, cameraRig.camera, breachRenderer, run.board);
  if (!pick) {
    run.reportInvalidPlacement('No Breach block under cursor. Click a visible cube face.');
    playLastActionVisuals();
    invalidate(false);
    return;
  }

  run.selectCell(pick.cellIndex);
  if (pick.placementIndex >= 0) {
    if (!run.playerPlaceAtIndex(pick.placementIndex) && pick.reason) run.reportInvalidPlacement(pick.reason);
    playLastActionVisuals();
    invalidate(true);
  } else {
    run.reportInvalidPlacement(pick.reason ?? 'No valid empty placement cell around that block.');
    playLastActionVisuals();
    invalidate(false);
  }
});

webglRenderer.domElement.addEventListener('pointercancel', (event: PointerEvent) => {
  pointerIsDown = false;
  dragRotatedBreach = false;
  dragExceededClickThreshold = false;
  try { webglRenderer.domElement.releasePointerCapture(event.pointerId); } catch { }
});

window.addEventListener('resize', () => {
  webglRenderer.setSize(window.innerWidth, window.innerHeight);
  cameraRig.resize(window.innerWidth, window.innerHeight);
});

function frame(): void {
  requestAnimationFrame(frame);
  const paused = performance.now() < hitStopUntil;
  if (!paused) TWEEN.update();
  syncBreachInputEnabled();
  cameraRig.update();
  syncFighterVisuals();
  if (sceneDirty) { breachRenderer.syncFromBoard(run.board); sceneDirty = false; }
  if (!paused) breachRenderer.update();
  webglRenderer.render(scene, cameraRig.camera);
}

invalidate(true);
frame();