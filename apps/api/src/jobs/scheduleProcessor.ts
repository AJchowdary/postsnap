/**
 * Schedule Processor
 * Polls every 30 seconds for posts with status='scheduled' whose scheduled_at <= now,
 * then publishes via the posting provider. Requires `scheduled_at` on posts (migration 017).
 */
import { getDb } from '../db';
import { config } from '../config';
import { MetaProvider } from '../providers/posting/metaProvider';
import { MockSubscriptionProvider } from '../providers/subscription/mockSubscriptionProvider';
import { logger } from '../utils/logger';
import { notifyScheduledPublished } from '../services/notificationService';

const posting = new MetaProvider();
const subscription = new MockSubscriptionProvider();

export type ProcessScheduledPostsResult = {
  /** Rows with status=scheduled (before filtering by time). */
  scheduledCount: number;
  /** Posts whose scheduled_at is due. */
  dueCount: number;
  /** Posts attempted (publish loop entered). */
  attempted: number;
  published: number;
  failed: number;
};

/**
 * Picks due scheduled posts and publishes via MetaProvider.
 * @param opts.ignoreSchedulingEnabled — admin one-shot: run even when SCHEDULING_ENABLED is false.
 */
export async function processScheduledPosts(opts?: {
  ignoreSchedulingEnabled?: boolean;
}): Promise<ProcessScheduledPostsResult> {
  const empty: ProcessScheduledPostsResult = {
    scheduledCount: 0,
    dueCount: 0,
    attempted: 0,
    published: 0,
    failed: 0,
  };

  if (!opts?.ignoreSchedulingEnabled && !config.schedulingEnabled) return empty;

  const db = await getDb();
  const now = new Date().toISOString();
  const nowMs = Date.now();

  const allScheduled = await db.findMany<any>('posts', { status: 'scheduled' });
  const duePosts = allScheduled.filter((p: any) => {
    if (!p.scheduledAt) return false;
    const t = Date.parse(p.scheduledAt);
    if (Number.isNaN(t)) return false;
    return t <= nowMs;
  });

  const result: ProcessScheduledPostsResult = {
    scheduledCount: allScheduled.length,
    dueCount: duePosts.length,
    attempted: 0,
    published: 0,
    failed: 0,
  };

  if (duePosts.length === 0) return result;
  logger.info(`Scheduler: found ${duePosts.length} post(s) due for publishing`);

  for (const post of duePosts) {
    result.attempted += 1;
    try {
      const account = await db.findOne<{ owner_user_id: string }>('accounts', {
        id: post.accountId,
      });
      const ownerUserId = account?.owner_user_id;
      if (!ownerUserId) {
        result.failed += 1;
        continue;
      }
      const sub = await subscription.getStatus(ownerUserId);
      if (!sub.isEligible) {
        await db.updateOne('posts', post.id, {
          status: 'failed',
          updated_at: now,
        });
        result.failed += 1;
        logger.warn(`Scheduled post ${post.id} skipped — subscription not eligible`);
        continue;
      }

      const caption =
        post.captionJson?.instagram?.caption ??
        post.captionJson?.facebook?.caption ??
        '';
      const posted: string[] = [];
      const failed: string[] = [];

      for (const platform of (post.publishTargets || post.platforms || []) as ('instagram' | 'facebook')[]) {
        const result = await posting.publishPost({
          caption,
          imageUrl: post.processedImagePath ?? post.originalImagePath ?? undefined,
          platform,
          accountHandle: `@${platform}_stub`,
        });
        if (result.success) posted.push(platform);
        else failed.push(platform);
      }

      const status = posted.length > 0 ? 'published' : 'failed';
      await db.updateOne('posts', post.id, {
        status,
        published_at: posted.length > 0 ? now : null,
        publish_targets: posted,
        scheduled_at: null,
        updated_at: now,
      });
      logger.info(`Scheduled post ${post.id} → ${status}`);
      if (posted.length > 0) {
        result.published += 1;
        void notifyScheduledPublished(post.accountId, post.id);
      } else {
        result.failed += 1;
      }
    } catch (err: any) {
      logger.error(`Scheduler failed for post ${post.id}`, { error: err.message });
      result.failed += 1;
      await db.updateOne('posts', post.id, {
        status: 'failed',
        updated_at: new Date().toISOString(),
      });
    }
  }

  return result;
}

export function startScheduler() {
  if (!config.runSchedulerInProcess || !config.schedulingEnabled) {
    logger.info('Schedule processor disabled (RUN_SCHEDULER_IN_PROCESS or SCHEDULING_ENABLED not set).');
    return;
  }
  logger.info('Schedule processor started (30s interval)');
  processScheduledPosts().catch((err) =>
    logger.error('Scheduler initial run error', { error: err.message })
  );
  setInterval(() => {
    processScheduledPosts().catch((err) =>
      logger.error('Scheduler error', { error: err.message })
    );
  }, 30_000);
}
