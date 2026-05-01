import './style.css';
import * as THREE from 'three';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { HEROES } from './data/heroes';
import { RunState, type RunConfig, type RunSnapshot } from './sim/RunState';
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

const runConfig: RunConfig = {
  board: { maxSize: 31, initialRadius: 6, initialCoreRadius: 1, fillPercent: 0.44, colorCount: 5, lockedPercent: 0.055, staticNoisePercent: 0.025, seed: 1337 },
  movesPerTurn: 3,
  queueLength: 5,
  scorePerBlock: 100,
  matchMinimum: 3,
  maxChains: 12
};

const run = new RunState(runConfig, HEROES.slice(0, 3));
run.startRun();

const scene = new THREE.Scene();
scene.background = new THREE.Color('#05040b');
scene.fog = new THREE.Fog('#05040b', 34, 74);

const webglRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
webglRenderer.setSize(window.innerWidth, window.innerHeight);
webglRenderer.outputColorSpace = THREE.SRGBColorSpace;
sceneRoot.appendChild(webglRenderer.domElement);

const cameraRig = new CameraRig(webglRenderer.domElement, () => { run.playerRotateBreach(); invalidate(false); });
scene.add(new THREE.HemisphereLight('#ffffff', '#15111f', 4.0));
const key = new THREE.DirectionalLight('#ffffff', 5.0); 
key.position.set(8, 12, 10); 
scene.add(key);
const rim = new THREE.PointLight('#ff42d0', 150, 60); // Stronger neon rim light
rim.position.set(-10, 8, -12); 
scene.add(rim);
const floorGrid = new THREE.GridHelper(40, 40, '#31216d', '#181326'); floorGrid.position.y = -10; scene.add(floorGrid);

const breachRenderer = new BreachRenderer(scene, run.board.cellCount);
const picking = new BreachPicking();
const root = createRoot(uiRoot);
let sceneDirty = true;
let pointerDownX = 0;
let pointerDownY = 0;

function invalidate(boardChanged = true): void { sceneDirty = sceneDirty || boardChanged; renderUi(); }
function renderUi(): void { root.render(h(App, { snapshot: run.getSnapshot() })); }
function restartRun(): void { run.startRun((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0); invalidate(true); }
function onActivateHero(heroIndex: number): void { run.tryActivateHeroPower(heroIndex); invalidate(true); }
function onBuy(itemId: ShopItemId): void { run.tryBuy(itemId); invalidate(true); }
function onContinueAfterShop(): void { run.continueAfterShop(); invalidate(true); }
function onForceAttack(): void { run.forceEnemyAttack(); invalidate(true); }
function onGrowCore(amount: number): void { run.forceCoreGrowth(amount); invalidate(true); }

function App({ snapshot }: { snapshot: RunSnapshot }) {
  return h(React.Fragment, null,
    h('div', { className: 'hud' },
      // LEFT SIDE: Heroes and Queue
      h('div', { className: 'side-column left-side' },
        h(QueuePreview, { queue: snapshot.queue }),
        h(HeroPanel, { heroes: snapshot.heroes, frontlineIndex: snapshot.frontlineIndex, onActivate: onActivateHero })
      ),
      
      // CENTER: Help text
      h('div', { className: 'center-help' }, 
        snapshot.shopOpen ? 'Shop is open. Click a Breach cell before buying cell-target items, then continue to the next monster.' : 'Click an exposed cube face to place the next block. Drag to rotate, but remember: rotation spends a move.'
      ),
      
      // RIGHT SIDE: Enemy and Debug
      h('div', { className: 'side-column right-side' },
        h(EnemyPanel, { enemy: snapshot.enemy, wave: snapshot.wave, movesLeft: snapshot.movesLeft, score: snapshot.score, credits: snapshot.credits, enemiesDefeated: snapshot.enemiesDefeated, occupiedBlocks: snapshot.occupiedBlocks, coreRadius: snapshot.coreRadius, synergy: snapshot.synergy, lastAction: snapshot.lastAction, onForceAttack, onGrowCore1: () => onGrowCore(1), onGrowCore2: () => onGrowCore(2) }),
        h('div', { className: 'panel debug-row' }, 
          h('span', null, `Selected cell: ${snapshot.selectedCellIndex >= 0 ? snapshot.selectedCellIndex : 'none'}`), 
          h('button', { onClick: restartRun }, 'Restart')
        )
      )
    ),
    h(DarkwebBodega, { open: snapshot.shopOpen, credits: snapshot.credits, selectedCellIndex: snapshot.selectedCellIndex, onBuy, onContinue: onContinueAfterShop }),
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
  if (pick.placementIndex >= 0) { run.playerPlaceAtIndex(pick.placementIndex); invalidate(true); }
  else invalidate(false);
});

window.addEventListener('resize', () => { webglRenderer.setSize(window.innerWidth, window.innerHeight); cameraRig.resize(window.innerWidth, window.innerHeight); });

function frame(): void {
  requestAnimationFrame(frame);
  cameraRig.update();
  if (sceneDirty) { breachRenderer.syncFromBoard(run.board); sceneDirty = false; }
  webglRenderer.render(scene, cameraRig.camera);
}

invalidate(true);
frame();
