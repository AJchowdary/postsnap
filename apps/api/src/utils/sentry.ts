/**
 * Sentry init for API and worker. No tokens or receipts are sent.
 */
import * as Sentry from '@sentry/node';

const SENSITIVE_KEYS = [
  'token',
  'access_token',
  'refresh_token',
  'receipt',
  'password',
  'secret',
  'authorization',
  'cookie',
  'key',
  'credential',
];

function redactObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactObject);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lower.includes(s))) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redactObject(v);
    }
  }
  return out;
}

export function initSentry(options: { dsn?: string; environment: string; service?: string }): void {
  const dsn = options.dsn || process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: options.environment,
    serverName: options.service,
    beforeSend(event) {
      if (event.extra) event.extra = redactObject(event.extra) as typeof event.extra;
      if (event.contexts) event.contexts = redactObject(event.contexts) as typeof event.contexts;
      if (event.request?.headers) event.request.headers = redactObject(event.request.headers) as typeof event.request.headers;
      return event;
    },
  });
}

export function captureException(err: unknown): void {
  Sentry.captureException(err);
}
