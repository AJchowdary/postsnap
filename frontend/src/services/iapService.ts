/**
 * In-app purchase flow: purchase or restore, then verify with backend. Never unlock without verify.
 * Requires react-native-iap (native build / dev client for real IAP).
 */
import { Platform } from 'react-native';
import {
  verifySubscriptionPurchase,
  restoreSubscriptionPurchase,
  getSubscriptionStatus,
} from './api';

const IOS_PRODUCT_ID =
  process.env.EXPO_PUBLIC_IOS_SUBSCRIPTION_PRODUCT_ID || 'com.postsnap.pro.monthly';
const ANDROID_PRODUCT_ID =
  process.env.EXPO_PUBLIC_ANDROID_SUBSCRIPTION_PRODUCT_ID || 'postsnap_pro_monthly';

export type IAPResult = { success: true } | { success: false; message: string };

/**
 * Request subscription purchase, then verify receipt/token with backend. Do not unlock without verify.
 */
export async function purchaseSubscription(
  onVerifyAndRefresh: () => Promise<void>
): Promise<IAPResult> {
  try {
    const { requestSubscription, getAvailablePurchases, finishTransaction } = await import(
      'react-native-iap'
    );
    const productId = Platform.OS === 'ios' ? IOS_PRODUCT_ID : ANDROID_PRODUCT_ID;
    const purchase = await requestSubscription({ sku: productId });
    if (!purchase) return { success: false, message: 'Purchase was cancelled' };

    const transactionId = purchase.transactionId ?? (purchase as any).transactionId;
    const receipt = (purchase as any).transactionReceipt ?? (purchase as any).receipt;
    const purchaseToken = (purchase as any).purchaseToken;

    const body: {
      platform: 'ios' | 'android';
      productId: string;
      receipt?: string;
      purchaseToken?: string;
      packageName?: string;
      transactionId?: string;
    } = {
      platform: Platform.OS as 'ios' | 'android',
      productId,
      transactionId: transactionId ?? undefined,
    };
    if (Platform.OS === 'ios' && receipt) body.receipt = typeof receipt === 'string' ? receipt : (receipt as any).transactionReceipt ?? JSON.stringify(receipt);
    if (Platform.OS === 'android' && purchaseToken) body.purchaseToken = purchaseToken;

    await verifySubscriptionPurchase(body);
    await onVerifyAndRefresh();
    try {
      await finishTransaction({ purchase, isConsumable: false });
    } catch (_) {}
    return { success: true };
  } catch (e: any) {
    if (e?.code === 'E_USER_CANCELLED' || e?.message?.includes('cancel')) {
      return { success: false, message: 'Purchase cancelled' };
    }
    if (e?.code === 'MODULE_NOT_FOUND' || e?.message?.includes('react-native-iap')) {
      return { success: false, message: 'In-app purchase requires a development or production build.' };
    }
    return {
      success: false,
      message: e?.message ?? 'Purchase failed. Try again or restore.',
    };
  }
}

/**
 * Restore purchases: get existing purchases, send to backend verify, refresh status.
 */
export async function restorePurchases(
  onVerifyAndRefresh: () => Promise<void>
): Promise<IAPResult> {
  try {
    const { getAvailablePurchases } = await import('react-native-iap');
    const purchases = await getAvailablePurchases();
    const productId = Platform.OS === 'ios' ? IOS_PRODUCT_ID : ANDROID_PRODUCT_ID;
    const sub = purchases?.find(
      (p: any) => p.productId === productId || p.productIds?.includes?.(productId)
    );
    if (!sub) {
      return { success: false, message: 'No previous purchase found for this account' };
    }

    const receipt = (sub as any).transactionReceipt ?? (sub as any).receipt;
    const purchaseToken = (sub as any).purchaseToken;
    const body: any = {
      platform: Platform.OS as 'ios' | 'android',
      productId: sub.productId ?? productId,
      transactionId: (sub as any).transactionId,
    };
    if (Platform.OS === 'ios' && receipt) body.receipt = typeof receipt === 'string' ? receipt : JSON.stringify(receipt);
    if (Platform.OS === 'android' && purchaseToken) body.purchaseToken = purchaseToken;

    await restoreSubscriptionPurchase(body);
    await onVerifyAndRefresh();
    return { success: true };
  } catch (e: any) {
    if (e?.code === 'MODULE_NOT_FOUND' || e?.message?.includes('react-native-iap')) {
      return { success: false, message: 'Restore requires a development or production build.' };
    }
    return {
      success: false,
      message: e?.message ?? 'Restore failed. Make sure you are signed in with the same account.',
    };
  }
}

/** Call after verify success: refresh subscription status from API and update store. */
export async function refreshSubscriptionFromBackend(
  setSubscription: (s: any) => void
): Promise<void> {
  const status = await getSubscriptionStatus();
  if (status) {
    setSubscription({
      status: status.status,
      daysLeft: status.days_left ?? status.daysLeft ?? 0,
      postsLeft: status.postsLeft ?? (status.isEligible ? 999 : 0),
      planName: status.planName ?? 'Quickpost Pro',
      price: status.price ?? '$12/month',
    });
  }
}
