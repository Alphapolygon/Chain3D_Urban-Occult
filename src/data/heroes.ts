import type { HeroDefinition } from '../sim/CombatSystem';

const courierSprite = new URL('../assets/sprites/courier.gif', import.meta.url).href;
const hackerSprite = new URL('../assets/sprites/hacker.gif', import.meta.url).href;
const bouncerSprite = new URL('../assets/sprites/bouncer.gif', import.meta.url).href;
const taggerSprite = new URL('../assets/sprites/tagger.gif', import.meta.url).href;
const riggerSprite = new URL('../assets/sprites/rigger.gif', import.meta.url).href;

export const HEROES: readonly HeroDefinition[] = Object.freeze([
  { id: 'courier', name: 'The Courier', role: 'tank', color: 1, maxHp: 155, baseDamage: 13, maxAp: 55, activePower: 'shield-team', spriteUrl: courierSprite },
  { id: 'hacker', name: 'The Hacker', role: 'specialist', color: 2, maxHp: 108, baseDamage: 16, maxAp: 50, activePower: 'queue-hack', spriteUrl: hackerSprite },
  { id: 'bouncer', name: 'The Bouncer', role: 'tank', color: 3, maxHp: 180, baseDamage: 10, maxAp: 60, activePower: 'core-stabilize', spriteUrl: bouncerSprite },
  { id: 'tagger', name: 'The Tagger', role: 'striker', color: 4, maxHp: 118, baseDamage: 24, maxAp: 45, activePower: 'hex-burst', spriteUrl: taggerSprite },
  { id: 'rigger', name: 'The Rigger', role: 'specialist', color: 5, maxHp: 125, baseDamage: 18, maxAp: 58, activePower: 'breach-bomb', spriteUrl: riggerSprite }
]);
