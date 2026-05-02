import type { RunConfig } from '../sim/RunState';

export function createDefaultRunConfig(): RunConfig {
  return {
    board: {
      maxSize: 10,
      initialRadius: 2,
      initialCoreRadius: 1,
      fillPercent: 0.8,
      colorCount: 5,
      lockedPercent: 0.055,
      staticNoisePercent: 0,
      seed: 1337
    },
    movesPerTurn: 3,
    queueLength: 5,
    scorePerBlock: 100,
    matchMinimum: 3,
    maxChains: 12,
    enemyCoreGrowthChanceMin: 0.25,
    enemyCoreGrowthChanceMax: 0.25,
    enemyHpMultiplier: 1,
    enemyDamageMultiplier: 1,
    enemyAttackEveryMoves: 5,
    startingWave: 1
  };
}
