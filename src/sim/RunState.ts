import { enemyForWave } from '../data/enemies';
import { getShopItem } from '../data/shopItems';
import type { BreachBoardConfig } from './BreachBoard';
import { BreachBoard, Mulberry32 } from './BreachBoard';
import { CORE, isDestructible, isOccupied, STATIC } from './CellBits';
import { allHeroesDown, applyEnemyAttack, awardMetaXp, canUseHeroPower, computeMatchDamage, createEnemyState, createHeroState, damageEnemy, frontlineFromDominantColor, gainApFromMatches, shieldTeam, spendHeroAp, type EnemyState, type HeroDefinition, type HeroState } from './CombatSystem';
import { expandStaticCore, shrinkStaticCore } from './CoreGrowthSystem';
import { IslandSnapSystem, type IslandSnapResult } from './IslandSnapSystem';
import { MatchSystem } from './MatchSystem';
import { tryBuyShopItem, type ShopRunApi, type ShopItemDefinition, type ShopItemId } from './ShopSystem';

export type RunPhase = 'playing' | 'shop' | 'dead' | 'containment-failure';

export type RunSynergy = { id: string; title: string; description: string; islandSnapDamageMultiplier: number; };
export type LastActionReport = { text: string; removed: number; chain: number; snap?: IslandSnapResult; };
export type RunConfig = { board: BreachBoardConfig; movesPerTurn: number; queueLength: number; scorePerBlock: number; matchMinimum: number; maxChains: number; seed?: number; };
export type RunSnapshot = {
  phase: RunPhase; shopOpen: boolean; runOver: boolean; lossReason: string;
  heroes: HeroState[]; enemy: EnemyState; queue: number[]; frontlineIndex: number;
  wave: number; movesLeft: number; score: number; points: number; credits: number; enemiesDefeated: number;
  occupiedBlocks: number; coreRadius: number; selectedCellIndex: number; synergy: RunSynergy; lastAction: LastActionReport;
};

export class BlockQueue {
  readonly colors: Int32Array;
  private colorCount: number;
  private rng: Mulberry32;
  constructor(length: number, colorCount: number, rng: Mulberry32) { this.colors = new Int32Array(Math.max(1, length)); this.colorCount = colorCount; this.rng = rng; this.rerollAll(); }
  setRng(rng: Mulberry32): void { this.rng = rng; this.rerollAll(); }
  peek(offset = 0): number { return this.colors[Math.max(0, Math.min(this.colors.length - 1, offset | 0))]; }
  consume(): number { const c = this.colors[0]; for (let i = 1; i < this.colors.length; i++) this.colors[i - 1] = this.colors[i]; this.colors[this.colors.length - 1] = this.randomColor(); return c; }
  rerollNext(): void { this.colors[0] = this.randomColor(); }
  rerollAll(): void { for (let i = 0; i < this.colors.length; i++) this.colors[i] = this.randomColor(); }
  toArray(): number[] { return Array.from(this.colors); }
  private randomColor(): number { return 1 + Math.floor(this.rng.next() * this.colorCount); }
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
  synergy: RunSynergy;
  lastAction: LastActionReport = { text: 'Run not started.', removed: 0, chain: 0 };
  lossReason = '';
  metaXpAwarded = 0;
  private rng: Mulberry32;

  constructor(config: RunConfig, draft: readonly HeroDefinition[]) {
    this.config = config;
    this.draft = draft.slice(0, 3);
    this.board = new BreachBoard(config.board);
    this.rng = new Mulberry32(config.seed ?? config.board.seed);
    this.blockQueue = new BlockQueue(config.queueLength, config.board.colorCount, this.rng);
    this.matchSystem = new MatchSystem(this.board.cellCount, config.board.colorCount, config.matchMinimum);
    this.snapSystem = new IslandSnapSystem(this.board.cellCount);
    this.heroes = this.draft.map(createHeroState);
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
    this.heroes = this.draft.map(createHeroState);
    this.phase = 'playing'; this.wave = 1; this.enemiesDefeated = 0; this.frontlineIndex = 0;
    this.movesLeft = this.config.movesPerTurn; this.score = 0; this.points = 0; this.matchedBlocks = 0;
    this.extraMovesNextTurn = 0; this.selectedCellIndex = -1; this.lossReason = ''; this.metaXpAwarded = 0;
    this.enemy = createEnemyState(enemyForWave(1), 1);
    this.synergy = rollSynergy(this.heroes, this.rng);
    this.lastAction = { text: `Run started. ${this.synergy.title}`, removed: 0, chain: 0 };
    this.log.length = 0; this.addLog(this.lastAction.text);
  }

  peekQueue(offset: number): number { return this.blockQueue.peek(offset); }
  selectCell(index: number): void { this.selectedCellIndex = this.board.inBoundsIndex(index) ? index : -1; }

