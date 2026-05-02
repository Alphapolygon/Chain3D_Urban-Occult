import { enemyForWave } from '../data/enemies';
import { getShopItem } from '../data/shopItems';
import { applyMetaProgressToHeroDefinition, awardRunMetaProgress, emptyMetaProgressReport, type MetaProgressReport } from '../data/metaProgress';
import type { BreachBoardConfig } from './BreachBoard';
import { BreachBoard, Mulberry32 } from './BreachBoard';
import { isDestructible, isOccupied } from './CellBits';
import { allHeroesDown, applyEnemyAttack, awardMetaXp, canUseHeroPower, computeMatchDamage, createEnemyState, createHeroState, damageEnemy, frontlineFromDominantColor, gainApFromMatches, shieldTeam, spendHeroAp, type EnemyState, type HeroDefinition, type HeroState } from './CombatSystem';
import { expandStaticCore, shrinkStaticCore } from './CoreGrowthSystem';
import { IslandSnapSystem, type IslandSnapResult } from './IslandSnapSystem';
import { MatchSystem } from './MatchSystem';
import { tryBuyShopItem, ShopItemId, type ShopRunApi, type ShopItemDefinition } from './ShopSystem';

export type RunPhase = 'playing' | 'enemy-turn' | 'ko' | 'shop' | 'dead' | 'containment-failure';

export type RunSynergy = { id: string; title: string; description: string; islandSnapDamageMultiplier: number; };
export type PowerCollectReport = { heroIndex: number; color: number; amount: number; fromIndices: number[]; };

export type LastActionReport = {
  text: string;
  removed: number;
  chain: number;
  snap?: IslandSnapResult;
  removedIndices?: number[];
  hardKnockdown?: boolean;
  poiseBlocked?: boolean;
  playerAttack?: boolean;
  enemyAttack?: boolean;
  enemyDefeated?: boolean;
  sourceHeroIndex?: number;
  heroPower?: boolean;
  coreGrew?: boolean;
  invalidPlacement?: boolean;
  enemyTurn?: boolean;
  powerCollects?: PowerCollectReport[];
};
export type RunConfig = {
  board: BreachBoardConfig;
  movesPerTurn: number;
  queueLength: number;
  scorePerBlock: number;
  matchMinimum: number;
  maxChains: number;
  seed?: number;
  enemyCoreGrowthChanceMin?: number;
  enemyCoreGrowthChanceMax?: number;
};
export type RunSnapshot = {
  phase: RunPhase; shopOpen: boolean; runOver: boolean; lossReason: string;
  heroes: HeroState[]; enemy: EnemyState; queue: number[]; cacheColor: number | null; cacheUsedThisTurn: boolean; frontlineIndex: number;
  wave: number; movesLeft: number; score: number; points: number; credits: number; enemiesDefeated: number; rerollsUsedThisShop: number;
  occupiedBlocks: number; coreRadius: number; selectedCellIndex: number; synergy: RunSynergy; lastAction: LastActionReport;
  metaXpAwarded: number; metaProgressReport: MetaProgressReport;
};

export class BlockQueue {
  readonly colors: Int32Array;
  private colorCount: number;
  private rng: Mulberry32;

  constructor(length: number, colorCount: number, rng: Mulberry32) {
    this.colors = new Int32Array(Math.max(1, length));
    this.colorCount = colorCount;
    this.rng = rng;
    this.rerollAll();
  }

  setRng(rng: Mulberry32): void { this.rng = rng; this.rerollAll(); }
  peek(offset = 0): number { return this.colors[Math.max(0, Math.min(this.colors.length - 1, offset | 0))]; }
  setNext(color: number): void { this.colors[0] = color; }
  consume(): number {
    const c = this.colors[0];
    for (let i = 1; i < this.colors.length; i++) this.colors[i - 1] = this.colors[i];
    this.colors[this.colors.length - 1] = this.randomColor();
    return c;
  }
  rerollNext(): void { this.colors[0] = this.randomColor(); }
  rerollAll(): void { for (let i = 0; i < this.colors.length; i++) this.colors[i] = this.randomColor(); }
  toArray(): number[] { return Array.from(this.colors); }
  private randomColor(): number { return 1 + Math.floor(this.rng.next() * this.colorCount); }
}

