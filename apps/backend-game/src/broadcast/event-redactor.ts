import type { GameEvent } from '@gostop/engine';
import type { ClientVisibleEvent, GameStartedEvent, RedactedCardsDealt } from '@gostop/shared';

/** Never broadcast raw hidden-information events to clients. */
export function redactEvent(event: GameEvent): ClientVisibleEvent {
  switch (event.type) {
    case 'GameCreated':
      return {
        type: 'GameStarted',
        gameId: event.gameId,
        rulePreset: event.rule.preset,
        scoreEngineVersion: event.scoreEngineVersion,
        dealer: event.dealer,
        players: event.players.map((p) => ({ ...p })),
      } satisfies GameStartedEvent;
    case 'CardsDealt':
      return {
        type: 'CardsDealt',
        field: [...event.field],
        drawPileCount: event.drawPileCount,
        hands: event.hands.map((h) => ({ seat: h.seat, count: h.cardIds.length })),
      } satisfies RedactedCardsDealt;
    default:
      return event;
  }
}

export function redactEvents(events: readonly GameEvent[]): ClientVisibleEvent[] {
  return events.map(redactEvent);
}
