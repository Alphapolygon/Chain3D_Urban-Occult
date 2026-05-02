import * as TWEEN from '@tweenjs/tween.js';
import type { LastActionReport, RunSnapshot } from '../../sim/RunState';
import type { CameraRig } from '../CameraRig';
import type { SoundEngine } from '../SoundEngine';
import type { FighterStage } from '../fighters/FighterStage';

export type CombatEffectKind = 'player' | 'enemy' | 'ko' | 'invalid' | 'enemy-turn';
export type CombatEffectAnchor = 'enemy' | 'heroes' | 'screen';

export type CombatEffectsOptions = {
  getSpeedMode: () => boolean;
  hitStop: (ms: number) => void;
  scheduleEnemyAttackAfterTurnBanner: () => void;
  scheduleShopAfterKo: () => void;
};

const MIN_TEXT_DISPLAY_MS = 1000;
const ENEMY_TURN_DELAY_MS = 1080;

export class CombatEffects {
  constructor(
    private readonly fighterStage: FighterStage,
    private readonly cameraRig: CameraRig,
    private readonly domElement: HTMLCanvasElement,
    private readonly sfx: SoundEngine,
    private readonly options: CombatEffectsOptions
  ) {}

  play(action: LastActionReport, snapshot: RunSnapshot): void {
    const snapCells = action.snap?.cellsMoved ?? 0;
    const snapClusters = action.snap?.clustersMoved ?? 0;

    this.playSounds(action, snapCells, snapClusters);

    if (action.enemyTurn) this.playEnemyTurn();
    if (action.playerAttack) this.playPlayerAttack(action, snapshot);
    if (action.heroPower && !action.playerAttack) this.playHeroPower(action, snapshot);
    if (action.enemyAttack) this.playEnemyAttack(action, snapshot);
    if (action.invalidPlacement) this.playInvalidPlacement();
    if (snapClusters > 0) this.playSnapShake(snapCells, snapClusters);
    if (action.hardKnockdown || snapCells > 5 || action.chain >= 2) this.playHeavyImpact(action);

    if (action.enemyTurn) this.options.scheduleEnemyAttackAfterTurnBanner();
    if (action.enemyDefeated) this.options.scheduleShopAfterKo();
  }

  private playSounds(action: LastActionReport, snapCells: number, snapClusters: number): void {
    if (action.invalidPlacement) this.sfx.playError();
    if (action.removedIndices && action.removedIndices.length > 0) this.sfx.playMatch(Math.max(1, action.chain));
    if (snapClusters > 0) this.sfx.playSnap(snapCells);
    if (action.playerAttack) this.sfx.playSlash(false);
    if (action.enemyAttack) this.sfx.playSlash(true);
  }

  private playEnemyTurn(): void {
    this.spawnCombatSlash('enemy-turn', 'enemy');
    this.cameraRig.triggerActionCamera(this.options.getSpeedMode());
    this.cameraRig.shake(0.32, 180);
  }

  private playPlayerAttack(action: LastActionReport, snapshot: RunSnapshot): void {
    const attackerIndex = clampIndex(action.sourceHeroIndex ?? snapshot.frontlineIndex, this.fighterStage.heroes.length);
    const attacker = this.fighterStage.heroes[attackerIndex];

    if (action.heroPower) attacker?.triggerSpecial(760);
    else attacker?.triggerAttack(540);

    this.spawnPlayerAttackProjectile(attackerIndex);

    if (action.enemyDefeated) this.fighterStage.enemy.triggerDeath();
    else this.fighterStage.enemy.triggerHit(0.55);

    this.spawnCombatSlash(action.enemyDefeated ? 'ko' : 'player', 'enemy');
    this.cameraRig.triggerActionCamera(this.options.getSpeedMode());
    this.cameraRig.shake(action.enemyDefeated ? 2.4 : 0.75, action.enemyDefeated ? 620 : 240);
    this.options.hitStop(action.enemyDefeated ? 220 : 80);
  }

