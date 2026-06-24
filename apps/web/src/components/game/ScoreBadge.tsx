import { useEffect, useRef, useState } from 'react';
import type { ScoreBreakdown } from '@gostop/engine';
import { formatScoreSummary } from '../../lib/score-preview.js';

interface ScoreBadgeProps {
  breakdown: ScoreBreakdown;
  label?: string;
  compact?: boolean;
  align?: 'left' | 'right';
}

export function ScoreBadge({ breakdown, label, compact, align = 'right' }: ScoreBadgeProps) {
  const [display, setDisplay] = useState(breakdown.total);
  const prev = useRef(breakdown.total);

  useEffect(() => {
    if (prev.current === breakdown.total) return;
    let frame = 0;
    const from = prev.current;
    const to = breakdown.total;
    const start = performance.now();
    const duration = 700;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(from + (to - from) * t));
      if (t < 1) frame = requestAnimationFrame(tick);
      else prev.current = to;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [breakdown.total]);

  const popped = display !== prev.current;

  return (
    <div className={`flex flex-col ${align === 'right' ? 'items-end text-right' : 'items-start'}`}>
      {label && (
        <span className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{label}</span>
      )}
      <span
        className={`font-display tabular-nums text-gold ${compact ? 'text-xl' : 'text-3xl'} ${popped ? 'score-pop' : ''}`}
      >
        {display}
        <span className="ml-0.5 text-[0.55em] font-sans font-semibold text-stone-400">점</span>
      </span>
      {!compact && (
        <p className="mt-0.5 max-w-[200px] text-[10px] leading-snug text-stone-500">
          {formatScoreSummary(breakdown)}
        </p>
      )}
    </div>
  );
}