  playerPlaceAtIndex(index: number): boolean {
    if (this.phase !== 'playing') return false;
    if (!this.board.placeAtIndex(index, this.blockQueue.peek(0))) { this.addLog('Invalid placement.'); return false; }
    this.blockQueue.consume();
    this.consumeMove('Placed block.', false);
    this.resolveBoardAfterMatches();
    this.checkEnemyDefeated();
    this.checkLossConditions();
    if (!this.runOver && !this.shopOpen && this.movesLeft <= 0) this.endPlayerTurn();
    return true;
  }

  playerRotateBreach(): boolean {
    if (this.phase !== 'playing') return false;
    this.consumeMove('Committed rotation.', true);
    return true;
  }

  tryActivateHeroPower(heroIndex: number, targetCellIndex = this.selectedCellIndex): boolean {
    if (this.phase !== 'playing') return false;
    const hero = this.heroes[heroIndex];
    if (!hero || !canUseHeroPower(hero)) return false;

    let message = '';
    switch (hero.activePower) {
      case 'hex-burst': message = `${hero.name} hex-burst for ${damageEnemy(this.enemy, hero.baseDamage * 22 + 90)} damage.`; break;
      case 'shield-team': message = `${hero.name} shielded the crew for ${shieldTeam(this.heroes, 28)} total shield.`; break;
      case 'core-stabilize': { const r = shrinkStaticCore(this.board, 1); message = `${hero.name} stabilized core ${r.oldRadius} -> ${r.newRadius}.`; break; }
      case 'breach-bomb': { const removed = this.clearRadius1(targetCellIndex); this.resolveBoardAfterManualDestruction(); message = `${hero.name} erased ${removed} blocks.`; break; }
      case 'queue-hack': this.blockQueue.rerollAll(); this.extraMovesNextTurn++; message = `${hero.name} hacked the queue and banked +1 move.`; break;
    }
    spendHeroAp(hero);
    this.lastAction = { text: message, removed: 0, chain: 0 };
    this.addLog(message);
    this.checkEnemyDefeated();
    this.checkLossConditions();
    return true;
  }

  tryBuy(itemId: ShopItemId, target = this.selectedCellIndex): boolean {
    if (this.phase !== 'shop') return false;
    const item = getShopItem(itemId) as ShopItemDefinition | undefined;
    if (!item) return false;
    const ok = tryBuyShopItem(this, item, target);
    this.checkLossConditions();
    return ok;
  }

  continueAfterShop(): void {
    if (this.phase !== 'shop') return;
    this.wave++;
    this.enemy = createEnemyState(enemyForWave(this.wave), this.wave);
    this.movesLeft = this.config.movesPerTurn + this.extraMovesNextTurn;
    this.extraMovesNextTurn = 0;
    this.phase = 'playing';
    this.lastAction = { text: `${this.enemy.name} manifested.`, removed: 0, chain: 0 };
    this.addLog(this.lastAction.text);
  }

