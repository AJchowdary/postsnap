import { getDb } from '../db';
import { logger } from '../utils/logger';

export const ANALYTICS_EVENT_NAMES = [
  'ONBOARDING_STARTED',
  'ONBOARDING_COMPLETED',
  'POST_GENERATED',
  'POST_PUBLISHED',
  'POST_REGENERATED',
  'POST_EDITED',
  'STUDIO_USED',
  'BRAND_BRAIN_ENRICHED',
  'QUALITY_RETRY_TRIGGERED',
  'GENERIC_DETECTED',
] as const;

export type EventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export interface AnalyticsEvent {
  name: EventName;
  accountId: string;
  postId?: string | null;
  properties?: Record<string, unknown>;
}

export function isValidEventName(s: string): s is EventName {
  return (ANALYTICS_EVENT_NAMES as readonly string[]).includes(s);
}

/** Persists an analytics row; never throws (logs on failure). */
export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  try {
    const db = await getDb();
    await db.insertOne('analytics_events', {
      eventName: event.name,
      accountId: event.accountId,
      postId: event.postId ?? null,
      properties: event.properties ?? {},
    });
  } catch (e) {
    logger.warn('trackEvent failed', {
      name: event.name,
      accountId: event.accountId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
