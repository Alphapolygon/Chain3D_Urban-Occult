import type { HeroDefinition } from '../sim/CombatSystem';
import { spritesForFighter } from './spriteRegistry';

function hero(def: Omit<HeroDefinition, 'spriteUrl' | 'attackSpriteUrl' | 'hitSpriteUrl' | 'dieSpriteUrl' | 'specialSpriteUrl' | 'sprites'>): HeroDefinition {
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

export const HEROES: readonly HeroDefinition[] = Object.freeze([
  hero({ id: 'courier', name: 'The Courier', role: 'tank', color: 1, maxHp: 155, baseDamage: 13, maxAp: 55, activePower: 'shield-team' }),
  hero({ id: 'hacker', name: 'The Hacker', role: 'specialist', color: 2, maxHp: 108, baseDamage: 16, maxAp: 50, activePower: 'queue-hack' }),
  hero({ id: 'bouncer', name: 'The Bouncer', role: 'tank', color: 3, maxHp: 180, baseDamage: 10, maxAp: 60, activePower: 'core-stabilize' }),
  hero({ id: 'tagger', name: 'The Tagger', role: 'striker', color: 4, maxHp: 118, baseDamage: 24, maxAp: 45, activePower: 'hex-burst' }),
  hero({ id: 'rigger', name: 'The Rigger', role: 'specialist', color: 5, maxHp: 125, baseDamage: 18, maxAp: 58, activePower: 'breach-bomb' })
]);
