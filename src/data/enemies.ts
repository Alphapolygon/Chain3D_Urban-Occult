import type { EnemyDefinition } from '../sim/CombatSystem';
import { spritesForFighter } from './spriteRegistry';

// 1. Import the generic enemy .glb model
const FIGHTER_URL = new URL('../assets/models/fighter.glb', import.meta.url).href;

// We know these exact animation indices from your previous FighterBillboard setup!
const FIGHTER_CLIPS = { idle: 0, attack: 1, hit: 7, die: 14 };

export type FighterModelConfig = {
  modelUrl: string;
  clipIndices: { idle: number; attack: number; hit: number; die: number; };
};

function enemy(def: Omit<EnemyDefinition, 'spriteUrl' | 'attackSpriteUrl' | 'hitSpriteUrl' | 'dieSpriteUrl' | 'specialSpriteUrl' | 'sprites'> & FighterModelConfig): any {
  return {
    ...def,
    spriteUrl: '', attackSpriteUrl: '', hitSpriteUrl: '', dieSpriteUrl: '', specialSpriteUrl: ''
  };
}

// attackEveryTurns is currently interpreted by the prototype as moves until attack.
// Keep every value at 5+ so players always get a readable puzzle window before impact.
export const ENEMIES = Object.freeze([
  enemy({ id: 'faceless-commuter', name: 'Faceless Commuter', baseHp: 185, baseDamage: 20, attackEveryTurns: 6, growthAmount: 1, modelUrl: FIGHTER_URL, clipIndices: FIGHTER_CLIPS }),
  enemy({ id: 'glitch-algorithm', name: 'Glitch Algorithm', baseHp: 210, baseDamage: 18, attackEveryTurns: 5, growthAmount: 1, modelUrl: FIGHTER_URL, clipIndices: FIGHTER_CLIPS }),
  enemy({ id: 'rent-wraith', name: 'Rent Wraith', baseHp: 245, baseDamage: 26, attackEveryTurns: 7, growthAmount: 1, modelUrl: FIGHTER_URL, clipIndices: FIGHTER_CLIPS }),
  enemy({ id: 'neon-centipede', name: 'Neon Centipede', baseHp: 280, baseDamage: 22, attackEveryTurns: 5, growthAmount: 1, modelUrl: FIGHTER_URL, clipIndices: FIGHTER_CLIPS })
]);

export function enemyForWave(wave: number): EnemyDefinition {
  return ENEMIES[(wave - 1) % ENEMIES.length];
}
