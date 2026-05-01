import { colorToCss } from '../sim/CellBits';
import type { HeroState } from '../sim/CombatSystem';
import type { LastActionReport } from '../sim/RunState';

type HeroPanelProps = { heroes: readonly HeroState[]; frontlineIndex: number; onActivate: (heroIndex: number) => void; lastAction?: LastActionReport; };

function initials(name: string): string {
  return name.replace(/^The\s+/i, '').split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase();
}

export function HeroPanel({ heroes, frontlineIndex, onActivate, lastAction }: HeroPanelProps) {
  const enemyHitClass = lastAction?.enemyAttack ? 'enemy-hit' : '';

  return (
    <div className={`hero-panel arcade-fighter-panel ${enemyHitClass}`}>
      {heroes.map((hero, index) => {
        const apPct = hero.maxAp > 0 ? (hero.ap / hero.maxAp) * 100 : 0;
        const isFrontline = index === frontlineIndex;
        const down = hero.hp <= 0;
        const ready = !down && hero.ap >= hero.maxAp;
        const color = colorToCss(hero.color);

        return (
          <div key={hero.id} className={`fighter-hud ${isFrontline ? 'frontline' : ''} ${down ? 'down' : ''}`}>
            <div className={`sprite-container ${ready ? 'power-ready-sprite' : ''}`}>
              {hero.spriteUrl ? (
                <img src={hero.spriteUrl} className="fighter-sprite" alt={hero.name} />
              ) : (
                <div className="fighter-sprite fallback-sprite hero-fallback-sprite" style={{ borderColor: color, color }}>
                  {initials(hero.name)}
                </div>
              )}
            </div>

            <div className="fighter-hud-stats">
              <div className="fighter-hud-header">
                <span className="hero-name" style={{ color }}>
                  {hero.name}{isFrontline ? ' [FRONT]' : ''}
                </span>
                <span className="hero-hp">HP {hero.hp}/{hero.maxHp}{hero.shield > 0 ? ` +${hero.shield}` : ''}</span>
              </div>

              <div className={`bar ap ${ready ? 'ap-ready' : ''}`}>
                <div style={{ width: `${apPct}%`, background: color }} />
              </div>

              <button
                className={`cast-btn ${ready ? 'ready-button' : ''}`}
                disabled={down || hero.ap < hero.maxAp}
                onClick={() => onActivate(index)}
              >
                {ready ? 'CAST SPECIAL' : `AP ${hero.ap}/${hero.maxAp}`}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
