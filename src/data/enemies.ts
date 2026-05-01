import type { EnemyDefinition } from '../sim/CombatSystem';

export const ENEMIES: readonly EnemyDefinition[] = Object.freeze([
  { id: 'faceless-commuter', name: 'Faceless Commuter', baseHp: 185, baseDamage: 20, attackEveryTurns: 3, growthAmount: 1 },
  { id: 'glitch-algorithm', name: 'Glitch Algorithm', baseHp: 210, baseDamage: 18, attackEveryTurns: 2, growthAmount: 1 },
  { id: 'rent-wraith', name: 'Rent Wraith', baseHp: 245, baseDamage: 26, attackEveryTurns: 3, growthAmount: 1 },
  { id: 'neon-centipede', name: 'Neon Centipede', baseHp: 260, baseDamage: 24, attackEveryTurns: 2, growthAmount: 2 },
  { id: 'dead-platform', name: 'Dead Platform', baseHp: 310, baseDamage: 31, attackEveryTurns: 3, growthAmount: 2 }
]);

export function enemyForWave(wave: number): EnemyDefinition {
  return ENEMIES[(wave - 1) % ENEMIES.length];
}