type SnapDamageReport = { damage: number; hardKnockdown: boolean; poiseBlocked: boolean; };
const HARD_KNOCKDOWN_CELL_THRESHOLD = 6;

function indicesForColor(indices: readonly number[], colors: readonly number[], color: number, max = 18): number[] {
  const result: number[] = [];
  for (let i = 0; i < indices.length && result.length < max; i++) {
    if (colors[i] === color) result.push(indices[i]);
  }
  return result;
}

export class RunState implements ShopRunApi {
  readonly config: RunConfig;
  readonly board: BreachBoard;
  readonly blockQueue: BlockQueue;
  readonly matchSystem: MatchSystem;
  readonly snapSystem: IslandSnapSystem;
  readonly draft: HeroDefinition[];
  readonly log: string[] = [];

  heroes: HeroState[];
  enemy: EnemyState;
  phase: RunPhase = 'playing';
  wave = 1;
  enemiesDefeated = 0;
  frontlineIndex = 0;
  movesLeft = 0;
  score = 0;
  points = 0;
  matchedBlocks = 0;
  extraMovesNextTurn = 0;
  selectedCellIndex = -1;
  cacheColor: number | null = null;
  cacheUsedThisTurn = false;
  rerollsUsedThisShop = 0;
  synergy: RunSynergy;
  lastAction: LastActionReport = { text: 'Run not started.', removed: 0, chain: 0 };
  lossReason = '';
  metaXpAwarded = 0;
  metaProgressReport: MetaProgressReport = emptyMetaProgressReport();
  private rng: Mulberry32;
  private poiseAppliedThisTurn = false;
  private pendingEnemyAttackForced = false;

  constructor(config: RunConfig, draft: readonly HeroDefinition[]) {
    this.config = config;
    this.draft = draft.slice(0, 3);
    this.board = new BreachBoard(config.board);
    this.rng = new Mulberry32(config.seed ?? config.board.seed);
    this.blockQueue = new BlockQueue(config.queueLength, config.board.colorCount, this.rng);
    this.matchSystem = new MatchSystem(this.board.cellCount, config.board.colorCount, config.matchMinimum);
    this.snapSystem = new IslandSnapSystem(this.board.cellCount);
    this.heroes = this.draft.map((def) => createHeroState(applyMetaProgressToHeroDefinition(def)));
    this.enemy = createEnemyState(enemyForWave(1), 1);
    this.synergy = rollSynergy(this.heroes, this.rng);
  }

  get shopOpen(): boolean { return this.phase === 'shop'; }
  get runOver(): boolean { return this.phase === 'dead' || this.phase === 'containment-failure'; }
  get nextColor(): number { return this.blockQueue.peek(0); }

  startRun(seed = this.config.board.seed): void {
    this.rng = new Mulberry32(seed);
    this.board.reset(seed);
    this.blockQueue.setRng(this.rng);
    this.heroes = this.draft.map((def) => createHeroState(applyMetaProgressToHeroDefinition(def)));
    this.phase = 'playing'; this.wave = 1; this.enemiesDefeated = 0; this.frontlineIndex = 0;
    this.movesLeft = this.config.movesPerTurn; this.score = 0; this.points = 0; this.matchedBlocks = 0;
    this.extraMovesNextTurn = 0; this.selectedCellIndex = -1; this.lossReason = ''; this.metaXpAwarded = 0; this.metaProgressReport = emptyMetaProgressReport();
    this.cacheColor = null; this.cacheUsedThisTurn = false; this.rerollsUsedThisShop = 0; this.poiseAppliedThisTurn = false; this.pendingEnemyAttackForced = false;
    this.enemy = createEnemyState(enemyForWave(1), 1);
    this.synergy = rollSynergy(this.heroes, this.rng);
    this.lastAction = { text: `Run started. ${this.synergy.title}`, removed: 0, chain: 0, removedIndices: [] };
    this.log.length = 0; this.addLog(this.lastAction.text);
  }

  peekQueue(offset: number): number { return this.blockQueue.peek(offset); }
  selectCell(index: number): void { this.selectedCellIndex = this.board.inBoundsIndex(index) ? index : -1; }

  reportInvalidPlacement(reason = 'Invalid placement. Click an exposed face with empty space next to it.'): void {
    this.lastAction = { text: reason, removed: 0, chain: 0, removedIndices: [], invalidPlacement: true };
    this.addLog(reason);
  }

