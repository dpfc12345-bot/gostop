import type { GameAction } from '@gostop/engine';
import type { PlayerView } from '@gostop/engine';
import { motion } from 'framer-motion';
import { Button } from '../ui/Button.js';

interface DecisionModalProps {
  view: PlayerView;
  legalActions: GameAction[];
  onAction: (action: GameAction) => void;
}

/** Secondary decisions (match hint handled on table; shake/bomb actions). */
export function DecisionModal({ view, legalActions, onAction }: DecisionModalProps) {
  if (legalActions.length === 0 || view.turn !== view.self.seat) return null;

  const extras = legalActions.filter(
    (a) => a.type === 'DECLARE_SHAKE' || a.type === 'PLAY_BOMB',
  );
  if (extras.length === 0) return null;

  return (
    <motion.div
      className="fixed bottom-[calc(5.5rem+var(--game-safe-bottom))] left-0 right-0 z-40 flex justify-center gap-2 px-4 sm:bottom-32"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      {extras.map((a, i) => (
        <Button
          key={i}
          variant={a.type === 'PLAY_BOMB' ? 'primary' : 'gold'}
          size="md"
          onClick={() => onAction(a)}
        >
          {a.type === 'DECLARE_SHAKE' ? `흔들기 ${a.month}월` : `폭탄 ${a.month}월`}
        </Button>
      ))}
    </motion.div>
  );
}
