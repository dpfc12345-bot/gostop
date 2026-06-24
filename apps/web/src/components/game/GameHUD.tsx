import { motion } from 'framer-motion';
import type { PlayerView } from '@gostop/engine';
import type { ScoreBreakdown } from '@gostop/engine';
import { ScoreBadge } from './ScoreBadge.js';

interface GameHUDProps {
  view: PlayerView;
  myScore: ScoreBreakdown;
  opponentScore: ScoreBreakdown | null;
  opponentName: string;
  isMyTurn: boolean;
}

export function GameHUD({
  view,
  myScore,
  opponentScore,
  opponentName,
  isMyTurn,
}: GameHUDProps) {
  const opponentTurn = view.turn !== view.self.seat && view.phase === 'PLAYING';

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 px-2 pt-2 sm:px-3 sm:pt-2.5">
      {/* Opponent score rail */}
      <div className="glass-panel-subtle pointer-events-auto min-w-0 flex-1 px-2.5 py-1.5 sm:px-3 sm:py-2">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-800 text-xs font-bold text-stone-200 avatar-ring ${opponentTurn ? 'avatar-ring-active' : ''}`}
          >
            {opponentName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold text-stone-300 sm:text-xs">
              {opponentName}
            </p>
            {view.opponents[0] && view.opponents[0].goCount > 0 && (
              <span className="text-[9px] font-bold text-rose-300">{view.opponents[0].goCount}고</span>
            )}
          </div>
          {opponentScore && (
            <ScoreBadge breakdown={opponentScore} compact align="right" />
          )}
        </div>
      </div>

      {/* Center status */}
      <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
        {isMyTurn ? (
          <motion.span
            className="hud-pill hud-pill-turn"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            내 턴
          </motion.span>
        ) : opponentTurn ? (
          <span className="hud-pill text-stone-400">상대 턴</span>
        ) : (
          <span className="hud-pill">턴 {view.turnCount}</span>
        )}
        {view.stakeMultiplier > 1 && (
          <span className="hud-pill hud-pill-gold">×{view.stakeMultiplier}</span>
        )}
      </div>

      {/* My score rail */}
      <div className="glass-panel-subtle pointer-events-auto min-w-0 flex-1 px-2.5 py-1.5 sm:px-3 sm:py-2">
        <div className="flex items-center justify-end gap-2">
          <div className="text-right">
            {view.self.goCount > 0 && (
              <span className="mr-1 text-[9px] font-bold text-rose-300">{view.self.goCount}고</span>
            )}
            {view.self.hasShaken && (
              <span className="text-[9px] font-bold text-amber-300">흔듦</span>
            )}
            <p className="text-[10px] font-semibold text-stone-300 sm:text-xs">나</p>
          </div>
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-dark)] text-xs font-bold text-white avatar-ring ${isMyTurn ? 'avatar-ring-active' : ''}`}
          >
            나
          </div>
          <ScoreBadge breakdown={myScore} compact align="right" />
        </div>
      </div>
    </div>
  );
}
