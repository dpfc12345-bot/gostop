import { motion } from 'framer-motion';
import type { GameResultMsg } from '@gostop/shared';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button.js';
import { useGameStore } from '../../store/game-store.js';

interface VictoryScreenProps {
  result: GameResultMsg;
  mySeat: number;
}

export function VictoryScreen({ result, mySeat }: VictoryScreenProps) {
  const navigate = useNavigate();
  const user = useGameStore((s) => s.user);
  const won = result.winner === mySeat;
  const myBreakdown = result.breakdowns.find((b) => b.seat === mySeat);
  const opponentBreakdown = result.breakdowns.find((b) => b.seat !== mySeat);

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/88 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Ambient glow */}
      <div
        className={`pointer-events-none absolute inset-0 ${won ? 'bg-[radial-gradient(ellipse_at_center,rgba(245,200,66,0.12)_0%,transparent_60%)]' : 'bg-[radial-gradient(ellipse_at_center,rgba(100,100,120,0.08)_0%,transparent_60%)]'}`}
      />

      <motion.div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
        initial={{ y: 60, scale: 0.94 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      >
        {/* Header band */}
        <div
          className={`relative px-6 pb-4 pt-8 text-center ${won ? 'bg-gradient-to-b from-amber-800/90 via-amber-950/80 to-stone-950' : 'bg-gradient-to-b from-stone-700/80 to-stone-950'}`}
        >
          {won && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center gap-3 pt-3 opacity-60">
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-amber-300"
                  animate={{ y: [0, 12, 0], opacity: [1, 0.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.15 }}
                />
              ))}
            </div>
          )}

          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 380 }}
          >
            <p className="font-display text-5xl tracking-wide text-gold sm:text-6xl">
              {won ? '승리!' : '패배'}
            </p>
            <p className="mt-2 text-sm text-stone-400">
              {user?.nickname ?? '플레이어'}
              <span className="mx-2 text-stone-600">·</span>
              <span className="font-bold text-stone-200">{result.finalScore}점</span>
            </p>
          </motion.div>
        </div>

        {/* Score breakdown */}
        <div className="space-y-3 bg-stone-950/95 px-5 py-5">
          {myBreakdown && (
            <motion.div
              className="rounded-xl border border-white/8 bg-black/35 p-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-500">
                내 점수 상세
              </p>
              <div className="space-y-0.5 text-sm">
                {myBreakdown.components.map((c) => (
                  <div
                    key={c.code}
                    className="flex justify-between border-b border-white/4 py-1.5 text-stone-400"
                  >
                    <span>{c.label}</span>
                    <span className="font-bold tabular-nums text-stone-200">{c.points}</span>
                  </div>
                ))}
                {myBreakdown.goBonus > 0 && (
                  <div className="flex justify-between py-1.5 text-rose-300/90">
                    <span>고 보너스</span>
                    <span className="font-bold tabular-nums">+{myBreakdown.goBonus}</span>
                  </div>
                )}
                {myBreakdown.multipliers.map((m) => (
                  <div key={m.code} className="flex justify-between py-1.5 text-amber-400/85">
                    <span>{m.label}</span>
                    <span className="font-bold">×{m.factor}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t border-white/10 pt-3">
                <span className="font-display text-lg text-stone-300">합계</span>
                <span className="font-display text-2xl tabular-nums text-gold">
                  {myBreakdown.total}점
                </span>
              </div>
            </motion.div>
          )}

          {opponentBreakdown && (
            <motion.div
              className="rounded-xl border border-white/5 bg-black/20 px-4 py-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
            >
              <div className="flex justify-between text-sm text-stone-500">
                <span>상대 최종</span>
                <span className="font-bold tabular-nums text-stone-400">
                  {opponentBreakdown.total}점
                </span>
              </div>
            </motion.div>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => navigate('/lobby')}>
              로비
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => window.location.reload()}>
              다시하기
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
