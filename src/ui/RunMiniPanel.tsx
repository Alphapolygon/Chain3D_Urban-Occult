import type { RunSnapshot } from '../sim/RunState';

type RunMiniPanelProps = {
  snapshot: RunSnapshot;
  onForceAttack: () => void;
  onGrowCore: (amount: number) => void;
  onRestart: () => void;
};

export function RunMiniPanel({ snapshot, onForceAttack, onGrowCore, onRestart }: RunMiniPanelProps) {
  return (
    <div className="run-mini-panel">
      <div><strong>Wave {snapshot.wave}</strong><span>Score {snapshot.score}</span></div>
      <div><span>{snapshot.enemy.name}</span><strong>HP {snapshot.enemy.hp}/{snapshot.enemy.maxHp}</strong></div>
      <div><span>Breach {snapshot.occupiedBlocks} blocks</span><span>Core {snapshot.coreRadius}</span></div>
      <div className="debug-row mini-buttons">
        <button onClick={onForceAttack}>Force attack</button>
        <button onClick={() => onGrowCore(1)}>Core +1</button>
        <button onClick={() => onGrowCore(2)}>Core +2</button>
        <button onClick={onRestart}>Restart</button>
      </div>
      <div className="last-action">{snapshot.lastAction.text}</div>
      <div className="selected-cell">Selected cell: {snapshot.selectedCellIndex >= 0 ? snapshot.selectedCellIndex : 'none'}</div>
    </div>
  );
}
