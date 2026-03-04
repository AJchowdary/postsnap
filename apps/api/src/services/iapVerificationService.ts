/**
 * IAP server-side verification (Step 6). Never trust client-reported status.
 * Do not log receipts or purchase tokens.
 */
import { config } from '../config';
import { logger } from '../utils/logger';

const APPLE_PRODUCTION = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX = 'https://sandbox.itunes.apple.com/verifyReceipt';

export interface VerifyResult {
  status: 'active_subscription' | 'trial_active' | 'trial_expired' | 'canceled' | 'past_due';
  currentPeriodEnd: string | null;
  isEligible: boolean;
  provider: 'apple' | 'google' | null;
  transactionId?: string | null;
}

export interface VerifyInput {
  platform: 'ios' | 'android';
  productId: string;
  receipt?: string;
  purchaseToken?: string;
  packageName?: string;
  transactionId?: string;
}

function isAllowedProduct(platform: 'ios' | 'android', productId: string): boolean {
  if (platform === 'ios') {
    if (config.appleProductIds.length === 0) return true;
    return config.appleProductIds.includes(productId);
  }
  if (config.googleProductIds.length === 0) return true;
  return config.googleProductIds.includes(productId);
}

/**
 * Apple verifyReceipt (legacy). Returns isActive, currentPeriodEnd, transactionId.
 * Tries production first; on 21007 uses sandbox.
 */
async function verifyAppleReceipt(receiptData: string): Promise<{
  isActive: boolean;
  currentPeriodEnd: string | null;
  transactionId: string | null;
}> {
  if (!config.appleSharedSecret) {
    logger.warn('Apple IAP: APPLE_SHARED_SECRET not set');
    throw new Error('Apple verification not configured');
  }
  const body = {
    'receipt-data': receiptData,
    password: config.appleSharedSecret,
    'exclude-old-transactions': true,
  };
  let lastStatus: number | null = null;
  for (const url of [APPLE_PRODUCTION, APPLE_SANDBOX]) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      status: number;
      latest_receipt_info?: Array<Record<string, unknown> & { expires_date_ms?: string; expires_date?: string; transaction_id?: string; cancellation_date_ms?: string }>;
      receipt?: { in_app?: Array<{ expires_date_ms?: string; transaction_id?: string }> };
    };
    lastStatus = data.status;
    if (data.status === 0) {
      const list = data.latest_receipt_info ?? data.receipt?.in_app ?? [];
      if (list.length === 0) {
        return { isActive: false, currentPeriodEnd: null, transactionId: null };
      }
      const sorted = [...list].sort((a, b) => {
        const aMs = (a as any).expires_date_ms ? parseInt((a as any).expires_date_ms, 10) : 0;
        const bMs = (b as any).expires_date_ms ? parseInt((b as any).expires_date_ms, 10) : 0;
        return bMs - aMs;
      });
      const latest = sorted[0] as Record<string, unknown> & { expires_date_ms?: string; expires_date?: string; transaction_id?: string; cancellation_date_ms?: string };
      const expiresMs = latest.expires_date_ms
        ? parseInt(latest.expires_date_ms, 10)
        : latest.expires_date
          ? new Date(latest.expires_date).getTime()
          : 0;
      const now = Date.now();
      const isActive = expiresMs > now && !latest.cancellation_date_ms;
      const currentPeriodEnd =
        expiresMs > 0 ? new Date(expiresMs).toISOString() : null;
      return {
        isActive,
        currentPeriodEnd,
        transactionId: latest.transaction_id ?? null,
      };
    }
    if (data.status === 21007) continue;
    break;
  }
  throw new Error(`Apple verifyReceipt failed (status ${lastStatus})`);
}

/**
 * Google Play: optional. Requires googleapis + service account.
 * Stub: if not configured, throw so caller can return 503.
 */
async function verifyGooglePurchase(
  _purchaseToken: string,
  _productId: string,
  packageName: string
): Promise<{
  isActive: boolean;
  currentPeriodEnd: string | null;
  transactionId: string | null;
}> {
  const pkg = packageName || config.googlePackageName;
  if (!pkg) {
    throw new Error('Google verification: package name required');
  }
  if (!config.googleServiceAccountKeyPath) {
    logger.warn('Google IAP: GOOGLE_SERVICE_ACCOUNT_KEY_PATH not set');
    throw new Error('Google verification not configured');
  }
  try {
    // Optional: npm install googleapis for Android IAP verification.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { google } = require('googleapis') as any;
    const auth = new google.auth.GoogleAuth({
      keyFile: config.googleServiceAccountKeyPath,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    const androidPublisher = google.androidpublisher({ version: 'v3', auth });
    const sub = await androidPublisher.purchases.subscriptions.get({
      packageName: pkg,
      subscriptionId: _productId,
      token: _purchaseToken,
    });
    const data = sub.data as { paymentState?: number; expiryTimeMillis?: string; orderId?: string };
    const paymentState = data.paymentState ?? 0;
    const expiryTimeMillis = data.expiryTimeMillis
      ? parseInt(String(data.expiryTimeMillis), 10)
      : 0;
    const now = Date.now();
    const isActive = paymentState === 1 && expiryTimeMillis > now;
    const currentPeriodEnd =
      expiryTimeMillis > 0 ? new Date(expiryTimeMillis).toISOString() : null;
    return {
      isActive,
      currentPeriodEnd,
      transactionId: data.orderId ?? null,
    };
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err?.code === 'MODULE_NOT_FOUND' || err?.message?.includes('googleapis')) {
      throw new Error('Google verification not configured (install googleapis)');
    }
    throw e;
  }
}

/**
 * Verify receipt/token and return normalized result. Does not update DB.
 */
export async function verifyPurchase(input: VerifyInput): Promise<VerifyResult> {
  if (!input.receipt && !input.purchaseToken) {
    throw new Error('receipt or purchaseToken required');
  }
  if (!isAllowedProduct(input.platform, input.productId)) {
    throw new Error('Product ID not allowed');
  }

  if (input.platform === 'ios') {
    if (!input.receipt) throw new Error('receipt required for iOS');
    const apple = await verifyAppleReceipt(input.receipt);
    return {
      status: apple.isActive ? 'active_subscription' : 'canceled',
      currentPeriodEnd: apple.currentPeriodEnd,
      isEligible: apple.isActive,
      provider: 'apple',
      transactionId: apple.transactionId,
    };
  }

  const google = await verifyGooglePurchase(
    input.purchaseToken!,
    input.productId,
    input.packageName || config.googlePackageName
  );
  return {
    status: google.isActive ? 'active_subscription' : 'canceled',
    currentPeriodEnd: google.currentPeriodEnd,
    isEligible: google.isActive,
    provider: 'google',
    transactionId: google.transactionId,
  };
}
