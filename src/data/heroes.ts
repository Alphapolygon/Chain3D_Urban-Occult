// src/data/heroes.ts
import type { HeroDefinition } from '../sim/CombatSystem';

// 1. Import all the .glb models so the Vite bundler packages them
const AANG_URL = new URL('../assets/models/hero.glb', import.meta.url).href;
const CLYDE_URL = new URL('../assets/models/hero.glb', import.meta.url).href;
const ROCKO_URL = new URL('../assets/models/hero.glb', import.meta.url).href;
const SANDY_URL = new URL('../assets/models/hero.glb', import.meta.url).href;
const PATRICK_URL = new URL('../assets/models/hero.glb', import.meta.url).href;

// Default animation clip indices. 
// NOTE: You will need to tweak these numbers per-model once you preview them in-game 
// to match the actual animation order exported from Blender.
const DEFAULT_CLIPS = { idle: 0, attack: 1, hit: 2, die: 3 };

export type FighterModelConfig = {
  modelUrl: string;
  clipIndices: { idle: number; attack: number; hit: number; die: number; };
};

// We Omit the old 2D sprite fields from the type check to make the transition easier
function hero(def: Omit<HeroDefinition, 'spriteUrl' | 'attackSpriteUrl' | 'hitSpriteUrl' | 'dieSpriteUrl' | 'specialSpriteUrl' | 'sprites'> & FighterModelConfig): any {
  return {
    ...def,
    // Provide empty strings for old sprite formats to prevent TypeScript errors elsewhere in the app
    spriteUrl: '', attackSpriteUrl: '', hitSpriteUrl: '', dieSpriteUrl: '', specialSpriteUrl: ''
  };
}

export const HEROES = Object.freeze([
  hero({ id: 'courier', name: 'The Courier', role: 'tank', color: 1, maxHp: 155, baseDamage: 13, maxAp: 55, activePower: 'shield-team', modelUrl: AANG_URL, clipIndices: DEFAULT_CLIPS }),
  hero({ id: 'hacker', name: 'The Hacker', role: 'specialist', color: 2, maxHp: 108, baseDamage: 16, maxAp: 50, activePower: 'queue-hack', modelUrl: CLYDE_URL, clipIndices: DEFAULT_CLIPS }),
  hero({ id: 'bouncer', name: 'The Bouncer', role: 'tank', color: 3, maxHp: 180, baseDamage: 10, maxAp: 60, activePower: 'core-stabilize', modelUrl: ROCKO_URL, clipIndices: DEFAULT_CLIPS }),
  hero({ id: 'tagger', name: 'The Tagger', role: 'striker', color: 4, maxHp: 125, baseDamage: 22, maxAp: 45, activePower: 'breach-bomb', modelUrl: SANDY_URL, clipIndices: DEFAULT_CLIPS }),
  hero({ id: 'rigger', name: 'The Rigger', role: 'striker', color: 5, maxHp: 140, baseDamage: 19, maxAp: 50, activePower: 'queue-hack', modelUrl: PATRICK_URL, clipIndices: DEFAULT_CLIPS })
]);