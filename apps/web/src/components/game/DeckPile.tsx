import { useEffect, useRef } from 'react';
import { HwatuCard } from './HwatuCard.js';

interface DeckPileProps {
  count: number;
}

/** Visual draw pile — count only, no game logic. */
export function DeckPile({ count }: DeckPileProps) {
  const prevCount = useRef(count);
  const flipping = count < prevCount.current;

  useEffect(() => {
    prevCount.current = count;
  }, [count]);

  const layers = Math.min(3, Math.max(1, Math.ceil(count / 8)));

  return (
    <div className="deck-pile" aria-label={`남은 패 ${count}장`}>
      <div className={`deck-pile-stack ${flipping ? 'deck-flip' : ''}`}>
        {Array.from({ length: layers }, (_, i) => (
          <div
            key={i}
            className="absolute left-0 top-0"
            style={{ transform: `translate(${i * 2}px, ${i * -1.5}px)`, zIndex: i }}
          >
            <HwatuCard id={0} faceDown size="sm" className="pointer-events-none opacity-95" />
          </div>
        ))}
      </div>
      <span className="deck-pile-count">{count}</span>
    </div>
  );
}
