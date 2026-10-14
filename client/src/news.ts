import type { GameEvent, SabotageKind } from '@oil/shared';
import { money } from './format.js';

const STORIES: Record<string, (e: Extract<GameEvent, { type: 'news' }>) => string> = {
  war: () => 'WAR IN THE GULF! TANKERS UNDER FIRE',
  embargo: () => 'OIL EMBARGO ANNOUNCED',
  discovery: () => 'HUGE NEW OIL FIELD FOUND OFFSHORE',
  glut: () => 'OIL GLUT: STORAGE FULL WORLDWIDE',
  strike: (e) => `OIL WORKERS STRIKE IN ${e.region?.toUpperCase()}`,
};

const SABOTAGE: Record<SabotageKind, string> = {
  fire: 'WELL FIRE',
  tanker: 'TANKER SUNK',
  books: 'TAX AUDIT',
};

/**
 * Newspaper headline for a public event (world news, sabotage, fires), or
 * null for events that only make the company report.
 */
export function headline(event: GameEvent): string | null {
  switch (event.type) {
    case 'news': {
      const story = STORIES[event.kind](event);
      if (event.priceChange === undefined || event.priceChange === 0) return story;
      return `${story}. PRICE ${event.priceChange > 0 ? 'UP' : 'DOWN'} $${Math.abs(event.priceChange).toFixed(2)}`;
    }
    case 'sabotaged':
      return `${SABOTAGE[event.kind]} HITS ${event.company.toUpperCase()}${event.amount ? ` (${money(event.amount)})` : ''}. SABOTAGE?`;
    case 'plotFailed':
      return event.caught ? `${event.company.toUpperCase()} CAUGHT PLOTTING AGAINST ${event.target.toUpperCase()}!` : null;
    case 'fireOut':
      return `FIRE AT ${event.company.toUpperCase()} WELL BURNS OUT`;
    default:
      return null;
  }
}

export const SABOTAGE_NAMES = SABOTAGE;
