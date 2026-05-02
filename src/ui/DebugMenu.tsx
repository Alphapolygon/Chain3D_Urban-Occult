import { useState, type ChangeEvent } from 'react';
import type { RunConfig } from '../sim/RunState';

export type DebugRuntimeActions = {
  damageEnemy: (amount: number) => void;
  killEnemy: () => void;
  healEnemy: () => void;
  spawnWave: (wave: number) => void;
  setEnemyTimer: (moves: number) => void;
  refillHeroes: () => void;
  maxHeroAp: () => void;
  addPoints: (amount: number) => void;
  forceAttack: () => void;
  forceCoreGrowth: (amount: number) => void;
};

type DebugMenuProps = {
  config: RunConfig;
  speed: boolean;
  currentWave: number;
  onApply: (config: RunConfig) => void;
  onToggleSpeed: () => void;
  onClose: () => void;
  runtime: DebugRuntimeActions;
};

export function DebugMenu({ config, speed, currentWave, onApply, onToggleSpeed, onClose, runtime }: DebugMenuProps) {
  const [maxSize, setMaxSize] = useState(config.board.maxSize);
  const [initRadius, setInitRadius] = useState(config.board.initialRadius);
  const [fillPercent, setFillPercent] = useState(config.board.fillPercent);
  const [movesPerTurn, setMovesPerTurn] = useState(config.movesPerTurn);
  const [maxChains, setMaxChains] = useState(config.maxChains);
  const [scorePerBlock, setScorePerBlock] = useState(config.scorePerBlock);

  const [enemyHpMultiplier, setEnemyHpMultiplier] = useState(config.enemyHpMultiplier ?? 1);
  const [enemyDamageMultiplier, setEnemyDamageMultiplier] = useState(config.enemyDamageMultiplier ?? 1);
  const [enemyAttackEveryMoves, setEnemyAttackEveryMoves] = useState(config.enemyAttackEveryMoves ?? 5);
  const [growthChance, setGrowthChance] = useState(config.enemyCoreGrowthChanceMax ?? config.enemyCoreGrowthChanceMin ?? 0.25);
  const [startingWave, setStartingWave] = useState(config.startingWave ?? 1);

  const [damageAmount, setDamageAmount] = useState(250);
  const [spawnWave, setSpawnWave] = useState(Math.max(1, currentWave + 1));
  const [timerMoves, setTimerMoves] = useState(1);
  const [pointsAmount, setPointsAmount] = useState(10000);

  const maxAllowedRadius = Math.max(2, Math.floor(maxSize / 2) - 1);
  const clampedInitialRadius = Math.min(initRadius, maxAllowedRadius);

  function apply(): void {
    onApply({
      ...config,
      movesPerTurn,
      maxChains,
      scorePerBlock,
      enemyCoreGrowthChanceMin: growthChance,
      enemyCoreGrowthChanceMax: growthChance,
      enemyHpMultiplier,
      enemyDamageMultiplier,
      enemyAttackEveryMoves,
      startingWave,
      board: {
        ...config.board,
        maxSize,
        initialRadius: clampedInitialRadius,
        fillPercent,
        staticNoisePercent: 0
      }
    });
  }

  function applyEnemyPreset(preset: 'normal' | 'hard' | 'nightmare'): void {
    if (preset === 'normal') {
      setEnemyHpMultiplier(1);
      setEnemyDamageMultiplier(1);
      setEnemyAttackEveryMoves(5);
      setGrowthChance(0.25);
      return;
    }
    if (preset === 'hard') {
      setEnemyHpMultiplier(2.2);
      setEnemyDamageMultiplier(1.6);
      setEnemyAttackEveryMoves(4);
      setGrowthChance(0.45);
      return;
    }
    setEnemyHpMultiplier(4);
    setEnemyDamageMultiplier(2.6);
    setEnemyAttackEveryMoves(3);
    setGrowthChance(0.75);
  }

  return (
    <div className="panel debug-config">
      <div className="debug-config-title">
        <div>
          <div className="shop-title">Debug Config</div>
          <div className="debug-subtitle">Board, enemy pressure, and live cheats</div>
        </div>
        <button className="debug-close" onClick={onClose} title="Close debug menu">x</button>
      </div>

      <section className="debug-section">
        <h3>Board</h3>
        <label>Max Grid Boundary: {maxSize}</label>
        <input type="range" min={7} max={31} step={1} value={maxSize} onChange={(event: ChangeEvent<HTMLInputElement>) => setMaxSize(parseInt(event.target.value, 10))} />
        <label>Starting Radius: {clampedInitialRadius}</label>
        <input type="range" min={2} max={maxAllowedRadius} value={clampedInitialRadius} onChange={(event: ChangeEvent<HTMLInputElement>) => setInitRadius(parseInt(event.target.value, 10))} />
        <label>Fill: {Math.round(fillPercent * 100)}%</label>
        <input type="range" min={0.2} max={0.95} step={0.01} value={fillPercent} onChange={(event: ChangeEvent<HTMLInputElement>) => setFillPercent(parseFloat(event.target.value))} />
      </section>

      <section className="debug-section">
        <h3>Run Rules</h3>
        <label>Moves per batch: {movesPerTurn}</label>
        <input type="range" min={1} max={10} step={1} value={movesPerTurn} onChange={(event: ChangeEvent<HTMLInputElement>) => setMovesPerTurn(parseInt(event.target.value, 10))} />
        <label>Max Chains: {maxChains}</label>
        <input type="range" min={1} max={24} step={1} value={maxChains} onChange={(event: ChangeEvent<HTMLInputElement>) => setMaxChains(parseInt(event.target.value, 10))} />
        <label>Score per Block: {scorePerBlock}</label>
        <input type="range" min={10} max={1000} step={10} value={scorePerBlock} onChange={(event: ChangeEvent<HTMLInputElement>) => setScorePerBlock(parseInt(event.target.value, 10))} />
      </section>

      <section className="debug-section enemy-tuning">
        <h3>Enemy Difficulty</h3>
        <div className="debug-presets">
          <button onClick={() => applyEnemyPreset('normal')}>Normal</button>
          <button onClick={() => applyEnemyPreset('hard')}>Hard</button>
          <button onClick={() => applyEnemyPreset('nightmare')}>Nightmare</button>
        </div>
        <label>Enemy HP x{enemyHpMultiplier.toFixed(2)}</label>
        <input type="range" min={0.25} max={8} step={0.05} value={enemyHpMultiplier} onChange={(event: ChangeEvent<HTMLInputElement>) => setEnemyHpMultiplier(parseFloat(event.target.value))} />
        <label>Enemy Damage x{enemyDamageMultiplier.toFixed(2)}</label>
        <input type="range" min={0.25} max={6} step={0.05} value={enemyDamageMultiplier} onChange={(event: ChangeEvent<HTMLInputElement>) => setEnemyDamageMultiplier(parseFloat(event.target.value))} />
        <label>Enemy Attacks Every: {enemyAttackEveryMoves} moves</label>
        <input type="range" min={1} max={12} step={1} value={enemyAttackEveryMoves} onChange={(event: ChangeEvent<HTMLInputElement>) => setEnemyAttackEveryMoves(parseInt(event.target.value, 10))} />
        <label>Core Growth Chance: {Math.round(growthChance * 100)}%</label>
        <input type="range" min={0} max={1} step={0.01} value={growthChance} onChange={(event: ChangeEvent<HTMLInputElement>) => setGrowthChance(parseFloat(event.target.value))} />
        <label>Start at Wave: {startingWave}</label>
        <input type="range" min={1} max={30} step={1} value={startingWave} onChange={(event: ChangeEvent<HTMLInputElement>) => setStartingWave(parseInt(event.target.value, 10))} />
      </section>

      <button className="primary-debug-apply" onClick={apply}>Apply &amp; Rebuild Run</button>
      <button className={speed ? 'speed enabled' : 'speed'} onClick={onToggleSpeed}>{speed ? 'Speed Mode ON' : 'Speed Mode OFF'}</button>

      <section className="debug-section live-cheats">
        <h3>Live Cheats</h3>
        <div className="debug-number-row">
          <label>Damage</label>
          <input type="number" min={1} step={50} value={damageAmount} onChange={(event: ChangeEvent<HTMLInputElement>) => setDamageAmount(parseInt(event.target.value || '0', 10))} />
          <button onClick={() => runtime.damageEnemy(damageAmount)}>Hit Enemy</button>
        </div>
        <div className="debug-row debug-cheat-row">
          <button onClick={runtime.killEnemy}>Kill Enemy</button>
          <button onClick={runtime.healEnemy}>Heal Enemy</button>
          <button onClick={runtime.forceAttack}>Force Attack</button>
        </div>
        <div className="debug-number-row">
          <label>Wave</label>
          <input type="number" min={1} step={1} value={spawnWave} onChange={(event: ChangeEvent<HTMLInputElement>) => setSpawnWave(parseInt(event.target.value || '1', 10))} />
          <button onClick={() => runtime.spawnWave(spawnWave)}>Spawn</button>
          <button onClick={() => runtime.spawnWave(currentWave + 1)}>Next</button>
        </div>
        <div className="debug-number-row">
          <label>Timer</label>
          <input type="number" min={0} step={1} value={timerMoves} onChange={(event: ChangeEvent<HTMLInputElement>) => setTimerMoves(parseInt(event.target.value || '0', 10))} />
          <button onClick={() => runtime.setEnemyTimer(timerMoves)}>Set</button>
          <button onClick={() => runtime.setEnemyTimer(0)}>Enemy Turn</button>
        </div>
        <div className="debug-row debug-cheat-row">
          <button onClick={runtime.refillHeroes}>Heal Heroes</button>
          <button onClick={runtime.maxHeroAp}>Max AP</button>
          <button onClick={() => runtime.forceCoreGrowth(1)}>Core +1</button>
          <button onClick={() => runtime.forceCoreGrowth(2)}>Core +2</button>
        </div>
        <div className="debug-number-row">
          <label>Points</label>
          <input type="number" min={0} step={1000} value={pointsAmount} onChange={(event: ChangeEvent<HTMLInputElement>) => setPointsAmount(parseInt(event.target.value || '0', 10))} />
          <button onClick={() => runtime.addPoints(pointsAmount)}>Add</button>
        </div>
      </section>
    </div>
  );
}
