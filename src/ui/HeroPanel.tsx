import { colorToCss } from '../sim/CellBits';
import type { HeroState } from '../sim/CombatSystem';

type HeroPanelProps = { heroes: readonly HeroState[]; frontlineIndex: number; onActivate: (heroIndex: number) => void; };

export function HeroPanel({ heroes, frontlineIndex, onActivate }: HeroPanelProps) {
  return (
    <div className="panel hero-panel">
      {heroes.map((hero, index) => {
        const hpPct = hero.maxHp > 0 ? (hero.hp / hero.maxHp) * 100 : 0;
        const apPct = hero.maxAp > 0 ? (hero.ap / hero.maxAp) * 100 : 0;
        const isFrontline = index === frontlineIndex;
        const down = hero.hp <= 0;
        return (
          <div key={hero.id} className={`hero-card ${isFrontline ? 'frontline' : ''} ${down ? 'down' : ''}`}>
            <div className="hero-name" style={{ color: colorToCss(hero.color) }}>{hero.name}</div>
            <div className="hero-role">{hero.role}{isFrontline ? ' / frontline' : ''}</div>
            <div className="bar hp"><div style={{ width: `${hpPct}%` }} /></div>
            <div className="hero-role">HP {hero.hp}/{hero.maxHp} {hero.shield > 0 ? `+${hero.shield} shield` : ''}</div>
            <div className="bar"><div style={{ width: `${apPct}%` }} /></div>
            <div className="hero-role">AP {hero.ap}/{hero.maxAp}</div>
            <button disabled={down || hero.ap < hero.maxAp} onClick={() => onActivate(index)}>Active</button>
          </div>
        );
      })}
    </div>
  );
}
