import type { CaptionResult } from './IAIProvider';

const MAX_CAPTION_LEN = 500;
const MIN_IG_HASHTAGS = 8;
const MAX_IG_HASHTAGS = 15;
const MIN_FB_HASHTAGS = 3;
const MAX_FB_HASHTAGS = 8;

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.length > 0;
}

function normalizeString(x: unknown, maxLen: number): string {
  if (x == null) return '';
  const s = String(x).trim();
  return s.slice(0, maxLen);
}

function normalizeHashtags(x: unknown, maxCount: number): string[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
    .map((h) => (h.startsWith('#') ? h : `#${h}`).slice(0, 100))
    .slice(0, maxCount);
}

/**
 * Validates and normalizes a parsed object into a strict CaptionResult.
 * Returns null if the shape is invalid (missing instagram/facebook or invalid types).
 */
export function parseAndValidateCaptionResponse(parsed: unknown): CaptionResult | null {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const obj = parsed as Record<string, unknown>;

  const instagramRaw = obj.instagram;
  const facebookRaw = obj.facebook;
  if (instagramRaw == null || facebookRaw == null) {
    return null;
  }
  if (typeof instagramRaw !== 'object' || instagramRaw === null || Array.isArray(instagramRaw)) {
    return null;
  }
  if (typeof facebookRaw !== 'object' || facebookRaw === null || Array.isArray(facebookRaw)) {
    return null;
  }

  const ig = instagramRaw as Record<string, unknown>;
  const fb = facebookRaw as Record<string, unknown>;

  const igHashtags = normalizeHashtags(ig.hashtags, MAX_IG_HASHTAGS);
  const fbHashtags = normalizeHashtags(fb.hashtags, MAX_FB_HASHTAGS);
  if (igHashtags.length < MIN_IG_HASHTAGS || igHashtags.length > MAX_IG_HASHTAGS) return null;
  if (fbHashtags.length < MIN_FB_HASHTAGS || fbHashtags.length > MAX_FB_HASHTAGS) return null;

  const instagram = {
    caption: isNonEmptyString(ig.caption) ? ig.caption.slice(0, MAX_CAPTION_LEN) : normalizeString(ig.caption, MAX_CAPTION_LEN),
    hashtags: igHashtags,
  };
  const facebook = {
    caption: isNonEmptyString(fb.caption) ? fb.caption.slice(0, MAX_CAPTION_LEN) : normalizeString(fb.caption, MAX_CAPTION_LEN),
    hashtags: fbHashtags,
  };

  return { instagram, facebook };
}

/**
 * Parse raw string as JSON and return validated CaptionResult or null.
 * Handles malformed JSON and invalid shape.
 */
export function parseCaptionJson(raw: string): CaptionResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return parseAndValidateCaptionResponse(parsed);
}
