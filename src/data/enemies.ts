import type { EnemyDefinition } from '../sim/CombatSystem';
import { spritesForFighter } from './spriteRegistry';

function enemy(def: Omit<EnemyDefinition, 'spriteUrl' | 'attackSpriteUrl' | 'hitSpriteUrl' | 'dieSpriteUrl' | 'specialSpriteUrl' | 'sprites'>): EnemyDefinition {
  const sprites = spritesForFighter(def.id);
  return {
    ...def,
    sprites,
    spriteUrl: sprites.idle,
    attackSpriteUrl: sprites.attack,
    hitSpriteUrl: sprites.hit,
    dieSpriteUrl: sprites.die,
    specialSpriteUrl: sprites.special
  };
}

// attackEveryTurns is currently interpreted by the prototype as moves until attack.
// Keep every value at 5+ so players always get a readable puzzle window before impact.
export const ENEMIES: readonly EnemyDefinition[] = Object.freeze([
  enemy({ id: 'faceless-commuter', name: 'Faceless Commuter', baseHp: 185, baseDamage: 20, attackEveryTurns: 6, growthAmount: 1 }),
  enemy({ id: 'glitch-algorithm', name: 'Glitch Algorithm', baseHp: 210, baseDamage: 18, attackEveryTurns: 5, growthAmount: 1 }),
  enemy({ id: 'rent-wraith', name: 'Rent Wraith', baseHp: 245, baseDamage: 26, attackEveryTurns: 7, growthAmount: 1 }),
  enemy({ id: 'neon-centipede', name: 'Neon Centipede', baseHp: 260, baseDamage: 24, attackEveryTurns: 5, growthAmount: 1 }),
  enemy({ id: 'dead-platform', name: 'Dead Platform', baseHp: 310, baseDamage: 31, attackEveryTurns: 8, growthAmount: 1 })
]);

export function enemyForWave(wave: number): EnemyDefinition {
  return ENEMIES[(wave - 1) % ENEMIES.length];
}
