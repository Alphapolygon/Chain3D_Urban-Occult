import { colorToCss } from '../sim/CellBits';

type QueuePreviewProps = {
  queue: readonly number[];
  cacheColor: number | null;
  cacheUsedThisTurn: boolean;
  onSwapCache: () => void;
};

export function QueuePreview({ queue, cacheColor, cacheUsedThisTurn, onSwapCache }: QueuePreviewProps) {
  return (
    <div className="panel queue-panel">
      <div className="queue-title">Queue</div>
      <div className="queue-row">
        <strong>Next</strong>
        {queue.map((color, index) => (
          <div key={`${index}-${color}`} className="queue-block" style={{ color: colorToCss(color), background: colorToCss(color), opacity: index === 0 ? 1 : 0.56, transform: index === 0 ? 'scale(1.15)' : undefined }} />
        ))}
      </div>
      <div className="cache-row">
        <div className={`cache-slot ${cacheUsedThisTurn ? 'used' : ''}`}>
          <span>Cache</span>
          {cacheColor === null
            ? <div className="cache-empty">empty</div>
            : <div className="queue-block cache-block" style={{ color: colorToCss(cacheColor), background: colorToCss(cacheColor) }} />}
        </div>
        <button disabled={cacheUsedThisTurn} onClick={onSwapCache}>{cacheUsedThisTurn ? 'USED' : 'Swap'}</button>
      </div>
    </div>
  );
}
