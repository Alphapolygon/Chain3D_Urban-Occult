import { ShopItemId } from '../sim/ShopSystem';
import type { HeroDefinition, HeroState } from '../sim/CombatSystem';

export type HeroProgress = {
  level: number;
  xp: number;
  unlockedCards: string[];
};

export type MetaUnlock = {
  level: number;
  itemId: ShopItemId;
  cardName: string;
};

export type HeroMetaAward = {
  heroId: string;
  heroName: string;
  color: number;
  xpAwarded: number;
  levelBefore: number;
  levelAfter: number;
  xpBefore: number;
  xpAfter: number;
  xpRequiredForNext: number;
  leveledUp: boolean;
  unlockedCards: string[];
  messages: string[];
};

export type MetaProgressReport = {
  xpAwarded: number;
  heroAwards: HeroMetaAward[];
};

const STORAGE_KEY = 'chain3d-urban-occult-meta-progress-v1';

const HERO_IDS = ['courier', 'hacker', 'bouncer', 'tagger', 'rigger'] as const;

export const META_UNLOCKS: Record<string, MetaUnlock[]> = {
  courier: [
    { level: 3, itemId: ShopItemId.CourierPatch, cardName: 'Courier Patch Kit' }
  ],
  hacker: [
    { level: 3, itemId: ShopItemId.SignalSpoof, cardName: 'Signal Spoof' }
  ],
  bouncer: [
    { level: 3, itemId: ShopItemId.DoorWard, cardName: 'Door Ward' }
  ],
  tagger: [
    { level: 3, itemId: ShopItemId.SigilSpray, cardName: 'Sigil Spray' }
  ],
  rigger: [
    { level: 3, itemId: ShopItemId.RemoteCharge, cardName: 'Remote Breach Charge' }
  ]
};

function defaultProgress(): Record<string, HeroProgress> {
  const progress: Record<string, HeroProgress> = {};
  for (const id of HERO_IDS) progress[id] = { level: 1, xp: 0, unlockedCards: [] };
  return progress;
}

function normalizeProgress(input: unknown): Record<string, HeroProgress> {
  const progress = defaultProgress();
  if (!input || typeof input !== 'object') return progress;

  const raw = input as Record<string, Partial<HeroProgress>>;
  for (const id of HERO_IDS) {
    const item = raw[id];
    if (!item) continue;
    progress[id] = {
      level: Math.max(1, Math.min(20, Math.floor(Number(item.level ?? 1)) || 1)),
      xp: Math.max(0, Math.floor(Number(item.xp ?? 0)) || 0),
      unlockedCards: Array.isArray(item.unlockedCards) ? item.unlockedCards.filter((x): x is string => typeof x === 'string') : []
    };
  }
  return progress;
}

function loadProgress(): Record<string, HeroProgress> {
  if (typeof window === 'undefined') return defaultProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeProgress(JSON.parse(raw)) : defaultProgress();
  } catch {
    return defaultProgress();
  }
}

function saveProgress(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(GLOBAL_META_PROGRESS));
  } catch {
    // Ignore storage failures in private browsing or locked-down iframes.
  }
}

export const GLOBAL_META_PROGRESS: Record<string, HeroProgress> = loadProgress();

export function getXpRequiredForNextLevel(currentLevel: number): number {
  return Math.max(1, currentLevel) * 100;
}

export function getHeroProgress(heroId: string): HeroProgress {
  if (!GLOBAL_META_PROGRESS[heroId]) GLOBAL_META_PROGRESS[heroId] = { level: 1, xp: 0, unlockedCards: [] };
  return GLOBAL_META_PROGRESS[heroId];
}

export function applyMetaProgressToHeroDefinition(def: HeroDefinition): HeroDefinition {
  const progress = getHeroProgress(def.id);
  return { ...def, metaLevel: progress.level };
}

export function isShopItemUnlocked(itemId: ShopItemId): boolean {
  for (const progress of Object.values(GLOBAL_META_PROGRESS)) {
    if (progress.unlockedCards.includes(itemId)) return true;
  }
  return false;
}

export function emptyMetaProgressReport(): MetaProgressReport {
  return { xpAwarded: 0, heroAwards: [] };
}

export function awardRunMetaProgress(heroes: readonly HeroState[], xpAwarded: number): MetaProgressReport {
  const heroAwards: HeroMetaAward[] = [];

  for (const hero of heroes) {
    const progress = getHeroProgress(hero.id);
    const levelBefore = progress.level;
    const xpBefore = progress.xp;
    const unlockedCards: string[] = [];
    const messages: string[] = [];

    progress.xp += xpAwarded;

    while (progress.level < 20 && progress.xp >= getXpRequiredForNextLevel(progress.level)) {
      const required = getXpRequiredForNextLevel(progress.level);
      progress.xp -= required;
      progress.level += 1;

      if (progress.level % 2 === 0) {
        messages.push(`Level ${progress.level}: base HP and damage increased.`);
      } else {
        const unlocks = META_UNLOCKS[hero.id]?.filter((unlock) => unlock.level === progress.level) ?? [];
        for (const unlock of unlocks) {
          if (!progress.unlockedCards.includes(unlock.itemId)) {
            progress.unlockedCards.push(unlock.itemId);
            unlockedCards.push(unlock.cardName);
            messages.push(`DECRYPTION COMPLETE: ${unlock.cardName} entered the Bodega pool.`);
          }
        }
        if (unlocks.length === 0) messages.push(`DECRYPTION COMPLETE: deeper Cleaner protocols opened.`);
      }
    }

    const levelAfter = progress.level;
    heroAwards.push({
      heroId: hero.id,
      heroName: hero.name,
      color: hero.color,
      xpAwarded,
      levelBefore,
      levelAfter,
      xpBefore,
      xpAfter: progress.xp,
      xpRequiredForNext: getXpRequiredForNextLevel(progress.level),
      leveledUp: levelAfter > levelBefore,
      unlockedCards,
      messages
    });
  }

  saveProgress();
  return { xpAwarded, heroAwards };
}

export function resetMetaProgressForDebug(): void {
  const fresh = defaultProgress();
  for (const key of Object.keys(GLOBAL_META_PROGRESS)) delete GLOBAL_META_PROGRESS[key];
  Object.assign(GLOBAL_META_PROGRESS, fresh);
  saveProgress();
}