  playerSwapCache(): boolean {
    if (this.phase !== 'playing' || this.cacheUsedThisTurn) return false;
    if (this.cacheColor === null) {
      this.cacheColor = this.blockQueue.consume();
      this.lastAction = { text: 'Cached active block. New block pulled from queue.', removed: 0, chain: 0, removedIndices: [] };
    } else {
      const active = this.blockQueue.peek(0);
      this.blockQueue.setNext(this.cacheColor);
      this.cacheColor = active;
      this.lastAction = { text: 'Swapped active block with Cache.', removed: 0, chain: 0, removedIndices: [] };
    }
    this.cacheUsedThisTurn = true;
    this.addLog(this.lastAction.text);
    return true;
  }

  playerPlaceAtIndex(index: number): boolean {
    if (this.phase !== 'playing') return false;
    if (!this.board.placeAtIndex(index, this.blockQueue.peek(0))) {
      this.reportInvalidPlacement('Blocked: that face has no valid empty placement cell. Try another exposed side.');
      return false;
    }
    this.blockQueue.consume();
    this.consumeMove('Placed block.');
    this.resolveBoardAfterMatches(undefined, [index]);
    this.checkEnemyDefeated();
    if (this.phase === 'playing') this.advanceEnemyAfterPlayerMove();
    this.checkLossConditions();
    return true;
  }

  playerRotateBreach(): boolean {
    if (this.phase !== 'playing') return false;
    this.consumeMove('Committed rotation.');
    this.advanceEnemyAfterPlayerMove();
    this.checkLossConditions();
    return true;
  }

  tryActivateHeroPower(heroIndex: number, targetCellIndex = this.selectedCellIndex): boolean {
    if (this.phase !== 'playing') return false;
    const hero = this.heroes[heroIndex];
    if (!hero || !canUseHeroPower(hero)) return false;

    let message = '';
    let snap: IslandSnapResult | undefined;
    let removed = 0;
    let chain = 0;
    let removedIndices: number[] = [];
    let playerAttack = false;
    let hardKnockdown = false;
    let poiseBlocked = false;

    const absorbSettleReport = (prefix: string): void => {
      const settle = this.settleBoardAfterMutation();
      if (!settle) {
        message = prefix;
        return;
      }

      removed = settle.removed;
      chain = settle.chain;
      snap = settle.snap;
      removedIndices = settle.removedIndices ?? [];
      playerAttack = !!settle.playerAttack;
      hardKnockdown = !!settle.hardKnockdown;
      poiseBlocked = !!settle.poiseBlocked;
      message = prefix + ' ' + settle.text;
    };

    switch (hero.activePower) {
      case 'hex-burst': {
        const dealt = damageEnemy(this.enemy, hero.baseDamage * 22 + 90);
        playerAttack = dealt > 0;
        message = hero.name + ' hex-burst for ' + dealt + ' damage.';
        break;
      }
      case 'shield-team': {
        message = hero.name + ' shielded the crew for ' + shieldTeam(this.heroes, 28) + ' total shield.';
        break;
      }
      case 'core-stabilize': {
        const r = shrinkStaticCore(this.board, 1);
        absorbSettleReport(hero.name + ' stabilized core ' + r.oldRadius + ' -> ' + r.newRadius + '.');
        break;
      }
      case 'breach-bomb': {
        const removed = this.clearRadius1(targetCellIndex);
        absorbSettleReport(hero.name + ' erased ' + removed + ' blocks.');
        playerAttack = removed > 0 || playerAttack;
        break;
      }
      case 'queue-hack': {
        this.blockQueue.rerollAll();
        this.extraMovesNextTurn++;
        message = hero.name + ' hacked the queue and banked +1 move.';
        break;
      }
    }

    spendHeroAp(hero);
    this.lastAction = { text: message, removed, chain, snap, removedIndices, playerAttack, hardKnockdown, poiseBlocked, sourceHeroIndex: heroIndex, heroPower: true };
    this.addLog(message);
    this.checkEnemyDefeated();
    this.checkLossConditions();
    return true;
  }
  tryBuy(itemId: ShopItemId, target = this.selectedCellIndex): boolean {
    if (this.phase !== 'shop') return false;
    if (itemId === ShopItemId.RerollQueue && this.rerollsUsedThisShop >= 1) {
      this.addLog('REFRESH failed: NO SIGNAL.');
      return false;
    }
    const item = getShopItem(itemId) as ShopItemDefinition | undefined;
    if (!item) return false;
    const ok = tryBuyShopItem(this, item, target);
    if (ok && itemId === ShopItemId.RerollQueue) this.rerollsUsedThisShop++;
    this.checkLossConditions();
    return ok;
  }

