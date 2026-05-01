import './style.css';
import * as THREE from 'three';
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as TWEEN from '@tweenjs/tween.js';
import { BreachBoard } from './sim/BreachBoard';

import { HEROES } from './data/heroes';
import { RunState, type LastActionReport, type RunConfig, type RunSnapshot } from './sim/RunState';
import type { ShopItemId } from './sim/ShopSystem';
import { BreachRenderer } from './render/BreachRenderer';
import { BreachPicking } from './render/BreachPicking';
import { CameraRig } from './render/CameraRig';
import { HeroPanel } from './ui/HeroPanel';
import { EnemyPanel } from './ui/EnemyPanel';
import { QueuePreview } from './ui/QueuePreview';
import { DarkwebBodega } from './ui/DarkwebBodega';

const h = React.createElement;
const sceneRoot = document.querySelector<HTMLDivElement>('#scene-root');
const uiRoot = document.querySelector<HTMLDivElement>('#ui-root');
if (!sceneRoot || !uiRoot) throw new Error('Missing #scene-root or #ui-root.');

let runConfig: RunConfig = {
  board: { maxSize: 15, initialRadius: 4, initialCoreRadius: 1, fillPercent: 0.44, colorCount: 5, lockedPercent: 0.055, staticNoisePercent: 0.025, seed: 1337 },
  movesPerTurn: 3,
  queueLength: 5,
  scorePerBlock: 100,
  matchMinimum: 3,
  maxChains: 12
};

let run = new RunState(runConfig, HEROES.slice(0, 3));
run.startRun();

const scene = new THREE.Scene();
scene.background = new THREE.Color('#080611');
scene.fog = new THREE.Fog('#080611', 38, 84);

const webglRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
webglRenderer.setSize(window.innerWidth, window.innerHeight);
webglRenderer.outputColorSpace = THREE.SRGBColorSpace;
sceneRoot.appendChild(webglRenderer.domElement);

let speedMode = false;
const cameraRig = new CameraRig(webglRenderer.domElement, () => { run.playerRotateBreach(); invalidate(false); });
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
const floorGrid = new THREE.GridHelper(40, 40, '#44308f', '#1d1832');
floorGrid.position.y = -10;
scene.add(floorGrid);

let breachRenderer = new BreachRenderer(scene, run.board.cellCount);
const picking = new BreachPicking();
const root = createRoot(uiRoot);
let sceneDirty = true;
let pointerDownX = 0;
let pointerDownY = 0;
let processedAction: LastActionReport | null = null;
let hitStopUntil = 0;

