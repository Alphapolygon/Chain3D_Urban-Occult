import type { HeroState } from './CombatSystem';
import type { Mulberry32 } from './BreachBoard';
import type { RunSynergy } from './RunTypes';

export function rollSynergy(heroes: readonly HeroState[], rng: Mulberry32): RunSynergy {
  const ids = new Set(heroes.map((hero) => hero.id));
  if (ids.has('courier') && ids.has('hacker')) return { id: 'courier-hacker', title: 'Courier x Hacker', description: 'Island Snaps deal 50% more damage this run.', islandSnapDamageMultiplier: 1.5 };
  if (ids.has('bouncer') && ids.has('tagger')) return { id: 'bouncer-tagger', title: 'Bouncer x Tagger', description: 'Island Snaps deal 35% more damage this run.', islandSnapDamageMultiplier: 1.35 };

  const roll = rng.next();
  if (roll < 0.33) return { id: 'neon-ritual', title: 'Neon Ritual', description: 'Island Snaps deal 20% more damage.', islandSnapDamageMultiplier: 1.2 };
  if (roll < 0.66) return { id: 'clean-route', title: 'Clean Route', description: 'Default snap damage. Draft carried by fundamentals.', islandSnapDamageMultiplier: 1.0 };
  return { id: 'bad-omens', title: 'Bad Omens', description: 'Island Snaps deal 10% less damage, but the run pays full meta-XP.', islandSnapDamageMultiplier: 0.9 };
}
