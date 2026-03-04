import { getDb } from '../db';
import { ConnectSocialInput } from '../schemas/account';
import { requireAccountForUser } from './accountService';

interface SocialRecord {
  id: string;
  accountId: string;
  platform: string;
  handleOrPage: string;
  status: string;
  connectedAt?: string;
}

export async function getSocialAccounts(ownerUserId: string) {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const rows = await db.findMany<SocialRecord>('social_connections', { account_id: accountId });
  return {
    instagram: rows.find((r) => r.platform === 'instagram')
      ? { platform: 'instagram', handle: rows.find((r) => r.platform === 'instagram')!.handleOrPage, connected: true }
      : null,
    facebook: rows.find((r) => r.platform === 'facebook')
      ? { platform: 'facebook', handle: rows.find((r) => r.platform === 'facebook')!.handleOrPage, connected: true }
      : null,
  };
}

export async function connectSocial(ownerUserId: string, input: ConnectSocialInput) {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  await db.upsertOne(
    'social_connections',
    { account_id: accountId, platform: input.platform },
    {
      account_id: accountId,
      platform: input.platform,
      handle_or_page: input.handle,
      status: 'active',
      created_at: new Date().toISOString(),
    }
  );
  return { success: true };
}

export async function disconnectSocial(ownerUserId: string, platform: string) {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const conn = await db.findOne<SocialRecord>('social_connections', {
    account_id: accountId,
    platform,
  });
  if (conn) await db.deleteOne('social_connections', conn.id);
  return { success: true };
}