  openShopAfterKo(): boolean {
    if (this.phase !== 'ko') return false;
    this.phase = 'shop';
    this.rerollsUsedThisShop = 0;
    this.lastAction = { text: 'Darkweb Bodega connection opened.', removed: 0, chain: 0, removedIndices: [] };
    this.addLog(this.lastAction.text);
    return true;
  }

  continueAfterShop(): void {
    if (this.phase !== 'shop') return;
    this.wave++;
    this.enemy = createEnemyState(enemyForWave(this.wave), this.wave);
    this.movesLeft = this.config.movesPerTurn + this.extraMovesNextTurn;
    this.extraMovesNextTurn = 0;
    this.cacheUsedThisTurn = false;
    this.poiseAppliedThisTurn = false;
    this.pendingEnemyAttackForced = false;
    this.phase = 'playing';
    this.lastAction = { text: `${this.enemy.name} manifested.`, removed: 0, chain: 0, removedIndices: [] };
    this.addLog(this.lastAction.text);
  }

  forceEnemyAttack(): void {
    if (this.phase === 'playing') this.beginEnemyTurn(true);
    else if (this.phase === 'enemy-turn') this.resolveEnemyTurnAttack();
  }

  resolveEnemyTurnAttack(): boolean {
    if (this.phase !== 'enemy-turn') return false;
    this.resolveEnemyAttackNow(this.pendingEnemyAttackForced);
    return true;
  }
  forceCoreGrowth(amount: number): void {
    const r = expandStaticCore(this.board, amount);
    const snap = this.snapFloatingBlocksOnly();
    const snapText = snap && snap.clustersMoved > 0 ? ` ${snap.cellsMoved} floating blocks snapped inward.` : '';
    this.lastAction = { text: `Core expanded ${r.oldRadius} -> ${r.newRadius}. Colored growth blocks spawned; matches wait for player placement.${snapText}`, removed: 0, chain: 0, removedIndices: [], coreGrew: true, snap };
    this.addLog(this.lastAction.text);
    this.checkLossConditions();
  }

