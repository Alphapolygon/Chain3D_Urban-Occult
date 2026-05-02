import { useState, type ChangeEvent } from 'react';
import type { RunConfig } from '../sim/RunState';

type DebugMenuProps = {
  config: RunConfig;
  speed: boolean;
  onApply: (config: RunConfig) => void;
  onToggleSpeed: () => void;
  onClose: () => void;
};

export function DebugMenu({ config, speed, onApply, onToggleSpeed, onClose }: DebugMenuProps) {
  const [maxSize, setMaxSize] = useState(config.board.maxSize);
  const [initRadius, setInitRadius] = useState(config.board.initialRadius);
  const [fillPercent, setFillPercent] = useState(config.board.fillPercent);

  const maxAllowedRadius = Math.max(2, Math.floor(maxSize / 2) - 1);
  const clampedInitialRadius = Math.min(initRadius, maxAllowedRadius);

  function apply(): void {
    onApply({ ...config, board: { ...config.board, maxSize, initialRadius: clampedInitialRadius, fillPercent } });
  }

  return (
    <div className="panel debug-config">
      <div className="debug-config-title">
        <div className="shop-title">Debug Config</div>
        <button className="debug-close" onClick={onClose} title="Close debug menu">x</button>
      </div>
      <label>Max Grid Boundary: {maxSize}</label>
      <input type="range" min={7} max={31} step={1} value={maxSize} onChange={(event: ChangeEvent<HTMLInputElement>) => setMaxSize(parseInt(event.target.value, 10))} />
      <label>Starting Radius: {clampedInitialRadius}</label>
      <input type="range" min={2} max={maxAllowedRadius} value={clampedInitialRadius} onChange={(event: ChangeEvent<HTMLInputElement>) => setInitRadius(parseInt(event.target.value, 10))} />
      <label>Fill: {Math.round(fillPercent * 100)}%</label>
      <input type="range" min={0.2} max={0.8} step={0.01} value={fillPercent} onChange={(event: ChangeEvent<HTMLInputElement>) => setFillPercent(parseFloat(event.target.value))} />
      <button onClick={apply}>Apply &amp; Rebuild Board</button>
      <button className={speed ? 'speed enabled' : 'speed'} onClick={onToggleSpeed}>{speed ? 'Speed Mode ON' : 'Speed Mode OFF'}</button>
    </div>
  );
}
