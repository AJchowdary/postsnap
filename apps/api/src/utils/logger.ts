import winston from 'winston';
import { config } from '../config';

/** Keys (and keys containing these substrings) redacted recursively. Never log tokens or secrets. */
const REDACT_KEYS = [
  'authorization', 'token', 'access_token', 'refresh_token', 'api_key', 'service_role',
  'key', 'secret', 'password', 'receipt',
];
function redact(obj: Record<string, any>): Record<string, any> {
  if (obj === null || typeof obj !== 'object') return obj;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lower = k.toLowerCase();
    if (REDACT_KEYS.some((r) => lower.includes(r))) {
      out[k] = '[REDACTED]';
      continue;
    }
    out[k] = typeof v === 'object' && v !== null && !Array.isArray(v)
      ? redact(v as Record<string, any>)
      : Array.isArray(v)
        ? v.map((item) => (item !== null && typeof item === 'object' ? redact(item as Record<string, any>) : item))
        : v;
  }
  return out;
}
export function redactForLog(payload: unknown): Record<string, unknown> {
  if (payload === null || typeof payload !== 'object') return { value: String(payload) };
  return redact(payload as Record<string, any>) as Record<string, unknown>;
}

export const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const safe = redact(meta);
      const extra = Object.keys(safe).length ? ' ' + JSON.stringify(safe) : '';
      return `${timestamp} [${level}] ${message}${extra}`;
    })
  ),
  transports: [new winston.transports.Console()],
});