  clearRadius1(index: number): number {
    if (!this.board.inBoundsIndex(index)) return 0;
    const p = this.board.xyzOf(index);
    let removed = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = p.x + dx, y = p.y + dy, z = p.z + dz;
      if (!this.board.inBounds(x, y, z)) continue;
      const n = this.board.index(x, y, z);
      if (isDestructible(this.board.cells[n])) { this.board.cells[n] = 0; removed++; }
    }
    return removed;
  }

  resolveBoardAfterManualDestruction(): void {
    this.settleBoardAfterMutation();
    this.checkEnemyDefeated();
  }

  private settleBoardAfterMutation(): LastActionReport | null {
    const previousAction = this.lastAction;
    let changed = false;

    // Hero powers and shop cards can delete arbitrary support blocks. Always run
    // the same gravity settle loop that normal matching uses, and repeat it a few
    // times so a second-order island created by a power cannot remain floating.
    for (let pass = 0; pass < Math.max(4, this.config.maxChains); pass++) {
      const snap = this.snapSystem.resolve(this.board);
      if (snap.clustersMoved <= 0) break;
      changed = true;
      const snapSeeds = snap.movedIndices.map((move) => move.to);
      this.resolveBoardAfterMatches(snap, snapSeeds);
    }

    return changed && this.lastAction !== previousAction ? this.lastAction : null;
  }
  addLog(message: string): void { this.log.push(message); if (this.log.length > 80) this.log.shift(); }

  getSnapshot(): RunSnapshot {
    return {
      phase: this.phase, shopOpen: this.shopOpen, runOver: this.runOver, lossReason: this.lossReason,
      heroes: this.heroes.map((h) => ({ ...h })), enemy: { ...this.enemy }, queue: this.blockQueue.toArray(), cacheColor: this.cacheColor,
      cacheUsedThisTurn: this.cacheUsedThisTurn, frontlineIndex: this.frontlineIndex, wave: this.wave, movesLeft: this.movesLeft, score: this.score,
      points: this.points, credits: this.points, enemiesDefeated: this.enemiesDefeated, rerollsUsedThisShop: this.rerollsUsedThisShop,
      occupiedBlocks: this.board.countOccupied(), coreRadius: this.board.coreRadius, selectedCellIndex: this.selectedCellIndex,
      synergy: this.synergy, lastAction: this.lastAction,
      metaXpAwarded: this.metaXpAwarded, metaProgressReport: this.metaProgressReport
    };
  }

  private resolveBoardAfterMatches(initialSnap?: IslandSnapResult, seedIndices?: readonly number[]): void {
    let totalRemoved = 0, totalScore = 0, totalDamage = 0, chainsResolved = 0;
    let lastSnap = initialSnap;
    let hardKnockdown = false;
    let poiseBlocked = false;
    const allRemovedIndices: number[] = [];
    const powerCollects: PowerCollectReport[] = [];
    let currentSeeds: readonly number[] | undefined = seedIndices;

    if (initialSnap && initialSnap.clustersMoved > 0) {
      const snapDamage = this.applySnapDamage(initialSnap);
      totalDamage += snapDamage.damage;
      hardKnockdown ||= snapDamage.hardKnockdown;
      poiseBlocked ||= snapDamage.poiseBlocked;
    }

    for (let chain = 1; chain <= this.config.maxChains; chain++) {
      const match = this.matchSystem.resolve(this.board, currentSeeds);
      if (match.removed <= 0) break;
      allRemovedIndices.push(...match.removedIndices);
      chainsResolved = chain;
      totalRemoved += match.removed;
      this.matchedBlocks += match.removed;
      const apBefore = this.heroes.map((hero) => hero.ap);
      gainApFromMatches(this.heroes, match.colorCounts, match.dominantColor);
      for (let heroIndex = 0; heroIndex < this.heroes.length; heroIndex++) {
        const hero = this.heroes[heroIndex];
        const gained = hero.ap - apBefore[heroIndex];
        if (gained <= 0 || match.colorCounts[hero.color] <= 0) continue;
        powerCollects.push({
          heroIndex,
          color: hero.color,
          amount: gained,
          fromIndices: indicesForColor(match.removedIndices, match.removedColors, hero.color)
        });
      }
      this.frontlineIndex = frontlineFromDominantColor(this.heroes, match.dominantColor, this.frontlineIndex);

      const scoreGain = this.config.scorePerBlock * match.removed * chain;
      this.score += scoreGain; this.points += scoreGain; totalScore += scoreGain;
      const frontline = this.heroes[this.frontlineIndex] ?? this.heroes[0];
      const damage = computeMatchDamage(match.removed, chain, frontline);
      totalDamage += damageEnemy(this.enemy, damage);

      lastSnap = this.snapSystem.resolve(this.board);
      if (lastSnap.clustersMoved > 0) {
        const snapDamage = this.applySnapDamage(lastSnap);
        totalDamage += snapDamage.damage;
        hardKnockdown ||= snapDamage.hardKnockdown;
        poiseBlocked ||= snapDamage.poiseBlocked;
      }

      const nextSeeds = lastSnap.movedIndices.map((move) => move.to);
      if (nextSeeds.length === 0) break;
      currentSeeds = nextSeeds;
      if (this.enemy.hp <= 0) break;
    }

    if (totalRemoved > 0 || (initialSnap && initialSnap.clustersMoved > 0)) {
      const status = hardKnockdown ? ' HARD KNOCKDOWN +1 move delay.' : poiseBlocked ? ' Poise absorbed knockdown.' : '';
      this.lastAction = {
        text: `Chain ${Math.max(1, chainsResolved)} cleared ${totalRemoved} blocks, +${totalScore}, ${totalDamage} damage.${status}`,
        removed: totalRemoved,
        chain: chainsResolved,
        snap: lastSnap,
        removedIndices: allRemovedIndices,
        hardKnockdown,
        poiseBlocked,
        playerAttack: totalDamage > 0,
        sourceHeroIndex: this.frontlineIndex,
        powerCollects
      };
      this.addLog(this.lastAction.text);
    }
  }

  private applySnapDamage(snap: IslandSnapResult): SnapDamageReport {
    const amount = Math.round((snap.cellsMoved * 3 + snap.clustersMoved * 12) * this.synergy.islandSnapDamageMultiplier);
    const damage = damageEnemy(this.enemy, amount);
    let hardKnockdown = false;
    let poiseBlocked = false;

    if (snap.cellsMoved >= HARD_KNOCKDOWN_CELL_THRESHOLD && this.enemy.hp > 0) {
      if (this.enemy.poiseTurns <= 0) {
        this.enemy.attackTimer += 1;
        this.enemy.poiseTurns = 1;
        this.poiseAppliedThisTurn = true;
        hardKnockdown = true;
        this.addLog(`CRITICAL SNAP! ${this.enemy.name} knocked down (+1 move delay).`);
      } else {
        poiseBlocked = true;
        this.addLog(`${this.enemy.name}'s Poise absorbed the knockdown.`);
      }
    }

    return { damage, hardKnockdown, poiseBlocked };
  }

  private snapFloatingBlocksOnly(): IslandSnapResult | undefined {
    const snap = this.snapSystem.resolve(this.board);
    return snap.clustersMoved > 0 ? snap : undefined;
  }

  private consumeMove(prefix: string): void {
    this.movesLeft = Math.max(0, this.movesLeft - 1);
    this.lastAction = { text: `${prefix} ${this.movesLeft} moves left. ${this.enemy.name} attacks in ${this.enemy.attackTimer} moves.`, removed: 0, chain: 0, removedIndices: [] };
  }

  private advanceEnemyAfterPlayerMove(): void {
    if (this.phase !== 'playing') return;
    this.enemy.attackTimer = Math.max(0, this.enemy.attackTimer - 1);

    if (this.enemy.attackTimer <= 0) {
      this.beginEnemyTurn(false);
      return;
    } else {
      const message = `${this.enemy.name} attacks in ${this.enemy.attackTimer} moves.`;
      this.addLog(message);
      if (this.lastAction.removed <= 0 && !this.lastAction.playerAttack && !this.lastAction.invalidPlacement) {
        this.lastAction = { text: `${message} ${this.movesLeft} moves left.`, removed: 0, chain: 0, removedIndices: [] };
      }
    }

    if (this.phase === 'playing' && this.movesLeft <= 0) this.refreshMoveBatch();
  }

  private beginEnemyTurn(forced: boolean): void {
    if (this.phase !== 'playing') return;
    this.pendingEnemyAttackForced = forced;
    this.phase = 'enemy-turn';
    const warning = `${forced ? 'Forced: ' : ''}ENEMY TURN. ${this.enemy.name} prepares to strike!`;
    this.lastAction = {
      text: warning,
      removed: 0,
      chain: 0,
      removedIndices: [],
      enemyTurn: true
    };
    this.addLog(warning);
  }

  private resolveEnemyAttackNow(forced: boolean): void {
    if (this.phase !== 'enemy-turn') return;
    const poiseWasAppliedThisTurn = this.poiseAppliedThisTurn;
    const attack = applyEnemyAttack(this.heroes, this.enemy, this.frontlineIndex);
    const growthChance = this.currentCoreGrowthChance();
    let coreGrew = false;
    let text = `${forced ? 'Forced: ' : ''}${attack.text}`;
    let growthSnap: IslandSnapResult | undefined;

    if (this.rng.next() < growthChance) {
      const growth = expandStaticCore(this.board, this.enemy.growthAmount);
      coreGrew = true;
      growthSnap = this.snapFloatingBlocksOnly();
      text += ` Core expanded ${growth.oldRadius} -> ${growth.newRadius}.`;
      if (growthSnap && growthSnap.clustersMoved > 0) text += ` ${growthSnap.cellsMoved} floating blocks snapped inward.`;
    } else {
      text += ` Core held stable (${Math.round(growthChance * 100)}% growth risk).`;
    }

    this.enemy.attackTimer = this.enemy.attackEveryTurns;
    this.pendingEnemyAttackForced = false;
    this.lastAction = { text, removed: 0, chain: 0, removedIndices: [], enemyAttack: true, coreGrew, snap: growthSnap };
    this.addLog(text);

    if (!poiseWasAppliedThisTurn && this.enemy.poiseTurns > 0) this.enemy.poiseTurns--;
    this.poiseAppliedThisTurn = false;
    this.checkLossConditions();
    if (!this.runOver && this.phase === 'enemy-turn') {
      this.phase = 'playing';
      if (this.movesLeft <= 0) this.refreshMoveBatch();
    }
  }

  private refreshMoveBatch(): void {
    this.movesLeft = Math.max(1, this.config.movesPerTurn + this.extraMovesNextTurn);
    this.extraMovesNextTurn = 0;
    this.cacheUsedThisTurn = false;
    this.addLog(`Moves refreshed: ${this.movesLeft}. Cache is available again.`);
  }

  private currentCoreGrowthChance(): number {
    const min = clamp01(this.config.enemyCoreGrowthChanceMin ?? 0.10);
    const max = Math.max(min, clamp01(this.config.enemyCoreGrowthChanceMax ?? 0.25));
    const waveRamp = Math.min(1, Math.max(0, (this.wave - 1) / 10));
    return min + (max - min) * waveRamp;
  }

  private checkEnemyDefeated(): void {
    if (this.phase !== 'playing' || this.enemy.hp > 0) return;
    this.enemiesDefeated++;
    const bounty = 400 + this.wave * 80;
    this.points += bounty;
    this.phase = 'ko';
    this.rerollsUsedThisShop = 0;
    const previous = this.lastAction;
    this.lastAction = {
      ...previous,
      text: `${this.enemy.name} BANISHED. +${bounty} bodega points. Darkweb Bodega connecting...`,
      enemyDefeated: true,
      playerAttack: true,
      removedIndices: previous.removedIndices ?? []
    };
    this.addLog(this.lastAction.text);
  }

  private checkLossConditions(): void {
    if (this.runOver) return;
    if (allHeroesDown(this.heroes)) {
      this.finalizeRun('dead', 'All Cleaners were reduced to 0 HP.');
    } else if (this.board.containmentFailure || containmentExceeded(this.board)) {
      this.finalizeRun('containment-failure', 'Containment failure: the Static core pushed the Breach past the grid boundary.');
    }
  }

  private finalizeRun(phase: 'dead' | 'containment-failure', reason: string): void {
    this.phase = phase;
    this.lossReason = reason;
    this.metaXpAwarded = awardMetaXp(this.heroes, this.score, this.enemiesDefeated);
    this.metaProgressReport = awardRunMetaProgress(this.heroes, this.metaXpAwarded);
    this.addLog(`${this.lossReason} Meta-XP ${this.metaXpAwarded}.`);
  }
}

