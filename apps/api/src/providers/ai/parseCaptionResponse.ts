import type { CaptionResult } from './IAIProvider';

/** Single caption can be long */
const MAX_CAPTION_LEN = 8000;
const MIN_IG_HASHTAGS = 8;
const MAX_IG_HASHTAGS = 15;
const MIN_FB_HASHTAGS = 3;
const MAX_FB_HASHTAGS = 8;

const PAD_IG = [
  '#smallbusiness',
  '#localbusiness',
  '#shoplocal',
  '#community',
  '#supportlocal',
  '#buylocal',
  '#local',
  '#smallbiz',
];

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

function extractHashtagsFromText(text: string): string[] {
  const found = [...text.matchAll(/#[\w\u00c0-\u024f]+/g)].map((m) => m[0]);
  return [...new Set(found)];
}

/**
 * New OpenAI format: { captions: [ { type: "hook"|"story"|"cta", text: "..." } ] }
 * We normalize this to ONE caption string for current app UX.
 */
function parseThreeOptionsFormat(parsed: Record<string, unknown>): CaptionResult | null {
  const captions = parsed.captions;
  if (!Array.isArray(captions)) return null;

  const byType: Record<string, string> = {};
  for (const item of captions) {
    if (item == null || typeof item !== 'object' || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const type = typeof o.type === 'string' ? o.type.toLowerCase().trim() : '';
    const text = typeof o.text === 'string' ? o.text.trim() : '';
    if (type && text) byType[type] = text;
  }

  const hook = byType.hook ?? '';
  const story = byType.story ?? '';
  const cta = byType.cta ?? '';
  if (!hook && !story && !cta) return null;

  // Prefer concise offer-forward copy first; fallback to CTA/story.
  const full = (hook || cta || story).slice(0, MAX_CAPTION_LEN);

  const allForTags = `${hook} ${story} ${cta}`;
  let tags = extractHashtagsFromText(allForTags);
  for (const t of PAD_IG) {
    if (tags.length >= MIN_IG_HASHTAGS) break;
    if (!tags.includes(t)) tags.push(t);
  }
  const igHashtags = tags.slice(0, MAX_IG_HASHTAGS);
  const fbPad = ['#local', '#community', '#shoplocal', '#supportlocal'];
  let fbTags = [...new Set(tags)];
  for (const t of fbPad) {
    if (fbTags.length >= MIN_FB_HASHTAGS) break;
    if (!fbTags.includes(t)) fbTags.push(t);
  }
  let i = 0;
  while (fbTags.length < MIN_FB_HASHTAGS && i < 10) {
    const extra = `${fbPad[i % fbPad.length]}`;
    if (!fbTags.includes(extra)) fbTags.push(extra);
    i += 1;
  }
  fbTags = fbTags.slice(0, MAX_FB_HASHTAGS);

  return {
    instagram: { caption: full, hashtags: igHashtags },
    facebook: { caption: full, hashtags: fbTags },
  };
}

/**
 * Legacy format: { instagram: { caption, hashtags }, facebook: { ... } }
 */
export function parseAndValidateCaptionResponse(parsed: unknown): CaptionResult | null {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const obj = parsed as Record<string, unknown>;

  if (Array.isArray(obj.captions)) {
    return parseThreeOptionsFormat(obj);
  }

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
