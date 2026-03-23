/**
 * Retry classification for OpenAI API calls: rate limit vs transient vs permanent.
 * Used to decide whether to retry and with what backoff.
 */

export type RetryKind = 'rate_limit' | 'transient' | 'permanent';

const RATE_LIMIT_CODES = new Set([
  'rate_limit_exceeded',
  'rate_limit_exceeded_for_tier',
  'requests_per_min_limit_exceeded',
  'tokens_per_min_limit_exceeded',
]);

const TRANSIENT_CODES = new Set([
  'internal_server_error',
  'service_unavailable',
  'overloaded',
  'engine_overloaded',
]);

const PERMANENT_CODES = new Set([
  'invalid_request_error',
  'authentication_error',
  'permission_denied',
  'content_policy_violation',
  'invalid_api_key',
  'billing_hard_limit_reached',
]);

const TRANSIENT_NETWORK = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPROTO',
  'ENETUNREACH',
]);

/**
 * Classify an error for retry behavior.
 * - rate_limit: 429 or rate_limit* code → retry with backoff.
 * - transient: 5xx, timeout, or network errors → retry with backoff.
 * - permanent: other 4xx, content policy, invalid request → do not retry.
 */
export function classifyRetry(error: unknown): RetryKind {
  const err = error as any;
  const status = err?.status ?? err?.response?.status ?? err?.statusCode;
  const code = (err?.code ?? err?.error?.code ?? err?.code ?? '').toLowerCase();
  const message = (err?.message ?? err?.error?.message ?? '').toLowerCase();

  if (status === 429 || RATE_LIMIT_CODES.has(code) || message.includes('rate limit')) {
    return 'rate_limit';
  }

  if (status != null && status >= 500) return 'transient';
  if (TRANSIENT_CODES.has(code)) return 'transient';
  if (TRANSIENT_NETWORK.has(code)) return 'transient';
  if (message.includes('timeout') || message.includes('econnreset') || message.includes('etimedout')) {
    return 'transient';
  }

  if (status != null && status >= 400 && status < 500) return 'permanent';
  if (PERMANENT_CODES.has(code)) return 'permanent';
  if (message.includes('content policy') || message.includes('invalid_request')) return 'permanent';

  return 'transient';
}

/** Backoff delay in ms: rate_limit uses longer delay. */
export function retryDelayMs(kind: RetryKind, attempt: number): number {
  if (kind === 'rate_limit') {
    const base = 60000;
    return Math.min(base * Math.pow(2, attempt), 300000);
  }
  const base = 2000;
  return Math.min(base * Math.pow(2, attempt), 30000);
}
