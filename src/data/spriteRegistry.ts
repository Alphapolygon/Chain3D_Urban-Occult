import type { FighterAnimationState, FighterSpriteSet } from '../sim/CombatSystem';

type SpriteModuleMap = Record<string, string>;

const spriteModules = import.meta.glob('../assets/sprites/*.{gif,png,webp,avif,svg,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default'
}) as SpriteModuleMap;

const spriteByNormalizedName = new Map<string, string>();

function normalize(value: string): string {
  return value.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '');
}

for (const [path, url] of Object.entries(spriteModules)) {
  const fileName = path.split('/').pop() ?? path;
  spriteByNormalizedName.set(normalize(fileName), url);
}

const suffixesByState: Record<FighterAnimationState, readonly string[]> = {
  idle: ['idle', 'stand', 'neutral', 'loop'],
  attack: ['attack', 'atk', 'strike', 'slash', 'punch'],
  hit: ['hit', 'hurt', 'damage', 'damaged', 'takehit', 'take-hit', 'take_hit'],
  die: ['die', 'death', 'dead', 'ko', 'down', 'defeat'],
  special: ['special', 'cast', 'power', 'super', 'skill']
};

function findSpriteUrl(id: string, state: FighterAnimationState): string | undefined {
  const base = normalize(id);

  if (state === 'idle') {
    const exact = spriteByNormalizedName.get(base);
    if (exact) return exact;
  }

  for (const suffix of suffixesByState[state]) {
    const key = base + normalize(suffix);
    const url = spriteByNormalizedName.get(key);
    if (url) return url;
  }

  return undefined;
}

export function spritesForFighter(id: string): FighterSpriteSet {
  const sprites: FighterSpriteSet = {};
  for (const state of ['idle', 'attack', 'hit', 'die', 'special'] as const) {
    const url = findSpriteUrl(id, state);
    if (url) sprites[state] = url;
  }
  return sprites;
}
