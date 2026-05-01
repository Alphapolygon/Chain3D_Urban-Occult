import type { HeroDefinition } from '../sim/CombatSystem';

export const HEROES: readonly HeroDefinition[] = Object.freeze([
  { id: 'courier', name: 'The Courier', role: 'tank', color: 1, maxHp: 155, baseDamage: 13, maxAp: 55, activePower: 'shield-team' },
  { id: 'hacker', name: 'The Hacker', role: 'specialist', color: 2, maxHp: 108, baseDamage: 16, maxAp: 50, activePower: 'queue-hack' },
  { id: 'bouncer', name: 'The Bouncer', role: 'tank', color: 3, maxHp: 180, baseDamage: 10, maxAp: 60, activePower: 'core-stabilize' },
  { id: 'tagger', name: 'The Tagger', role: 'striker', color: 4, maxHp: 118, baseDamage: 24, maxAp: 45, activePower: 'hex-burst' },
  { id: 'rigger', name: 'The Rigger', role: 'specialist', color: 5, maxHp: 125, baseDamage: 18, maxAp: 58, activePower: 'breach-bomb' }
]);
