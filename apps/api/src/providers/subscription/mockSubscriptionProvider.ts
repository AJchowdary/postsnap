/**
 * Subscription provider – time-based trial (14 days). Publish gated by entitlement.
 * upgrade/restore stub: set active_subscription.
 */
import {
  ISubscriptionProvider,
  SubscriptionInfo,
} from './ISubscriptionProvider';
import { getDb } from '../../db';
import { PaymentRequiredError } from '../../utils/errors';

interface SubRecord {
  accountId: string;
  status: string;
  trialEndAt?: string | null;
  trialPostsUsed?: number;
  updatedAt: string;
  currentPeriodEnd?: string | null;
  provider?: string | null;
}

export class MockSubscriptionProvider implements ISubscriptionProvider {
  private async getAccountId(ownerUserId: string): Promise<string> {
    const db = await getDb();
    const account = await db.findOne<{ id: string }>('accounts', {
      owner_user_id: ownerUserId,
    });
    if (!account) throw new Error('Account not found');
    return account.id;
  }

  async getStatus(ownerUserId: string): Promise<SubscriptionInfo> {
    const db = await getDb();
    const accountId = await this.getAccountId(ownerUserId);
    const sub = await db.findOne<SubRecord>('subscriptions', {
      account_id: accountId,
    });

    const now = new Date();
    if (sub?.status === 'active_subscription') {
      return {
        status: 'subscribed',
        daysLeft: 0,
        postsLeft: 999,
        planName: 'PostSnap Pro',
        price: '$12/month',
        isEligible: true,
        currentPeriodEnd: sub.currentPeriodEnd ?? null,
      };
    }

    if (sub?.status === 'trial_expired' || sub?.status === 'subscription_inactive') {
      return {
        status: 'expired',
        daysLeft: 0,
        postsLeft: 0,
        planName: 'PostSnap Pro',
        price: '$12/month',
        isEligible: false,
        trialEndAt: sub?.trialEndAt ?? undefined,
        currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      };
    }

    const trialEndAt = sub?.trialEndAt ? new Date(sub.trialEndAt) : null;
    const daysLeft = trialEndAt
      ? Math.max(0, Math.ceil((trialEndAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
      : 14;
    const isEligible = trialEndAt ? now <= trialEndAt : false;

    return {
      status: isEligible ? 'trial' : 'expired',
      daysLeft,
      postsLeft: isEligible ? 999 : 0,
      planName: 'PostSnap Pro',
      price: '$12/month',
      isEligible,
      trialEndAt: sub?.trialEndAt ?? undefined,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    };
  }

  async upgrade(ownerUserId: string): Promise<{ success: boolean }> {
    const db = await getDb();
    const accountId = await this.getAccountId(ownerUserId);
    await db.upsertOne(
      'subscriptions',
      { account_id: accountId },
      {
        account_id: accountId,
        status: 'active_subscription',
        updated_at: new Date().toISOString(),
      }
    );
    return { success: true };
  }

  async restore(ownerUserId: string): Promise<{ success: boolean }> {
    return this.upgrade(ownerUserId);
  }
}

export function checkPublishEligible(
  subscriptionInfo: SubscriptionInfo,
  trialEndAt?: string | null
): void {
  if (subscriptionInfo.isEligible) return;
  const now = new Date();
  const end = trialEndAt ? new Date(trialEndAt) : null;
  const daysLeft = end ? Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : 0;
  throw new PaymentRequiredError('Subscription required to publish', {
    upgrade_required: true,
    reason: subscriptionInfo.status === 'expired' ? 'trial_ended' : 'subscription_inactive',
    status: 'trial_expired',
    trial_end_at: trialEndAt ?? undefined,
    days_left: daysLeft,
  });
}
