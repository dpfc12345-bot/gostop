import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import type { PlayerView } from '@gostop/engine';
import { cardLayoutId } from '../../lib/card-layout-id.js';
import { cardEnterTransition, cardLayoutTransition } from '../../lib/motion-config.js';
import { previewScoreFromCapture } from '../../lib/score-preview.js';
import { useGameStore } from '../../store/game-store.js';
import { CapturedStrip } from './CapturedStrip.js';
import { DeckPile } from './DeckPile.js';
import { GameHUD } from './GameHUD.js';
import { HwatuCard } from './HwatuCard.js';
import { OpponentHand } from './OpponentHand.js';
import { PlayerHand } from './PlayerHand.js';

interface GameTableProps {
  view: PlayerView;
  onPlayCard?: (cardId: number) => void;
  onChooseMatch?: (cardId: number) => void;
}

export function GameTable({ view, onPlayCard, onChooseMatch }: GameTableProps) {
  const [playingCardId, setPlayingCardId] = useState<number | null>(null);
  const prevViewRef = useRef(view);

  // Clear "flying card" state once the server responds and view updates
  useEffect(() => {
    if (view !== prevViewRef.current) {
      prevViewRef.current = view;
      setPlayingCardId(null);
    }
  }, [view]);

  const opponent = view.opponents[0];
  const opponentMember = useGameStore.getState().room?.members.find(
    (m) => m.seat === opponent?.seat,
  );
  const opponentName =
    opponentMember?.user.nickname ??
    (opponent?.isAi ? 'AI 상대' : opponent?.playerId ?? '상대');
  const isMyTurn = view.turn === view.self.seat && view.phase === 'PLAYING';
  const pendingMatch =
    view.pending?.kind === 'CHOOSE_MATCH' &&
    view.pending.seat === view.self.seat &&
    'candidates' in view.pending
      ? view.pending
      : null;

  const fieldMonths = Object.entries(view.board.field).sort(
    ([a], [b]) => Number(a) - Number(b),
  );

  const myScore = previewScoreFromCapture({
    rulePreset: view.rulePreset,
    seat: view.self.seat,
    captured: view.self.captured,
    goCount: view.self.goCount,
    hasShaken: view.self.hasShaken,
  });

  const opponentScore = opponent
    ? previewScoreFromCapture({
        rulePreset: view.rulePreset,
        seat: opponent.seat,
        captured: opponent.captured,
        goCount: opponent.goCount,
        hasShaken: opponent.hasShaken,
      })
    : null;

  const handlePlayCard = (cardId: number) => {
    setPlayingCardId(cardId);
    onPlayCard?.(cardId);
  };

  return (
    <div className="game-viewport">
      <div className="game-table-outer">
        <div className="game-table-rail">
          <div className="game-table-felt">
            {/* Single LayoutGroup so cards can animate freely between hand, field, and captured */}
            <LayoutGroup id="hwatu-cards">
              <GameHUD
                view={view}
                myScore={myScore}
                opponentScore={opponentScore}
                opponentName={opponentName}
                isMyTurn={isMyTurn}
              />

              {/* ── Opponent zone ── */}
              <section className="game-zone game-zone-opponent">
                <OpponentHand count={opponent?.handCount ?? 0} />
                {opponent && (
                  <CapturedStrip
                    rulePreset={view.rulePreset}
                    seat={opponent.seat}
                    captured={opponent.captured}
                    goCount={opponent.goCount}
                    hasShaken={opponent.hasShaken}
                    compact
                  />
                )}
              </section>

              {/* ── Field zone ── */}
              <section className="game-zone game-zone-field">
                <div className="flex w-full max-w-none items-center justify-center gap-2 sm:gap-4">
                  <DeckPile count={view.drawPileCount} />

                  <div className="flex min-h-[6rem] flex-1 flex-wrap items-center justify-center gap-2 sm:min-h-[7.5rem] sm:gap-3">
                    <AnimatePresence mode="popLayout">
                      {fieldMonths.length === 0 ? (
                        <motion.p
                          key="empty"
                          className="text-xs text-emerald-200/35 sm:text-sm"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          바닥이 비었습니다
                        </motion.p>
                      ) : (
                        fieldMonths.map(([month, cards]) => (
                          <motion.div
                            key={month}
                            layout
                            className="field-month"
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                          >
                            <span className="field-month-label">{month}월</span>
                            <div className="flex gap-0.5 sm:gap-1">
                              {(cards ?? []).map((id) => (
                                <motion.div
                                  key={id}
                                  layout
                                  layoutId={cardLayoutId(id)}
                                  /* Enters from the player side (below) so it looks
                                     like it flew up from the hand */
                                  initial={{ opacity: 0, scale: 0.72, y: 56, rotate: 6 }}
                                  animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                                  exit={{ opacity: 0, scale: 0.55, y: -20 }}
                                  transition={{
                                    type: 'spring',
                                    stiffness: 340,
                                    damping: 26,
                                    ...cardLayoutTransition,
                                  }}
                                >
                                  <HwatuCard
                                    id={id}
                                    size="sm"
                                    selectable={Boolean(pendingMatch?.candidates.includes(id))}
                                    onClick={
                                      pendingMatch && onChooseMatch
                                        ? () => onChooseMatch(id)
                                        : undefined
                                    }
                                  />
                                </motion.div>
                              ))}
                            </div>
                          </motion.div>
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {pendingMatch && (
                  <motion.p
                    className="mt-2 text-center text-[10px] font-bold text-sky-200 sm:text-xs"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {pendingMatch.month}월 — 바닥 카드를 선택하세요
                  </motion.p>
                )}
              </section>

              {/* ── Player zone ── */}
              <section className="game-zone game-zone-player">
                <CapturedStrip
                  rulePreset={view.rulePreset}
                  seat={view.self.seat}
                  captured={view.self.captured}
                  goCount={view.self.goCount}
                  hasShaken={view.self.hasShaken}
                />

                <div className="mt-1 border-t border-white/5 pt-1 sm:mt-1.5 sm:pt-1.5">
                  <PlayerHand
                    cards={view.self.hand}
                    selectable={isMyTurn && !pendingMatch && Boolean(handlePlayCard)}
                    onPlay={handlePlayCard}
                    playingCardId={playingCardId}
                  />
                </div>
              </section>
            </LayoutGroup>
          </div>
        </div>
      </div>
    </div>
  );
}
