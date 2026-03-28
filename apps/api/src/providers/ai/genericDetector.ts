/**
 * Generic marketing copy detector — hard fails trigger silent caption retry upstream.
 */

export type GenericDetectionContext = {
  city: string;
  services: string[];
  heroProduct?: string;
  brandName: string;
  /** 1–12 */
  currentMonth: number;
  /** When true, superlative phrases may appear (e.g. confirmed on website). Default: not allowed. */
  allowsSuperlatives?: boolean;
};

export type DetectionResult = {
  isGeneric: boolean;
  reasons: string[];
  score: number;
};

const OPENER_PREFIXES: readonly string[] = [
  'are you looking for',
  "we're excited to",
  'we are excited to',
  'transform your',
  'elevate your',
  "in today's fast-paced world",
  "don't miss out on",
  'looking for the best',
  'discover the difference',
  'your journey starts here',
];

const GENERIC_ONLY_HASHTAGS = new Set([
  '#smallbusiness',
  '#localbusiness',
  '#shoplocal',
  '#supportlocal',
]);

/** First few user-written lines, skipping CAPTION N — headers from the studio format. */
function contentLinesForOpenerCheck(caption: string): string[] {
  const raw = caption.trim().split(/\n/).map((l) => l.trim()).filter(Boolean);
  const skipHeader = (line: string) =>
    /^caption\s+\d+/i.test(line) || /^CAPTION\s+\d+/i.test(line);
  const lines = raw.filter((l) => !skipHeader(l));
  const usable = lines.length ? lines : raw;
  return usable.slice(0, 4);
}

function hasBannedOpenerStart(caption: string): boolean {
  const lines = contentLinesForOpenerCheck(caption);
  for (const line of lines) {
    const open = line.slice(0, 220).toLowerCase();
    for (const p of OPENER_PREFIXES) {
      if (open.startsWith(p)) return true;
    }
    if (/^at\s+[^,\n]{1,100},\s*we believe\b/i.test(open)) return true;
    const head = line.slice(0, 180).toLowerCase();
    if (/\btake your .{0,48}?\s+to the next level\b/.test(head)) return true;
  }
  return false;
}

function collectCityTokens(city: string): string[] {
  const t = city.trim().toLowerCase();
  if (!t) return [];
  const parts = t.split(/[,/]/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (p.length >= 2) out.push(p);
  }
  if (out.length === 0 && t.length >= 2) out.push(t);
  return out;
}

function captionReferencesCity(caption: string, city: string): boolean {
  const tokens = collectCityTokens(city);
  if (tokens.length === 0) return true;
  const lower = caption.toLowerCase();
  return tokens.some((tok) => tok.length >= 2 && lower.includes(tok));
}

function captionReferencesServiceOrProduct(
  caption: string,
  services: string[],
  heroProduct?: string
): boolean {
  const candidates: string[] = [];
  for (const s of services) {
    const t = s.trim();
    if (t.length >= 3) candidates.push(t.toLowerCase());
  }
  if (heroProduct?.trim()) {
    const h = heroProduct.trim();
    if (h.length >= 2) candidates.push(h.toLowerCase());
  }
  if (candidates.length === 0) return true;
  const lower = caption.toLowerCase();
  return candidates.some((c) => lower.includes(c));
}

