/**
 * Schedule Processor
 * Polls every 30 seconds for posts with status='scheduled' whose scheduled_at <= now,
 * then publishes via the posting provider. v1: disabled by default (no scheduled_at column).
 */
import { getDb } from '../db';
import { config } from '../config';
import { MetaProvider } from '../providers/posting/metaProvider';
import { MockSubscriptionProvider } from '../providers/subscription/mockSubscriptionProvider';
import { logger } from '../utils/logger';

const posting = new MetaProvider();
const subscription = new MockSubscriptionProvider();

export async function processScheduledPosts() {
  if (!config.schedulingEnabled) return;
  const db = await getDb();
  const now = new Date().toISOString();

  const allScheduled = await db.findMany<any>('posts', { status: 'scheduled' });
  const duePosts = allScheduled.filter(
    (p: any) => p.scheduledAt && p.scheduledAt <= now
  );

  if (duePosts.length === 0) return;
  logger.info(`Scheduler: found ${duePosts.length} post(s) due for publishing`);

  for (const post of duePosts) {
    try {
      const account = await db.findOne<{ owner_user_id: string }>('accounts', {
        id: post.accountId,
      });
      const ownerUserId = account?.owner_user_id;
      if (!ownerUserId) continue;
      const sub = await subscription.getStatus(ownerUserId);
      if (!sub.isEligible) {
        await db.updateOne('posts', post.id, {
          status: 'failed',
          updated_at: now,
        });
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
        updated_at: now,
      });
      logger.info(`Scheduled post ${post.id} → ${status}`);
    } catch (err: any) {
      logger.error(`Scheduler failed for post ${post.id}`, { error: err.message });
      await db.updateOne('posts', post.id, {
        status: 'failed',
        updated_at: new Date().toISOString(),
      });
    }
  }
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
