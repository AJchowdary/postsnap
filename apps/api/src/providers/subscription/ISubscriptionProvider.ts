export type SubscriptionStatusApi =
  | 'trial_active'
  | 'active_subscription'
  | 'trial_expired'
  | 'subscription_inactive';

export interface SubscriptionInfo {
  status: 'trial' | 'subscribed' | 'expired';
  daysLeft: number;
  postsLeft: number;
  planName: string;
  price: string;
  isEligible: boolean;
  trialEndAt?: string;
  currentPeriodEnd?: string | null;
}

export interface ISubscriptionProvider {
  getStatus(accountIdOrOwnerUserId: string): Promise<SubscriptionInfo>;
  upgrade(accountIdOrOwnerUserId: string): Promise<{ success: boolean }>;
  restore(accountIdOrOwnerUserId: string): Promise<{ success: boolean }>;
}