  forceEnemyAttack(): void { if (this.phase === 'playing') { this.enemy.attackTimer = 1; this.endPlayerTurn(); } }
  forceCoreGrowth(amount: number): void { const r = expandStaticCore(this.board, amount); this.lastAction = { text: `Core expanded ${r.oldRadius} -> ${r.newRadius}.`, removed: 0, chain: 0 }; this.checkLossConditions(); }

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
    const snap = this.snapSystem.resolve(this.board);
    this.resolveBoardAfterMatches(snap);
    this.checkEnemyDefeated();
  }

  addLog(message: string): void { this.log.push(message); if (this.log.length > 80) this.log.shift(); }

  getSnapshot(): RunSnapshot {
    return {
      phase: this.phase, shopOpen: this.shopOpen, runOver: this.runOver, lossReason: this.lossReason,
      heroes: this.heroes.map((h) => ({ ...h })), enemy: { ...this.enemy }, queue: this.blockQueue.toArray(),
      frontlineIndex: this.frontlineIndex, wave: this.wave, movesLeft: this.movesLeft, score: this.score,
      points: this.points, credits: this.points, enemiesDefeated: this.enemiesDefeated, occupiedBlocks: this.board.countOccupied(),
      coreRadius: this.board.coreRadius, selectedCellIndex: this.selectedCellIndex, synergy: this.synergy, lastAction: this.lastAction
    };
  }

  private resolveBoardAfterMatches(initialSnap?: IslandSnapResult): void {
    let totalRemoved = 0, totalScore = 0, totalDamage = 0, chainsResolved = 0;
    let lastSnap = initialSnap;
    if (initialSnap && initialSnap.clustersMoved > 0) totalDamage += this.applySnapDamage(initialSnap);

    for (let chain = 1; chain <= this.config.maxChains; chain++) {
      const match = this.matchSystem.resolve(this.board);
      if (match.removed <= 0) break;
      chainsResolved = chain;
      totalRemoved += match.removed;
      this.matchedBlocks += match.removed;
      gainApFromMatches(this.heroes, match.colorCounts, match.dominantColor);
      this.frontlineIndex = frontlineFromDominantColor(this.heroes, match.dominantColor, this.frontlineIndex);

      const scoreGain = this.config.scorePerBlock * match.removed * chain;
      this.score += scoreGain; this.points += scoreGain; totalScore += scoreGain;
      const frontline = this.heroes[this.frontlineIndex] ?? this.heroes[0];
      const damage = computeMatchDamage(match.removed, chain, frontline);
      totalDamage += damageEnemy(this.enemy, damage);

      lastSnap = this.snapSystem.resolve(this.board);
      if (lastSnap.clustersMoved > 0) totalDamage += this.applySnapDamage(lastSnap);
      if (this.enemy.hp <= 0) break;
    }

    if (totalRemoved > 0 || (initialSnap && initialSnap.clustersMoved > 0)) {
      this.lastAction = { text: `Chain ${Math.max(1, chainsResolved)} cleared ${totalRemoved} blocks, +${totalScore}, ${totalDamage} damage.`, removed: totalRemoved, chain: chainsResolved, snap: lastSnap };
      this.addLog(this.lastAction.text);
    }
  }

  private applySnapDamage(snap: IslandSnapResult): number {
    const amount = Math.round((snap.cellsMoved * 3 + snap.clustersMoved * 12) * this.synergy.islandSnapDamageMultiplier);
    return damageEnemy(this.enemy, amount);
  }

  private consumeMove(prefix: string, autoEndTurn: boolean): void {
    this.movesLeft = Math.max(0, this.movesLeft - 1);
    this.lastAction = { text: `${prefix} ${this.movesLeft} moves left.`, removed: 0, chain: 0 };
    if (autoEndTurn && this.movesLeft <= 0) this.endPlayerTurn();
  }

  private endPlayerTurn(): void {
    if (this.phase !== 'playing') return;
    this.enemy.attackTimer--;
    if (this.enemy.attackTimer <= 0) {
      const attack = applyEnemyAttack(this.heroes, this.enemy, this.frontlineIndex);
      const growth = expandStaticCore(this.board, this.enemy.growthAmount);
      this.enemy.attackTimer = this.enemy.attackEveryTurns;
      this.lastAction = { text: `${attack.text} Static core expanded ${growth.oldRadius} -> ${growth.newRadius}.`, removed: 0, chain: 0 };
      this.addLog(this.lastAction.text);
      this.resolveBoardAfterManualDestruction();
    } else {
      this.lastAction = { text: `${this.enemy.name} attacks in ${this.enemy.attackTimer}.`, removed: 0, chain: 0 };
      this.addLog(this.lastAction.text);
    }
    this.movesLeft = this.config.movesPerTurn + this.extraMovesNextTurn;
    this.extraMovesNextTurn = 0;
    this.checkEnemyDefeated();
    this.checkLossConditions();
  }

  private checkEnemyDefeated(): void {
    if (this.phase !== 'playing' || this.enemy.hp > 0) return;
    this.enemiesDefeated++;
    const bounty = 400 + this.wave * 80;
    this.points += bounty;
    this.phase = 'shop';
    this.lastAction = { text: `${this.enemy.name} banished. +${bounty} bodega points.`, removed: 0, chain: 0 };
    this.addLog(this.lastAction.text);
  }

  private checkLossConditions(): void {
    if (this.runOver) return;
    if (allHeroesDown(this.heroes)) {
      this.phase = 'dead';
      this.lossReason = 'All Cleaners were reduced to 0 HP.';
      this.metaXpAwarded = awardMetaXp(this.heroes, this.score, this.enemiesDefeated);
      this.addLog(`${this.lossReason} Meta-XP ${this.metaXpAwarded}.`);
    } else if (this.board.containmentFailure || containmentExceeded(this.board)) {
      this.phase = 'containment-failure';
      this.lossReason = 'Containment failure: the Static core pushed the Breach past the grid boundary.';
      this.metaXpAwarded = awardMetaXp(this.heroes, this.score, this.enemiesDefeated);
      this.addLog(`${this.lossReason} Meta-XP ${this.metaXpAwarded}.`);
    }
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

function rollSynergy(heroes: readonly HeroState[], rng: Mulberry32): RunSynergy {
  const ids = new Set(heroes.map((h) => h.id));
  if (ids.has('courier') && ids.has('hacker')) return { id: 'courier-hacker', title: 'Courier x Hacker', description: 'Island Snaps deal 50% more damage this run.', islandSnapDamageMultiplier: 1.5 };
  if (ids.has('bouncer') && ids.has('tagger')) return { id: 'bouncer-tagger', title: 'Bouncer x Tagger', description: 'Island Snaps deal 35% more damage this run.', islandSnapDamageMultiplier: 1.35 };
  const roll = rng.next();
  if (roll < 0.33) return { id: 'neon-ritual', title: 'Neon Ritual', description: 'Island Snaps deal 20% more damage.', islandSnapDamageMultiplier: 1.2 };
  if (roll < 0.66) return { id: 'clean-route', title: 'Clean Route', description: 'Default snap damage. Draft carried by fundamentals.', islandSnapDamageMultiplier: 1.0 };
  return { id: 'bad-omens', title: 'Bad Omens', description: 'Island Snaps deal 10% less damage, but the run pays full meta-XP.', islandSnapDamageMultiplier: 0.9 };
}
