import { getDb } from '../db';
import { config } from '../config';
import { logger } from '../utils/logger';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export type NotificationType = 'publish' | 'generate' | 'scheduled' | 'info';

interface AccountPushRow {
  id: string;
  pushToken?: string | null;
  pushNotificationsEnabled?: boolean | null;
}

/**
 * Persists an in-app notification and optionally sends an Expo push notification.
 * If push_notifications_enabled is false, push is skipped but the row is still inserted.
 */
export async function sendPushNotification(
  accountId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  options?: { type?: NotificationType; postId?: string | null }
): Promise<void> {
  const db = await getDb();
  const type = options?.type ?? 'info';
  const postId = options?.postId ?? null;

  try {
    await db.insertOne('notifications', {
      accountId,
      title,
      body,
      type,
      read: false,
      postId,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    logger.warn('notifications insert failed', {
      accountId,
      message: e instanceof Error ? e.message : String(e),
    });
    return;
  }

  const account = await db.findOne<AccountPushRow>('accounts', { id: accountId });
  if (!account) return;
  if (account.pushNotificationsEnabled === false) return;
  const token = account.pushToken?.trim();
  if (!token) return;

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (config.expoAccessToken) {
      headers.Authorization = `Bearer ${config.expoAccessToken}`;
    }

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to: token,
        title,
        body,
        data: data ?? {},
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: { status?: string }; errors?: unknown };
    if (!res.ok) {
      logger.warn('Expo push send non-OK', { status: res.status, body: json });
    }
  } catch (e) {
    logger.warn('Expo push send failed', { message: e instanceof Error ? e.message : String(e) });
  }
}

export async function notifyGenerationComplete(accountId: string, postId: string): Promise<void> {
  await sendPushNotification(
    accountId,
    'Your post is ready',
    'Tap to review and publish',
    { postId },
    { type: 'generate', postId }
  );
}

export async function notifyPostPublished(
  accountId: string,
  postId: string,
  platforms: string[]
): Promise<void> {
  const label = platforms.length === 1 ? platforms[0] : platforms.join(', ');
  await sendPushNotification(
    accountId,
    'Post published!',
    `Your post is live on ${label}`,
    { postId, platforms },
    { type: 'publish', postId }
  );
}

export async function notifyScheduledPublished(accountId: string, postId: string): Promise<void> {
  await sendPushNotification(
    accountId,
    'Scheduled post published',
    'Your scheduled post is now live',
    { postId },
    { type: 'scheduled', postId }
  );
}