  private playHeroPower(action: LastActionReport, snapshot: RunSnapshot): void {
    const casterIndex = clampIndex(action.sourceHeroIndex ?? snapshot.frontlineIndex, this.fighterStage.heroes.length);
    this.fighterStage.heroes[casterIndex]?.triggerSpecial(760);
  }

  private playEnemyAttack(action: LastActionReport, snapshot: RunSnapshot): void {
    this.fighterStage.enemy.triggerAttack(620);
    const targetIndices = action.enemyTargetIndices && action.enemyTargetIndices.length > 0
      ? Array.from(new Set(action.enemyTargetIndices))
      : snapshot.wave >= 11
        ? snapshot.heroes.map((_, i) => i)
        : [snapshot.frontlineIndex];

    this.spawnEnemyAttackProjectiles(targetIndices);
    for (const targetIndex of targetIndices) {
      const defender = snapshot.heroes[targetIndex];
      if (!defender) continue;
      if (defender.hp <= 0) this.fighterStage.heroes[targetIndex]?.triggerDeath();
      else this.fighterStage.heroes[targetIndex]?.triggerHit(targetIndices.length > 1 ? 0.38 : 0.46);
    }

    this.spawnCombatSlash('enemy', 'heroes');
    this.cameraRig.triggerActionCamera(this.options.getSpeedMode());
    this.cameraRig.shake(action.coreGrew ? 1.35 : 0.9, action.coreGrew ? 420 : 280);
    this.options.hitStop(110);
  }

  private playInvalidPlacement(): void {
    this.spawnCombatSlash('invalid', 'screen');
    this.cameraRig.shake(0.22, 120);
  }

  private playSnapShake(snapCells: number, snapClusters: number): void {
    const shake = Math.min(2.2, 0.35 + snapCells * 0.035 + snapClusters * 0.14);
    this.cameraRig.shake(shake, Math.min(480, 130 + snapCells * 12));
  }

  private playHeavyImpact(action: LastActionReport): void {
    this.cameraRig.triggerActionCamera(this.options.getSpeedMode());
    this.options.hitStop(action.hardKnockdown ? 160 : 100);
  }

