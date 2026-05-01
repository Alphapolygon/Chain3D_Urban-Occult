import { colorToCss } from '../sim/CellBits';

type QueuePreviewProps = { queue: readonly number[]; };

export function QueuePreview({ queue }: QueuePreviewProps) {
  return (
    <div className="panel queue">
      <strong>Next</strong>
      {queue.map((color, index) => (
        <div key={`${index}-${color}`} className="queue-block" style={{ color: colorToCss(color), background: colorToCss(color), opacity: index === 0 ? 1 : 0.56, transform: index === 0 ? 'scale(1.15)' : undefined }} />
      ))}
    </div>
  );
}
