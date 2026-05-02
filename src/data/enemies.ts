import type { EnemyDefinition } from '../sim/CombatSystem';

const facelessCommuterSprite = new URL('../assets/sprites/faceless-commuter.gif', import.meta.url).href;
const glitchAlgorithmSprite = new URL('../assets/sprites/glitch-algorithm.gif', import.meta.url).href;
const rentWraithSprite = new URL('../assets/sprites/rent-wraith.gif', import.meta.url).href;
const neonCentipedeSprite = new URL('../assets/sprites/neon-centipede.gif', import.meta.url).href;
const deadPlatformSprite = new URL('../assets/sprites/dead-platform.gif', import.meta.url).href;

// attackEveryTurns is currently interpreted by the prototype as moves until attack.
// Keep every value at 5+ so players always get a readable puzzle window before impact.
export const ENEMIES: readonly EnemyDefinition[] = Object.freeze([
  { id: 'faceless-commuter', name: 'Faceless Commuter', baseHp: 185, baseDamage: 20, attackEveryTurns: 6, growthAmount: 1, spriteUrl: facelessCommuterSprite },
  { id: 'glitch-algorithm', name: 'Glitch Algorithm', baseHp: 210, baseDamage: 18, attackEveryTurns: 5, growthAmount: 1, spriteUrl: glitchAlgorithmSprite },
  { id: 'rent-wraith', name: 'Rent Wraith', baseHp: 245, baseDamage: 26, attackEveryTurns: 7, growthAmount: 1, spriteUrl: rentWraithSprite },
  { id: 'neon-centipede', name: 'Neon Centipede', baseHp: 260, baseDamage: 24, attackEveryTurns: 5, growthAmount: 2, spriteUrl: neonCentipedeSprite },
  { id: 'dead-platform', name: 'Dead Platform', baseHp: 310, baseDamage: 31, attackEveryTurns: 8, growthAmount: 2, spriteUrl: deadPlatformSprite }
]);

export function enemyForWave(wave: number): EnemyDefinition {
  return ENEMIES[(wave - 1) % ENEMIES.length];
}
