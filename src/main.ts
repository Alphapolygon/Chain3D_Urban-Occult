import './style.css';
import * as TWEEN from '@tweenjs/tween.js';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { HEROES } from './data/heroes';
import { createDefaultRunConfig } from './config/defaultRunConfig';
import type { HeroDefinition } from './sim/CombatSystem';
import { RunState, type LastActionReport, type RunConfig } from './sim/RunState';
import type { ShopItemId } from './sim/ShopSystem';
import { BreachRenderer } from './render/BreachRenderer';
import { BreachPicking } from './render/BreachPicking';
import { SoundEngine } from './render/SoundEngine';
import { FighterStage } from './render/fighters/FighterStage';
import { loadCubeModel } from './render/assets/loadCubeModel';
import { createGameScene } from './render/scene/createGameScene';
import { BoardEffects } from './render/effects/BoardEffects';
import { CombatEffects } from './render/effects/CombatEffects';
import { BreachPointerInput } from './input/BreachPointerInput';
import { GameApp } from './ui/GameApp';
import type { CharacterInfoSelection } from './ui/CharacterInfoPopup';

const sceneRoot = document.querySelector<HTMLDivElement>('#scene-root');
const uiRoot = document.querySelector<HTMLDivElement>('#ui-root');
if (!sceneRoot || !uiRoot) throw new Error('Missing #scene-root or #ui-root.');

let runConfig = createDefaultRunConfig();
let draftedHeroes: HeroDefinition[] = HEROES.slice(0, 3);
let gameStarted = false;
let run = new RunState(runConfig, draftedHeroes);
let speedMode = false;
let selectedCharacter: CharacterInfoSelection | null = null;
let sceneDirty = true;
let processedAction: LastActionReport | null = null;
let hitStopUntil = 0;
let koShopTimeout: number | null = null;
let enemyTurnTimeout: number | null = null;

const root = createRoot(uiRoot);
const { scene, renderer: webglRenderer, cameraRig } = createGameScene(sceneRoot);
const cubeModel = await loadCubeModel();
const picking = new BreachPicking();
const sfx = new SoundEngine();
const fighterStage = new FighterStage(scene);
let breachRenderer = createBreachRenderer();
const boardEffects = new BoardEffects(scene, cubeModel.geometry, cubeModel.material);
boardEffects.attachToBreach(breachRenderer);

const ENEMY_TURN_DELAY_MS = 1080;
const KO_TO_SHOP_DELAY_MS = 1500;

const combatEffects = new CombatEffects(fighterStage, cameraRig, webglRenderer.domElement, sfx, {
  getSpeedMode: () => speedMode,
  hitStop,
  scheduleEnemyAttackAfterTurnBanner,
  scheduleShopAfterKo
});

fighterStage.setHeroClickHandler((index) => {
  if (!gameStarted) return;
  selectedCharacter = { kind: 'hero', index };
  invalidate(false);
});
fighterStage.setEnemyClickHandler(() => {
  if (!gameStarted) return;
  selectedCharacter = { kind: 'enemy' };
  invalidate(false);
});

new BreachPointerInput(webglRenderer.domElement, cameraRig, picking, sfx, {
  canInteract: canInteractWithBreach,
  board: () => run.board,
  renderer: () => breachRenderer,
  onPickCell: (cellIndex) => run.selectCell(cellIndex),
  onPlace: placeBlockAtIndex,
  onInvalid: (reason) => run.reportInvalidPlacement(reason),
  onVisualsRequested: playLastActionVisuals,
  invalidate,
  syncEnabled: syncBreachInputEnabled
}).bind();

window.addEventListener('resize', () => {
  webglRenderer.setSize(window.innerWidth, window.innerHeight);
  cameraRig.resize(window.innerWidth, window.innerHeight);
});


function createBreachRenderer(): BreachRenderer {
  return new BreachRenderer(scene, run.board.cellCount, cubeModel.geometry, cubeModel.material);
}

function canInteractWithBreach(): boolean {
  return gameStarted && run.phase === 'playing' && !run.shopOpen && !run.runOver;
}

function syncBreachInputEnabled(): void {
  cameraRig.controls.enabled = canInteractWithBreach();
}

function placeBlockAtIndex(index: number, reason?: string): boolean {
  const placed = run.playerPlaceAtIndex(index);
  if (!placed && reason) run.reportInvalidPlacement(reason);
  return placed;
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

  if (action.snap?.movedIndices && action.snap.movedIndices.length > 0) {
    breachRenderer.prepareSnapAnimation(action.snap.movedIndices);
  }
  if (action.removedIndices && action.removedIndices.length > 0) {
    boardEffects.spawnMatchParticles(action.removedIndices, run.board);
  }
  boardEffects.spawnPowerCollectCubes(action.powerCollects, run.board, breachRenderer, fighterStage.heroes);
  combatEffects.play(action, run.getSnapshot());
}

function syncFighterVisuals(): void {
  fighterStage.sync(run.getSnapshot(), gameStarted, cameraRig.camera);
}

function applyDebugConfig(newConfig: RunConfig): void {
  clearKoShopTimer();
  clearEnemyTurnTimer();
  const maxSize = Math.max(7, newConfig.board.maxSize);
  const initialRadius = Math.min(newConfig.board.initialRadius, Math.floor(maxSize / 2) - 1);
  runConfig = { ...newConfig, board: { ...newConfig.board, maxSize, initialRadius } };
  run = new RunState(runConfig, draftedHeroes);
  run.startRun();
  gameStarted = true;
  replaceBreachRenderer();
  processedAction = null;
  selectedCharacter = null;
  invalidate(true);
}

