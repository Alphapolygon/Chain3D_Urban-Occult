import type { BreachBoardConfig } from './BreachBoard';
import type { EnemyState, HeroState } from './CombatSystem';
import type { IslandSnapResult } from './IslandSnapSystem';
import type { MetaProgressReport } from '../data/metaProgress';

export type RunPhase = 'playing' | 'enemy-turn' | 'ko' | 'shop' | 'dead' | 'containment-failure';

export type RunSynergy = {
  id: string;
  title: string;
  description: string;
  islandSnapDamageMultiplier: number;
};

export type PowerCollectReport = {
  heroIndex: number;
  color: number;
  amount: number;
  fromIndices: number[];
};

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
  enemyTargetIndices?: number[];
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
  phase: RunPhase;
  shopOpen: boolean;
  runOver: boolean;
  lossReason: string;
  heroes: HeroState[];
  enemy: EnemyState;
  queue: number[];
  cacheColor: number | null;
  cacheUsedThisTurn: boolean;
  frontlineIndex: number;
  wave: number;
  movesLeft: number;
  score: number;
  points: number;
  credits: number;
  enemiesDefeated: number;
  rerollsUsedThisShop: number;
  occupiedBlocks: number;
  coreRadius: number;
  selectedCellIndex: number;
  synergy: RunSynergy;
  lastAction: LastActionReport;
  metaXpAwarded: number;
  metaProgressReport: MetaProgressReport;
};
