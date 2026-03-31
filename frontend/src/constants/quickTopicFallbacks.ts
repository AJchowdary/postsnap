import type { BusinessType } from '../types';
import { POST_IDEAS } from '../types';
import type { SuggestionCard } from '../types';

/** Static fallback chips when suggest-ideas fails (4 items). */
export function getTopicSuggestions(type: BusinessType): SuggestionCard[] {
  const rows = POST_IDEAS[type] ?? POST_IDEAS.restaurant;
  const four = [...rows, rows[0]].slice(0, 4);
  return four.map((x, i) => ({
    id: `fallback-${type}-${i}`,
    emoji: x.emoji,
    contentAngle: 'Idea',
    headline: x.title,
    rationale: x.description,
    prompt: x.description,
  }));
}