function hasUnconfirmedSuperlatives(caption: string, ctx: GenericDetectionContext): boolean {
  if (ctx.allowsSuperlatives) return false;
  const lower = caption.toLowerCase();
  if (/\b#1\b/.test(lower) || /\bnumber\s*one\b/i.test(caption)) return true;
  if (/\baward\s*[- ]?winning\b/.test(lower)) return true;
  if (/\bworld\s*[- ]?class\b/.test(lower)) return true;
  if (/\bunmatched\b/.test(lower)) return true;
  if (/\bbest\s+in\s+the\b/.test(lower)) return true;
  const cityTok = collectCityTokens(ctx.city);
  if (cityTok.length > 0) {
    for (const tok of cityTok) {
      if (tok.length < 3) continue;
      if (lower.includes(`best in ${tok}`)) return true;
    }
  } else if (/\bbest\s+in\s+[a-z]{3,}\b/.test(lower)) return true;
  return false;
}

function extractHashtags(text: string): string[] {
  return [...text.matchAll(/#[\w\u00c0-\u024f]+/gi)].map((m) => m[0].toLowerCase());
}

function softGenericHashtagsOnly(caption: string, ctx: GenericDetectionContext): boolean {
  const tags = extractHashtags(caption);
  if (tags.length === 0) return false;
  const cityTok = collectCityTokens(ctx.city);
  const brand = ctx.brandName.trim().toLowerCase();
  const businessTag = tags.some((t) => {
    const body = t.slice(1);
    if (brand && body.includes(brand.replace(/\s+/g, ''))) return true;
    for (const c of cityTok) {
      if (c.length >= 3 && t.includes(c.replace(/\s+/g, ''))) return true;
    }
    return false;
  });
  if (businessTag) return false;
  return tags.every((t) => GENERIC_ONLY_HASHTAGS.has(t));
}

function monthSeasonKeywords(month: number): string[] {
  if (month === 12 || month === 1 || month === 2) {
    return ['winter', 'holiday', 'holidays', 'christmas', 'hanukkah', 'new year', 'cozy', 'cold', 'snow', 'frost'];
  }
  if (month >= 3 && month <= 5) {
    return ['spring', 'easter', 'bloom', 'garden', 'march', 'april', 'may', 'sun'];
  }
  if (month >= 6 && month <= 8) {
    return ['summer', 'sun', 'heat', 'vacation', 'june', 'july', 'august', 'bbq', 'beach'];
  }
  return ['fall', 'autumn', 'september', 'october', 'november', 'thanksgiving', 'harvest', 'pumpkin', 'back to school'];
}

function softMissingSeasonal(caption: string, currentMonth: number): boolean {
  const lower = caption.toLowerCase();
  const keys = monthSeasonKeywords(currentMonth);
  return !keys.some((k) => lower.includes(k));
}

function softWeakCtaOnly(caption: string): boolean {
  const lower = caption.toLowerCase();
  const hasDm = /\bdm\s+us\b/.test(lower) || /\bmessage\s+us\b/.test(lower);
  const hasLink = /link\s+in\s+bio/.test(lower);
  if (!hasDm && !hasLink) return false;
  const hasSpecific =
    /\b(visit|call|book|order|reserve|stop by|open|today|tomorrow|\d{1,2}\s*(am|pm)|www\.|http|📍|tap)\b/i.test(
      caption
    );
  return !hasSpecific;
}

function computeScore(hardReasons: string[], softFlags: string[]): number {
  let s = 100 - hardReasons.length * 25 - softFlags.length * 5;
  if (hardReasons.length > 0) s = Math.min(s, 35);
  return Math.max(0, Math.min(100, s));
}

/**
 * Returns hard-fail opener / template phrases (for tests and prompt deny lists).
 */
export function getBlocklist(): string[] {
  return [...OPENER_PREFIXES, 'At {business}, we believe', 'Take your {x} to the next level'];
}

/**
 * Build the extra user-message suffix for a silent retry after generic detection.
 */
export function buildGenericRetryInstruction(hardReasons: string[]): string {
  const r = hardReasons.length ? hardReasons.join('; ') : 'generic or thin local/business specificity';
  return `Previous attempt was rejected for: ${r}. Fix these issues. You must include the business name or a specific service, the city, and avoid generic openers.`;
}

type Evaluation = {
  hardReasons: string[];
  softFlags: string[];
  isGeneric: boolean;
  score: number;
};

function evaluateCaption(caption: string, context: GenericDetectionContext): Evaluation {
  const hardReasons: string[] = [];
  const softFlags: string[] = [];

  const text = caption.trim();
  if (!text) {
    hardReasons.push('empty_caption');
    return {
      hardReasons,
      softFlags,
      isGeneric: true,
      score: computeScore(hardReasons, softFlags),
    };
  }

  if (hasBannedOpenerStart(text)) {
    hardReasons.push('banned_opener_or_template_phrase');
  }

  const city = context.city?.trim() ?? '';
  if (city && !captionReferencesCity(text, city)) {
    hardReasons.push('missing_city_or_local_place_from_brand_brain');
  }

  const services = context.services ?? [];
  const hero = context.heroProduct?.trim();
  if (
    (services.length > 0 || !!hero) &&
    !captionReferencesServiceOrProduct(text, services, hero)
  ) {
    hardReasons.push('missing_business_specific_noun_from_core_services_or_hero_product');
  }

  if (hasUnconfirmedSuperlatives(text, context)) {
    hardReasons.push('unconfirmed_superlative_claim');
  }

  if (softGenericHashtagsOnly(text, context)) {
    softFlags.push('hashtags_only_generic_local_set');
  }

  if (softMissingSeasonal(text, context.currentMonth)) {
    softFlags.push('no_seasonal_reference_for_current_month');
  }

  if (softWeakCtaOnly(text)) {
    softFlags.push('cta_only_dm_or_link_in_bio');
  }

  const isGeneric = hardReasons.length > 0;
  const score = computeScore(hardReasons, softFlags);

  return { hardReasons, softFlags, isGeneric, score };
}

export function detectGeneric(caption: string, context: GenericDetectionContext): DetectionResult {
  const e = evaluateCaption(caption, context);
  return {
    isGeneric: e.isGeneric,
    reasons: e.hardReasons,
    score: e.score,
  };
}

/** Full breakdown for persistence (soft flags are not part of public DetectionResult). */
export function captionDetectionDiagnostics(
  caption: string,
  context: GenericDetectionContext
): DetectionResult & { softFlags: string[] } {
  const e = evaluateCaption(caption, context);
  return {
    isGeneric: e.isGeneric,
    reasons: e.hardReasons,
    score: e.score,
    softFlags: e.softFlags,
  };
}
