import type { CSSProperties } from 'react';
import { colorToCss } from '../sim/CellBits';
import type { RunSnapshot } from '../sim/RunState';

type SpecialControlsProps = {
  snapshot: RunSnapshot;
  onActivateHero: (heroIndex: number) => void;
};

export function SpecialControls({ snapshot, onActivateHero }: SpecialControlsProps) {
  return (
    <div className="special-strip">
      <div className="queue-title">Specials</div>
      {snapshot.heroes.map((hero, index) => {
        const ready = hero.hp > 0 && hero.ap >= hero.maxAp;
        const isFront = index === snapshot.frontlineIndex;
        return (
          <button
            key={hero.id}
            className={ready ? 'special-button ready' : 'special-button'}
            style={{ '--hero-color': colorToCss(hero.color) } as CSSProperties}
            disabled={!ready || snapshot.phase !== 'playing'}
            onClick={() => onActivateHero(index)}
          >
            {hero.name}{isFront ? ' // FRONT' : ''} · {ready ? 'CAST' : `AP ${hero.ap}/${hero.maxAp}`}
          </button>
        );
      })}
    </div>
  );
}
