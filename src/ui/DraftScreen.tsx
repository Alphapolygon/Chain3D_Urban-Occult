import { useState, type CSSProperties } from 'react';
import { colorToCss } from '../sim/CellBits';
import type { HeroDefinition } from '../sim/CombatSystem';
import { getHeroProgress, getXpRequiredForNextLevel, META_UNLOCKS } from '../data/metaProgress';

type DraftScreenProps = {
  heroes: readonly HeroDefinition[];
  initialSelectedIds?: readonly string[];
  onStart: (draft: HeroDefinition[]) => void;
};

export function DraftScreen({ heroes, initialSelectedIds, onStart }: DraftScreenProps) {
  const initial = (initialSelectedIds && initialSelectedIds.length >= 3)
    ? initialSelectedIds.slice(0, 3)
    : heroes.slice(0, 3).map((hero) => hero.id);
  const [selectedIds, setSelectedIds] = useState<string[]>(Array.from(initial));

  const selectedHeroes = selectedIds
    .map((id: string) => heroes.find((hero: HeroDefinition) => hero.id === id))
    .filter((hero: HeroDefinition | undefined): hero is HeroDefinition => !!hero);
  const canStart = selectedHeroes.length === 3;

  function toggleHero(hero: HeroDefinition): void {
    setSelectedIds((current: string[]) => {
      if (current.includes(hero.id)) return current.filter((id: string) => id !== hero.id);
      if (current.length >= 3) return [...current.slice(1), hero.id];
      return [...current, hero.id];
    });
  }

  return (
    <div className="draft-screen">
      <div className="panel draft-panel">
        <div className="post-run-kicker">URBAN OCCULT // CLEANER APP</div>
        <div className="shop-title draft-title">Draft Your Crew</div>
        <p className="draft-copy">
          Pick 3 Cleaners. Their mastery levels change base stats and unlock new Darkweb Bodega cards.
        </p>

        <div className="draft-grid">
          {heroes.map((hero: HeroDefinition) => {
            const progress = getHeroProgress(hero.id);
            const selected = selectedIds.includes(hero.id);
            const xpReq = getXpRequiredForNextLevel(progress.level);
            const xpPct = Math.min(100, xpReq > 0 ? (progress.xp / xpReq) * 100 : 100);
            const color = colorToCss(hero.color);
            const unlocks = META_UNLOCKS[hero.id] ?? [];
            return (
              <button
                type="button"
                key={hero.id}
                className={`draft-card ${selected ? 'selected' : ''}`}
                onClick={() => toggleHero(hero)}
                style={{ '--hero-color': color } as CSSProperties}
              >
                <div className="draft-card-top">
                  <strong>{hero.name}</strong>
                  <span>{hero.role}</span>
                </div>
                <div className="draft-color-chip" style={{ background: color }} />
                <div className="draft-stat-line"><span>Level</span><b>{progress.level}</b></div>
                <div className="draft-stat-line"><span>Power</span><b>{hero.activePower.replace('-', ' ')}</b></div>
                <div className="bar draft-xp"><div style={{ width: `${xpPct}%`, background: color }} /></div>
                <div className="draft-xp-text">{progress.xp} / {xpReq} XP</div>
                <div className="draft-unlocks">
                  {unlocks.length > 0 ? unlocks.map((unlock) => {
                    const unlocked = progress.unlockedCards.includes(unlock.itemId);
                    return (
                      <span className={unlocked ? 'unlocked' : ''} key={unlock.itemId}>
                        {unlocked ? 'Unlocked' : `Lv ${unlock.level}`} · {unlock.cardName}
                      </span>
                    );
                  }) : <span>No encrypted cards found.</span>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="draft-footer">
          <div>
            <strong>{selectedHeroes.length}/3 selected</strong>
            <span>{selectedHeroes.map((hero: HeroDefinition) => hero.name).join(' · ') || 'Choose your Cleaners'}</span>
          </div>
          <button disabled={!canStart} onClick={() => canStart && onStart(selectedHeroes)}>Start Run</button>
        </div>
      </div>
    </div>
  );
}
