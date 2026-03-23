/** Keys (and keys containing these substrings) redacted recursively. Never log tokens or secrets. */
const REDACT_KEYS = [
  'authorization', 'token', 'access_token', 'refresh_token', 'api_key', 'service_role',
  'key', 'secret', 'password', 'receipt',
];

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj === null || typeof obj !== 'object') return obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lower = k.toLowerCase();
    if (REDACT_KEYS.some((r) => lower.includes(r))) {
      out[k] = '[REDACTED]';
      continue;
    }
    out[k] =
      typeof v === 'object' && v !== null && !Array.isArray(v)
        ? redact(v as Record<string, unknown>)
        : Array.isArray(v)
          ? v.map((item) => (item !== null && typeof item === 'object' ? redact(item as Record<string, unknown>) : item))
          : v;
  }
  return out;
}

export function redactForLog(payload: unknown): Record<string, unknown> {
  if (payload === null || typeof payload !== 'object') return { value: String(payload) };
  return redact(payload as Record<string, unknown>);
}
