import type { EnemyState } from '../sim/CombatSystem';
import type { LastActionReport, RunPhase, RunSynergy } from '../sim/RunState';

type EnemyPanelProps = {
  phase: RunPhase; enemy: EnemyState; wave: number; movesLeft: number; score: number; credits: number; enemiesDefeated: number;
  occupiedBlocks: number; coreRadius: number; synergy: RunSynergy; lastAction: LastActionReport;
  onForceAttack: () => void; onGrowCore1: () => void; onGrowCore2: () => void;
};

export function EnemyPanel(props: EnemyPanelProps) {
  const hpPct = props.enemy.maxHp > 0 ? (props.enemy.hp / props.enemy.maxHp) * 100 : 0;
  const statusClass = props.phase === 'ko' || props.lastAction.enemyDefeated ? 'enemy-ko' : props.phase === 'enemy-turn' || props.lastAction.enemyTurn ? 'enemy-turn' : props.lastAction.hardKnockdown ? 'knockdown' : props.enemy.poiseTurns > 0 ? 'poise' : props.lastAction.playerAttack ? 'enemy-hit' : '';
  return (
    <div className={`panel enemy-panel ${statusClass}`}>
      <div className="fighter-label">Nightmare</div>
      <div className="enemy-name">{props.enemy.name}</div>
      <div className="bar hp"><div style={{ width: `${hpPct}%` }} /></div>
      <div className="stat-grid">
        <span>Wave</span><strong>{props.wave}</strong>
        <span>Enemy HP</span><strong>{props.enemy.hp}/{props.enemy.maxHp}</strong>
        <span>Attack</span><strong>{props.phase === 'enemy-turn' ? 'INCOMING' : `${props.enemy.attackTimer} moves`} / {props.enemy.damage} dmg</strong>
        <span>Status</span><strong>{props.phase === 'ko' ? 'BANISHED' : props.phase === 'enemy-turn' ? 'ENEMY TURN' : props.enemy.poiseTurns > 0 ? 'SUPER ARMOR' : 'open'}</strong>
        <span>Player moves</span><strong>{props.movesLeft}</strong>
        <span>Score</span><strong>{props.score}</strong>
        <span>Bodega pts</span><strong>{props.credits}</strong>
        <span>Banished</span><strong>{props.enemiesDefeated}</strong>
        <span>Blocks</span><strong>{props.occupiedBlocks}</strong>
        <span>Core radius</span><strong>{props.coreRadius}</strong>
      </div>
      <div className="synergy-copy"><strong>{props.synergy.title}</strong><br />{props.synergy.description}</div>
      <div className="last-action">{props.lastAction.text}</div>
      <div className="debug-row" style={{ marginTop: 10 }}>
        <button onClick={props.onForceAttack}>Force attack</button>
        <button onClick={props.onGrowCore1}>Core +1</button>
        <button onClick={props.onGrowCore2}>Core +2</button>
      </div>
    </div>
  );
}