  private spawnCombatSlash(kind: CombatEffectKind, anchor: CombatEffectAnchor): void {
    const el = document.createElement('div');
    el.className = `combat-slash ${kind} anchor-${anchor} world-anchored`;
    el.textContent = kind === 'ko' ? 'K.O.' : kind === 'invalid' ? 'BLOCKED' : kind === 'enemy-turn' ? 'ENEMY TURN' : '';

    const width = kind === 'invalid' ? 420 : kind === 'ko' ? 620 : 520;
    const height = kind === 'invalid' ? 150 : kind === 'ko' ? 210 : 190;
    const point = this.effectAnchorPoint(anchor);
    el.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, point.x - width * 0.5))}px`;
    el.style.top = `${Math.max(8, Math.min(window.innerHeight - height - 8, point.y - height * 0.55))}px`;
    el.style.width = `${Math.min(window.innerWidth - 16, width)}px`;
    el.style.height = `${height}px`;
    document.body.appendChild(el);

    window.setTimeout(() => el.remove(), combatEffectDuration(kind));
  }

  private effectAnchorPoint(anchor: CombatEffectAnchor): { x: number; y: number } {
    if (anchor === 'enemy') return this.fighterStage.enemy.getScreenAnchor(this.cameraRig.camera, this.domElement, 5.7);
    if (anchor === 'heroes') {
      const hero = this.fighterStage.heroes[Math.max(0, Math.min(this.fighterStage.heroes.length - 1, this.lastKnownFrontlineIndex))];
      return hero.getScreenAnchor(this.cameraRig.camera, this.domElement, 4.4);
    }
    return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 };
  }

  private lastKnownFrontlineIndex = 0;

  private spawnPlayerAttackProjectile(sourceHeroIndex: number): void {
    this.lastKnownFrontlineIndex = sourceHeroIndex;
    const attacker = this.fighterStage.heroes[clampIndex(sourceHeroIndex, this.fighterStage.heroes.length)];
    if (!attacker) return;
    const from = attacker.getScreenAnchor(this.cameraRig.camera, this.domElement, 3.3);
    const to = this.fighterStage.enemy.getScreenAnchor(this.cameraRig.camera, this.domElement, 5.1);
    spawnAttackProjectile(from, to, false);
  }

  private spawnEnemyAttackProjectiles(targetIndices: readonly number[]): void {
    const from = this.fighterStage.enemy.getScreenAnchor(this.cameraRig.camera, this.domElement, 5.4);
    for (const targetIndex of targetIndices) {
      this.lastKnownFrontlineIndex = targetIndex;
      const target = this.fighterStage.heroes[targetIndex];
      if (!target) continue;
      const to = target.getScreenAnchor(this.cameraRig.camera, this.domElement, 3.1);
      spawnAttackProjectile(from, to, true);
    }
  }
}

function spawnAttackProjectile(from: { x: number; y: number }, to: { x: number; y: number }, isEnemy: boolean): void {
  const projectile = document.createElement('div');
  projectile.className = `attack-projectile ${isEnemy ? 'enemy' : 'player'}`;
  const startX = from.x;
  const startY = from.y;
  const endX = to.x;
  const endY = to.y;
  const dx = endX - startX;
  const dy = endY - startY;
  const angle = Math.atan2(dy, dx);
  projectile.style.left = `${startX}px`;
  projectile.style.top = `${startY}px`;
  projectile.style.transform = `translate(-50%, -50%) rotate(${angle}rad) scale(0.72)`;
  document.body.appendChild(projectile);

  const trail = document.createElement('div');
  trail.className = `attack-projectile-trail ${isEnemy ? 'enemy' : 'player'}`;
  trail.style.left = `${startX}px`;
  trail.style.top = `${startY}px`;
  trail.style.transform = `translate(0, -50%) rotate(${angle}rad) scaleX(0.05)`;
  document.body.appendChild(trail);

  const state = { t: 0 };
  new TWEEN.Tween(state)
    .to({ t: 1 }, isEnemy ? 520 : 460)
    .easing(TWEEN.Easing.Cubic.InOut)
    .onUpdate(() => {
      const t = state.t;
      const arc = Math.sin(t * Math.PI) * (isEnemy ? -42 : -30);
      const x = startX + dx * t;
      const y = startY + dy * t + arc;
      projectile.style.left = `${x}px`;
      projectile.style.top = `${y}px`;
      projectile.style.transform = `translate(-50%, -50%) rotate(${angle}rad) scale(${0.72 + Math.sin(t * Math.PI) * 0.45})`;

      const trailLength = Math.max(30, Math.hypot(dx, dy) * t);
      trail.style.width = `${trailLength}px`;
      trail.style.opacity = `${Math.max(0, 0.92 - t * 0.62)}`;
      trail.style.transform = `translate(0, -50%) rotate(${angle}rad) scaleX(${Math.max(0.05, t)})`;
    })
    .onComplete(() => {
      projectile.classList.add('impact');
      trail.remove();
      window.setTimeout(() => projectile.remove(), 180);
    })
    .start();
}

function combatEffectDuration(kind: CombatEffectKind): number {
  if (kind === 'ko') return Math.max(MIN_TEXT_DISPLAY_MS, 1350);
  if (kind === 'enemy-turn') return Math.max(MIN_TEXT_DISPLAY_MS, ENEMY_TURN_DELAY_MS);
  if (kind === 'invalid') return MIN_TEXT_DISPLAY_MS;
  return 620;
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(Math.max(0, length - 1), index));
}
