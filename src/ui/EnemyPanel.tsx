import type { EnemyState } from '../sim/CombatSystem';
import type { LastActionReport, RunPhase, RunSynergy } from '../sim/RunState';

type EnemyPanelProps = {
  phase: RunPhase; enemy: EnemyState; wave: number; movesLeft: number; score: number; credits: number; enemiesDefeated: number;
  occupiedBlocks: number; coreRadius: number; synergy: RunSynergy; lastAction: LastActionReport;
  onForceAttack: () => void; onGrowCore1: () => void; onGrowCore2: () => void;
};

function shortName(name: string): string {
  return name.split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase();
}

export function EnemyPanel(props: EnemyPanelProps) {
  const statusClass = props.phase === 'ko' || props.lastAction.enemyDefeated
    ? 'enemy-ko'
    : props.phase === 'enemy-turn' || props.lastAction.enemyTurn
      ? 'enemy-turn'
      : props.lastAction.hardKnockdown
        ? 'knockdown'
        : props.enemy.poiseTurns > 0
          ? 'poise'
          : props.lastAction.playerAttack
            ? 'enemy-hit'
            : '';
  const isIncoming = props.phase === 'enemy-turn' || props.enemy.attackTimer === 0;

  return (
    <div className={`enemy-panel arcade-fighter-panel ${statusClass}`}>
      <div className="sprite-container enemy-sprite-container">
        {props.enemy.spriteUrl ? (
          <img src={props.enemy.spriteUrl} className="fighter-sprite enemy-sprite" alt={props.enemy.name} />
        ) : (
          <div className="fighter-sprite fallback-sprite enemy-fallback-sprite">{shortName(props.enemy.name)}</div>
        )}
      </div>

      <div className="fighter-hud boss-hud">
        <div className="fighter-hud-header">
          <span className="hero-name" style={{ color: '#ff49d8' }}>{props.enemy.name}</span>
          <span className="hero-hp">HP {props.enemy.hp}/{props.enemy.maxHp}</span>
        </div>

        <div className={`boss-timer ${isIncoming ? 'incoming' : ''}`}>
          {isIncoming ? 'ATTACK INCOMING' : `Attacks in ${props.enemy.attackTimer} moves`}
        </div>
      </div>

      <div className="enemy-run-stats">
        <span>Wave {props.wave}</span>
        <span>Score {props.score}</span>
        <span>Bodega {props.credits}</span>
        <span>Banished {props.enemiesDefeated}</span>
        <span>Blocks {props.occupiedBlocks}</span>
        <span>Core {props.coreRadius}</span>
      </div>
      <div className="synergy-copy"><strong>{props.synergy.title}</strong><br />{props.synergy.description}</div>
      <div className="last-action">{props.lastAction.text}</div>
      <div className="debug-row boss-debug-row" style={{ marginTop: 10 }}>
        <button onClick={props.onForceAttack}>Force attack</button>
        <button onClick={props.onGrowCore1}>Core +1</button>
        <button onClick={props.onGrowCore2}>Core +2</button>
      </div>
    </div>
  );
}