function containmentExceeded(board: BreachBoard): boolean {
  for (let i = 0; i < board.cellCount; i++) {
    if (!isOccupied(board.cells[i])) continue;
    const x = board.xOf(i), y = board.yOf(i), z = board.zOf(i);
    if (x <= 0 || y <= 0 || z <= 0 || x >= board.maxSize - 1 || y >= board.maxSize - 1 || z >= board.maxSize - 1) return true;
  }
  return false;
}

function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }

function rollSynergy(heroes: readonly HeroState[], rng: Mulberry32): RunSynergy {
  const ids = new Set(heroes.map((h) => h.id));
  if (ids.has('courier') && ids.has('hacker')) return { id: 'courier-hacker', title: 'Courier x Hacker', description: 'Island Snaps deal 50% more damage this run.', islandSnapDamageMultiplier: 1.5 };
  if (ids.has('bouncer') && ids.has('tagger')) return { id: 'bouncer-tagger', title: 'Bouncer x Tagger', description: 'Island Snaps deal 35% more damage this run.', islandSnapDamageMultiplier: 1.35 };
  const roll = rng.next();
  if (roll < 0.33) return { id: 'neon-ritual', title: 'Neon Ritual', description: 'Island Snaps deal 20% more damage.', islandSnapDamageMultiplier: 1.2 };
  if (roll < 0.66) return { id: 'clean-route', title: 'Clean Route', description: 'Default snap damage. Draft carried by fundamentals.', islandSnapDamageMultiplier: 1.0 };
  return { id: 'bad-omens', title: 'Bad Omens', description: 'Island Snaps deal 10% less damage, but the run pays full meta-XP.', islandSnapDamageMultiplier: 0.9 };
}
