export type HeroRole = 'tank' | 'specialist' | 'striker';
export type ActivePowerId = 'hex-burst' | 'shield-team' | 'core-stabilize' | 'breach-bomb' | 'queue-hack';
export type FighterAnimationState = 'idle' | 'attack' | 'hit' | 'die' | 'special';
export type FighterSpriteSet = Partial<Record<FighterAnimationState, string>>;

export type HeroDefinition = {
  id: string; name: string; role: HeroRole; color: number; maxHp: number; baseDamage: number; maxAp: number; activePower: ActivePowerId; metaLevel?: number;
  spriteUrl?: string; attackSpriteUrl?: string; hitSpriteUrl?: string; dieSpriteUrl?: string; specialSpriteUrl?: string; sprites?: FighterSpriteSet;
};

export type HeroState = HeroDefinition & { hp: number; ap: number; shield: number; metaXp: number; };

export type EnemyDefinition = {
  id: string; name: string; baseHp: number; baseDamage: number; attackEveryTurns: number; growthAmount: 1 | 2;
  spriteUrl?: string; attackSpriteUrl?: string; hitSpriteUrl?: string; dieSpriteUrl?: string; specialSpriteUrl?: string; sprites?: FighterSpriteSet;
};
export type EnemyState = EnemyDefinition & { wave: number; hp: number; maxHp: number; damage: number; attackTimer: number; poiseTurns: number; };

export type AttackReport = { text: string; totalDamage: number; targetsHit: number; targetIndices: number[]; };

export function createHeroState(def: HeroDefinition): HeroState {
  const level = Math.max(1, def.metaLevel ?? 1);
  const bonusLevels = Math.max(0, level - 1);
  const maxHp = def.maxHp + bonusLevels * 8;
  return { ...def, metaLevel: level, maxHp, hp: maxHp, ap: 0, shield: 0, metaXp: 0, baseDamage: def.baseDamage + bonusLevels * 2 };
}

export function createEnemyState(def: EnemyDefinition, wave: number): EnemyState {
  const maxHp = Math.round(def.baseHp + wave * 42 + Math.pow(wave, 1.22) * 18);
  const damage = Math.round(def.baseDamage + wave * 6 + Math.floor(wave / 4) * 9);
  const attackCadence = Math.max(5, def.attackEveryTurns | 0);
  return { ...def, growthAmount: 1, attackEveryTurns: attackCadence, wave, hp: maxHp, maxHp, damage, attackTimer: attackCadence, poiseTurns: 0 };
}

export function damageEnemy(enemy: EnemyState, amount: number): number {
  const damage = Math.max(0, Math.round(amount));
  const before = enemy.hp;
  enemy.hp = Math.max(0, enemy.hp - damage);
  return before - enemy.hp;
}

export function damageHero(hero: HeroState, amount: number): number {
  let incoming = Math.max(0, Math.round(amount));
  const shieldUsed = Math.min(hero.shield, incoming);
  hero.shield -= shieldUsed;
  incoming -= shieldUsed;
  const before = hero.hp;
  hero.hp = Math.max(0, hero.hp - incoming);
  return before - hero.hp + shieldUsed;
}

export function gainApFromMatches(heroes: HeroState[], colorCounts: Int32Array, dominantColor: number): number {
  let total = 0;
  for (const hero of heroes) {
    if (hero.hp <= 0) continue;
    const matched = colorCounts[hero.color] ?? 0;
    if (matched <= 0) continue;
    const gain = matched * 5 + (hero.color === dominantColor ? 5 : 0);
    hero.ap = Math.min(hero.maxAp, hero.ap + gain);
    total += gain;
  }
  return total;
}

export function frontlineFromDominantColor(heroes: HeroState[], dominantColor: number, fallback: number): number {
  const index = heroes.findIndex((h) => h.color === dominantColor && h.hp > 0);
  if (index >= 0) return index;
  if (heroes[fallback]?.hp > 0) return fallback;
  return Math.max(0, heroes.findIndex((h) => h.hp > 0));
}

export function computeMatchDamage(removed: number, chain: number, frontline: HeroState): number {
  const roleBonus = frontline.role === 'striker' ? 1.24 : frontline.role === 'specialist' ? 1.08 : 0.92;
  return Math.round((removed * 7 + frontline.baseDamage * 1.5) * chain * roleBonus);
}

export function applyEnemyAttack(heroes: HeroState[], enemy: EnemyState, frontlineIndex: number): AttackReport {
  const alive = heroes.map((h, i) => ({ h, i })).filter((x) => x.h.hp > 0);
  if (alive.length === 0) return { text: 'No living targets.', totalDamage: 0, targetsHit: 0, targetIndices: [] };

  const frontline = heroes[frontlineIndex]?.hp > 0 ? heroes[frontlineIndex] : alive[0].h;
  const tankMitigation = frontline.role === 'tank' ? 0.66 : 1;
  let total = 0;
  const targetIndices: number[] = [];
  const frontlineResolvedIndex = heroes.findIndex((h) => h === frontline);

  if (enemy.wave <= 5) {
    total += damageHero(frontline, enemy.damage * tankMitigation);
    if (frontlineResolvedIndex >= 0) targetIndices.push(frontlineResolvedIndex);
  } else if (enemy.wave <= 10) {
    total += damageHero(frontline, enemy.damage * tankMitigation);
    if (frontlineResolvedIndex >= 0) targetIndices.push(frontlineResolvedIndex);
    const backline = alive.find((x) => x.h !== frontline);
    if (backline) {
      total += damageHero(backline.h, enemy.damage * 0.45);
      targetIndices.push(backline.i);
    }
  } else {
    for (const { h, i } of alive) {
      total += damageHero(h, h === frontline ? enemy.damage * tankMitigation : enemy.damage * 0.72);
      targetIndices.push(i);
    }
  }

  const targets = targetIndices.length;
  return { text: `${enemy.name} hit ${targets} hero${targets === 1 ? '' : 'es'} for ${total}.`, totalDamage: total, targetsHit: targets, targetIndices };
}

export function allHeroesDown(heroes: readonly HeroState[]): boolean { return heroes.every((h) => h.hp <= 0); }
export function canUseHeroPower(hero: HeroState): boolean { return hero.hp > 0 && hero.ap >= hero.maxAp; }
export function spendHeroAp(hero: HeroState): void { hero.ap = 0; }
export function shieldTeam(heroes: HeroState[], amount: number): number { let total = 0; for (const h of heroes) if (h.hp > 0) { h.shield += amount; total += amount; } return total; }
export function awardMetaXp(heroes: HeroState[], score: number, enemiesDefeated: number): number { const xp = Math.floor(score / 250) + enemiesDefeated * 35; for (const h of heroes) h.metaXp += xp; return xp; }