function startRunWithDraft(draft: HeroDefinition[]): void {
  clearKoShopTimer();
  clearEnemyTurnTimer();
  draftedHeroes = draft.slice(0, 3);
  if (draftedHeroes.length < 3) draftedHeroes = HEROES.slice(0, 3);
  run = new RunState(runConfig, draftedHeroes);
  run.startRun(randomSeed());
  gameStarted = true;
  replaceBreachRenderer();
  processedAction = null;
  selectedCharacter = null;
  invalidate(true);
}

function restartRun(): void {
  if (!gameStarted) {
    renderUi();
    return;
  }
  clearKoShopTimer();
  clearEnemyTurnTimer();
  run.startRun(randomSeed());
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

function replaceBreachRenderer(): void {
  breachRenderer.dispose(scene);
  breachRenderer = createBreachRenderer();
  boardEffects.attachToBreach(breachRenderer);
}

function onActivateHero(heroIndex: number): void {
  if (run.tryActivateHeroPower(heroIndex)) {
    playLastActionVisuals();
    invalidate(true);
  }
}

function onSwapCache(): void {
  if (run.playerSwapCache()) invalidate(false);
}

function onBuy(itemId: ShopItemId): void {
  if (run.tryBuy(itemId)) {
    playLastActionVisuals();
    invalidate(true);
  } else {
    invalidate(false);
  }
}

function onContinueAfterShop(): void {
  clearKoShopTimer();
  clearEnemyTurnTimer();
  run.continueAfterShop();
  invalidate(true);
}

function onForceAttack(): void {
  run.forceEnemyAttack();
  playLastActionVisuals();
  invalidate(true);
}

function onGrowCore(amount: number): void {
  run.forceCoreGrowth(amount);
  playLastActionVisuals();
  invalidate(true);
}

function debugDamageEnemy(amount: number): void {
  clearEnemyTurnTimer();
  if (run.debugDamageEnemy(amount)) playLastActionVisuals();
  invalidate(true);
}

function debugKillEnemy(): void {
  clearEnemyTurnTimer();
  if (run.debugKillEnemy()) playLastActionVisuals();
  invalidate(true);
}

function debugHealEnemy(): void {
  clearEnemyTurnTimer();
  run.debugHealEnemy();
  invalidate(false);
}

function debugSpawnWave(wave: number): void {
  clearKoShopTimer();
  clearEnemyTurnTimer();
  run.debugSpawnWave(wave);
  processedAction = null;
  invalidate(false);
}

function debugSetEnemyTimer(moves: number): void {
  clearEnemyTurnTimer();
  run.debugSetEnemyAttackTimer(moves);
  playLastActionVisuals();
  invalidate(false);
}

function debugRefillHeroes(): void {
  run.debugRefillHeroes();
  invalidate(false);
}

function debugMaxHeroAp(): void {
  run.debugMaxHeroAp();
  invalidate(false);
}

function debugAddPoints(amount: number): void {
  run.debugAddPoints(amount);
  invalidate(false);
}

const debugRuntimeActions = {
  damageEnemy: debugDamageEnemy,
  killEnemy: debugKillEnemy,
  healEnemy: debugHealEnemy,
  spawnWave: debugSpawnWave,
  setEnemyTimer: debugSetEnemyTimer,
  refillHeroes: debugRefillHeroes,
  maxHeroAp: debugMaxHeroAp,
  addPoints: debugAddPoints,
  forceAttack: onForceAttack,
  forceCoreGrowth: onGrowCore
};

function toggleSpeedMode(): void {
  speedMode = !speedMode;
  invalidate(false);
}

function closeCharacterInfo(): void {
  selectedCharacter = null;
  invalidate(false);
}

function invalidate(boardChanged = true): void {
  sceneDirty = sceneDirty || boardChanged;
  renderUi();
}

function renderUi(): void {
  sceneRoot!.classList.toggle('draft-active', !gameStarted);
  root.render(createElement(GameApp, {
    snapshot: run.getSnapshot(),
    gameStarted,
    draftedHeroIds: draftedHeroes.map((hero) => hero.id),
    runConfig,
    speedMode,
    selectedCharacter,
    onStartDraft: startRunWithDraft,
    onApplyDebugConfig: applyDebugConfig,
    onToggleSpeedMode: toggleSpeedMode,
    onSwapCache,
    onActivateHero,
    onBuy,
    onContinueAfterShop,
    onForceAttack,
    onGrowCore,
    onRestart: restartRun,
    onReturnToDraft: returnToDraft,
    onCloseCharacterInfo: closeCharacterInfo,
    debugRuntimeActions
  }));
}

function frame(): void {
  requestAnimationFrame(frame);
  const paused = performance.now() < hitStopUntil;
  if (!paused) TWEEN.update();
  syncBreachInputEnabled();
  cameraRig.update();
  syncFighterVisuals();
  if (sceneDirty) {
    breachRenderer.syncFromBoard(run.board);
    sceneDirty = false;
  }
  if (!paused) breachRenderer.update();
  fighterStage.renderHiddenStudios(webglRenderer);
  webglRenderer.render(scene, cameraRig.camera);
}

function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}


// Initial UI/render start must happen after debugRuntimeActions is initialized.
invalidate(true);
frame();
