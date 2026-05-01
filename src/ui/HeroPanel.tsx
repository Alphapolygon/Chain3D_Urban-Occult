import { colorToCss } from '../sim/CellBits';
import type { HeroState } from '../sim/CombatSystem';
import type { LastActionReport } from '../sim/RunState';

type HeroPanelProps = { heroes: readonly HeroState[]; frontlineIndex: number; onActivate: (heroIndex: number) => void; lastAction?: LastActionReport; };

export function HeroPanel({ heroes, frontlineIndex, onActivate, lastAction }: HeroPanelProps) {
  const enemyHitClass = lastAction?.enemyAttack ? 'enemy-hit' : '';
  return (
    <div className={`panel hero-panel ${enemyHitClass}`}>
      <div className="fighter-label">Cleaners</div>
      {heroes.map((hero, index) => {
        const hpPct = hero.maxHp > 0 ? (hero.hp / hero.maxHp) * 100 : 0;
        const apPct = hero.maxAp > 0 ? (hero.ap / hero.maxAp) * 100 : 0;
        const isFrontline = index === frontlineIndex;
        const down = hero.hp <= 0;
        const ready = !down && hero.ap >= hero.maxAp;
        return (
          <div key={hero.id} className={`hero-card ${isFrontline ? 'frontline' : ''} ${down ? 'down' : ''} ${ready ? 'power-ready' : ''}`}>
            <div className="hero-card-main">
              <div>
                <div className="hero-name" style={{ color: colorToCss(hero.color) }}>{hero.name}</div>
                <div className="hero-role">{hero.role}{isFrontline ? ' / frontline' : ''}</div>
              </div>
              <button className={ready ? 'ready-button' : ''} disabled={down || hero.ap < hero.maxAp} onClick={() => onActivate(index)}>{ready ? 'CAST' : 'Active'}</button>
            </div>
            {ready ? <div className="power-ready-badge">SPECIAL READY</div> : null}
            <div className="bar hp"><div style={{ width: `${hpPct}%` }} /></div>
            <div className="hero-role">HP {hero.hp}/{hero.maxHp} {hero.shield > 0 ? `+${hero.shield} shield` : ''}</div>
            <div className="bar ap"><div style={{ width: `${apPct}%` }} /></div>
            <div className="hero-role">AP {hero.ap}/{hero.maxAp}</div>
          </div>
        );
      })}
    </div>
  );
}