// --- PARTICLE SYSTEM ---
const particleGroup = new THREE.Group();
scene.add(particleGroup);
const particleGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
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
      .onUpdate((obj) => {
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

function hitStop(ms: number): void {
  hitStopUntil = Math.max(hitStopUntil, performance.now() + (speedMode ? Math.min(40, ms) : ms));
}

function playLastActionVisuals(): void {
  const action = run.lastAction;
  if (processedAction === action) return;
  processedAction = action;

  if (action.snap?.movedIndices && action.snap.movedIndices.length > 0) breachRenderer.prepareSnapAnimation(action.snap.movedIndices);
  if (action.removedIndices && action.removedIndices.length > 0) spawnMatchParticles(action.removedIndices, run.board);

  const snapCells = action.snap?.cellsMoved ?? 0;
  const snapClusters = action.snap?.clustersMoved ?? 0;
  if (snapClusters > 0) {
    const shake = Math.min(2.2, 0.35 + snapCells * 0.035 + snapClusters * 0.14);
    cameraRig.shake(shake, Math.min(480, 130 + snapCells * 12));
  }
  if (action.hardKnockdown || snapCells > 5 || action.chain >= 2) {
    cameraRig.triggerActionCamera(speedMode);
    hitStop(action.hardKnockdown ? 160 : 100);
  }
}

// --- DEBUG MENU LOGIC ---
function applyDebugConfig(newConfig: RunConfig): void {
  const maxSize = newConfig.board.maxSize % 2 === 0 ? newConfig.board.maxSize + 1 : newConfig.board.maxSize;
  const initialRadius = Math.min(newConfig.board.initialRadius, Math.floor(maxSize / 2) - 1);
  runConfig = { ...newConfig, board: { ...newConfig.board, maxSize, initialRadius } };
  run = new RunState(runConfig, HEROES.slice(0, 3));
  run.startRun();
  breachRenderer.dispose(scene);
  breachRenderer = new BreachRenderer(scene, run.board.cellCount);
  processedAction = null;
  invalidate(true);
}

function DebugMenu({ config, onApply, speed, onToggleSpeed }: { config: RunConfig; onApply: (c: RunConfig) => void; speed: boolean; onToggleSpeed: () => void }) {
  const [maxSize, setMaxSize] = React.useState(config.board.maxSize);
  const [initRadius, setInitRadius] = React.useState(config.board.initialRadius);
  const [fillPercent, setFillPercent] = React.useState(config.board.fillPercent);

  return h('div', { className: 'panel debug-config' },
    h('div', { className: 'shop-title' }, 'Debug Config'),
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

function invalidate(boardChanged = true): void { sceneDirty = sceneDirty || boardChanged; renderUi(); }
function renderUi(): void { root.render(h(App, { snapshot: run.getSnapshot() })); }
function restartRun(): void { run.startRun((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0); processedAction = null; invalidate(true); }
function onActivateHero(heroIndex: number): void { if (run.tryActivateHeroPower(heroIndex)) { cameraRig.triggerActionCamera(speedMode); hitStop(120); playLastActionVisuals(); invalidate(true); } }
function onSwapCache(): void { if (run.playerSwapCache()) invalidate(false); }
function onBuy(itemId: ShopItemId): void { if (run.tryBuy(itemId)) { playLastActionVisuals(); invalidate(true); } else invalidate(false); }
function onContinueAfterShop(): void { run.continueAfterShop(); invalidate(true); }
function onForceAttack(): void { run.forceEnemyAttack(); playLastActionVisuals(); invalidate(true); }
function onGrowCore(amount: number): void { run.forceCoreGrowth(amount); playLastActionVisuals(); invalidate(true); }
function toggleSpeedMode(): void { speedMode = !speedMode; invalidate(false); }

function App({ snapshot }: { snapshot: RunSnapshot }) {
  return h(React.Fragment, null,
    h(DebugMenu, { config: runConfig, onApply: applyDebugConfig, speed: speedMode, onToggleSpeed: toggleSpeedMode }),
    h('div', { className: 'hud' },
      h('div', { className: 'side-column left-side' },
        h(QueuePreview, { queue: snapshot.queue, cacheColor: snapshot.cacheColor, cacheUsedThisTurn: snapshot.cacheUsedThisTurn, onSwapCache }),
        h(HeroPanel, { heroes: snapshot.heroes, frontlineIndex: snapshot.frontlineIndex, onActivate: onActivateHero })
      ),
      h('div', { className: 'center-help' },
        snapshot.shopOpen ? 'Shop is open. Click a Breach cell before buying cell-target items, then continue to the next monster.' : 'Click an exposed cube face to place the next block. Drag to rotate, but remember: rotation spends a move.'
      ),
      h('div', { className: 'side-column right-side' },
        h(EnemyPanel, { enemy: snapshot.enemy, wave: snapshot.wave, movesLeft: snapshot.movesLeft, score: snapshot.score, credits: snapshot.credits, enemiesDefeated: snapshot.enemiesDefeated, occupiedBlocks: snapshot.occupiedBlocks, coreRadius: snapshot.coreRadius, synergy: snapshot.synergy, lastAction: snapshot.lastAction, onForceAttack, onGrowCore1: () => onGrowCore(1), onGrowCore2: () => onGrowCore(2) }),
        h('div', { className: 'panel debug-row' },
          h('span', null, `Selected cell: ${snapshot.selectedCellIndex >= 0 ? snapshot.selectedCellIndex : 'none'}`),
          h('button', { onClick: restartRun }, 'Restart')
        )
      )
    ),
    h(DarkwebBodega, { open: snapshot.shopOpen, credits: snapshot.credits, selectedCellIndex: snapshot.selectedCellIndex, rerollsUsedThisShop: snapshot.rerollsUsedThisShop, onBuy, onContinue: onContinueAfterShop }),
    snapshot.runOver ? h('div', { className: 'game-over' }, h('div', { className: 'panel', style: { maxWidth: 520 } }, h('div', { className: 'shop-title' }, 'Run Ended'), h('p', null, snapshot.lossReason), h('p', null, `Score ${snapshot.score}. Enemies defeated ${snapshot.enemiesDefeated}.`), h('button', { onClick: restartRun }, 'Quick Restart'))) : null
  );
}

webglRenderer.domElement.addEventListener('pointerdown', (event) => { pointerDownX = event.clientX; pointerDownY = event.clientY; });
webglRenderer.domElement.addEventListener('pointerup', (event) => {
  if (Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY) > 5) return;
  const pick = picking.pick(event, webglRenderer.domElement, cameraRig.camera, breachRenderer, run.board);
  if (!pick) return;
  run.selectCell(pick.cellIndex);
  if (run.shopOpen || run.runOver) { invalidate(false); return; }
  if (pick.placementIndex >= 0) {
    run.playerPlaceAtIndex(pick.placementIndex);
    playLastActionVisuals();
    invalidate(true);
  }
  else invalidate(false);
});

window.addEventListener('resize', () => { webglRenderer.setSize(window.innerWidth, window.innerHeight); cameraRig.resize(window.innerWidth, window.innerHeight); });

function frame(): void {
  requestAnimationFrame(frame);
  const paused = performance.now() < hitStopUntil;
  if (!paused) TWEEN.update();
  cameraRig.update();
  if (sceneDirty) { breachRenderer.syncFromBoard(run.board); sceneDirty = false; }
  if (!paused) breachRenderer.update();
  webglRenderer.render(scene, cameraRig.camera);
}

invalidate(true);
frame();
