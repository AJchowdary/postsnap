/**
 * Normalize user input to an http(s) URL string, or null if invalid.
 * Accepts bare hostnames (prepends https://). Rejects non-http(s) schemes.
 */
export function parseHttpOrHttpsWebsiteUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^(javascript|data|vbscript):/i.test(t)) return null;
  // Reject ftp:, mailto:, file:, etc. (only http/https allowed when a scheme is present).
  if (/^[a-z][a-z0-9+.-]*:/i.test(t) && !/^https?:\/\//i.test(t)) return null;
  try {
    const u = new URL(t.startsWith('http://') || t.startsWith('https://') ? t : `https://${t}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}
