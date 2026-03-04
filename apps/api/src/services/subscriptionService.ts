import { MockSubscriptionProvider } from '../providers/subscription/mockSubscriptionProvider';
import { requireAccountForUser } from './accountService';
import { getDb } from '../db';
import { verifyPurchase, VerifyResult, VerifyInput } from './iapVerificationService';
import { logger } from '../utils/logger';
import type { VerifySubscriptionBody } from '../schemas/subscription';

const provider = new MockSubscriptionProvider();

export async function getSubscriptionStatus(userId: string) {
  const info = await provider.getStatus(userId);
  const accountId = await requireAccountForUser(userId);
  const db = await getDb();
  const sub = await db.findOne<{ trialEndAt?: string | null; currentPeriodEnd?: string | null }>(
    'subscriptions',
    { account_id: accountId }
  );
  const trialEndAt = sub?.trialEndAt ?? info.trialEndAt;
  const now = new Date();
  const end = trialEndAt ? new Date(trialEndAt) : null;
  const daysLeft = end ? Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : 0;
  return {
    status: info.status,
    isEligible: info.isEligible,
    trial_end_at: trialEndAt ?? null,
    days_left: daysLeft,
    current_period_end: info.currentPeriodEnd ?? sub?.currentPeriodEnd ?? null,
    daysLeft: info.daysLeft,
    postsLeft: info.postsLeft,
    planName: info.planName,
    price: info.price,
  };
}

export async function upgradeSubscription(userId: string) {
  return provider.upgrade(userId);
}

/** Restore: stub delegates to provider; real restore uses verifySubscription with client-supplied receipt/token. */
export async function restoreSubscription(userId: string) {
  return provider.restore(userId);
}

/**
 * Verify IAP receipt/token server-side and update subscriptions table. Never trust client status.
 */
export async function verifySubscription(
  ownerUserId: string,
  body: VerifySubscriptionBody
): Promise<VerifyResult> {
  const input: VerifyInput = {
    platform: body.platform,
    productId: body.productId,
    receipt: body.receipt,
    purchaseToken: body.purchaseToken,
    packageName: body.packageName,
    transactionId: body.transactionId,
  };
  const result = await verifyPurchase(input);
  const accountId = await requireAccountForUser(ownerUserId);
  const db = await getDb();
  const now = new Date().toISOString();
  const status =
    result.status === 'active_subscription' ? 'active_subscription' : result.status;
  await db.upsertOne(
    'subscriptions',
    { account_id: accountId },
    {
      account_id: accountId,
      status,
      current_period_end: result.currentPeriodEnd ?? null,
      provider: result.provider ?? null,
      provider_transaction_id: result.transactionId ?? null,
      updated_at: now,
    }
  );
  logger.info('IAP verify updated subscription', {
    accountId,
    status: result.status,
    provider: result.provider,
  });
  return result;
}
