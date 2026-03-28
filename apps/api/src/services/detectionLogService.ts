import { getDb } from '../db';
import { logger } from '../utils/logger';
import type { DetectionResult } from '../providers/ai/genericDetector';
import { trackEvent } from './analyticsEvents';

export type DetectionLogOutcome = 'pass' | 'fail_retry' | 'deliver_after_fail';

export async function logCaptionDetection(entry: {
  accountId?: string | null;
  postId?: string | null;
  outcome: DetectionLogOutcome;
  result: DetectionResult;
  softFlags: string[];
  source?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    await db.insertOne('detection_logs', {
      accountId: entry.accountId ?? null,
      postId: entry.postId ?? null,
      outcome: entry.outcome,
      isGeneric: entry.result.isGeneric,
      score: entry.result.score,
      reasons: entry.result.reasons,
      softFlags: entry.softFlags,
      source: entry.source ?? 'caption',
    });
    if (entry.accountId && entry.result.isGeneric) {
      void trackEvent({
        name: 'GENERIC_DETECTED',
        accountId: entry.accountId,
        postId: entry.postId ?? null,
        properties: {
          outcome: entry.outcome,
          score: entry.result.score,
          source: entry.source ?? 'caption',
        },
      });
    }
  } catch (e) {
    logger.warn('detection_logs insert failed', {
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
