/**
 * Central Quickpost “Brand DNA” helpers for OpenAI prompts.
 * Prefer passing `brandProfile` from server-loaded account data; optional on routes for backward compatibility.
 */

/** Subset of formatted account / profile fields used in prompts */
export type BrandDNAProfile = {
  name?: string;
  type?: string;
  displayType?: string;
  city?: string | null;
  neighborhood?: string | null;
  brandDnaSource?: string;
  confidenceOverall?: number;
  brainFieldConfidence?: Record<string, number>;
  customDescription?: string;
  websiteSummary?: string;
  tagline?: string;
  brandVibe?: string;
  brandColor?: string | null;
  dominantColors?: string[];
  toneOfVoice?: string;
  contentPersona?: string;
  uniqueDifferentiator?: string;
  visualStyle?: string;
  studioStylePreference?: string;
  studioBgColor?: string;
  coreServices?: string[];
  heroProduct?: string;
  instagramHandle?: string;
  pricePositioning?: string;
  businessSubcategory?: string;
  seasonalContext?: string;
  localEvents?: string[];
  lastPostTopics?: string[];
  topPerformingAngles?: string[];
  preferredCaptionLength?: string;
  avoidedTopics?: string[];
};

export const QUALITY_SCORE_DELIVER_MIN = 80;
export const QUALITY_SCORE_PARTIAL_MIN = 60;

/** Extra generic openers merged into genericDetector (library + product-specific). */
export const BANNED_OPENER_PREFIXES: readonly string[] = [
  'unlock the secret',
  'game-changer',
  'revolutionize your',
  'synergy',
  'leverage our',
];

function numOrUndef(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  return undefined;
}

function strOrUndef(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string') return v.trim() || undefined;
  return undefined;
}

function pickBrainConf(v: unknown): Record<string, number> | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(o)) {
    if (typeof val === 'number' && !Number.isNaN(val)) out[k] = val;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Map `getAccount()` / formatAccount JSON to BrandDNAProfile. */
export function formattedAccountToBrandDNA(
  account: Record<string, unknown> | null | undefined
): BrandDNAProfile | undefined {
  if (!account) return undefined;
  const name = strOrUndef(account.name);
  const displayType = strOrUndef(account.displayType);
  const type = strOrUndef(account.type ?? account.businessType);

  const dom = account.dominantColors;
  const core = account.coreServices;
  const prof: BrandDNAProfile = {
    name,
    type,
    displayType,
    city: (account.city as string | null | undefined) ?? null,
    neighborhood: strOrUndef(account.neighborhood),
    brandDnaSource: strOrUndef(account.brandDnaSource),
    confidenceOverall: numOrUndef(account.confidenceOverall),
    brainFieldConfidence: pickBrainConf(account.brainFieldConfidence),
    customDescription: strOrUndef(account.customDescription),
    websiteSummary: strOrUndef(account.websiteSummary),
    tagline: strOrUndef(account.tagline),
    brandVibe: strOrUndef(account.brandVibe),
    brandColor: (account.brandColor as string | null | undefined) ?? null,
    dominantColors: Array.isArray(dom) ? (dom as string[]).filter((s) => typeof s === 'string') : undefined,
    toneOfVoice: strOrUndef(account.toneOfVoice),
    contentPersona: strOrUndef(account.contentPersona),
    uniqueDifferentiator: strOrUndef(account.uniqueDifferentiator),
    visualStyle: strOrUndef(account.visualStyle),
    studioStylePreference: strOrUndef(account.studioStylePreference),
    studioBgColor: strOrUndef(account.studioBgColor),
    coreServices: Array.isArray(core) ? (core as string[]).filter((s) => typeof s === 'string') : undefined,
    heroProduct: strOrUndef(account.heroProduct),
    instagramHandle: strOrUndef(account.instagramHandle),
    pricePositioning: strOrUndef(account.pricePositioning),
    businessSubcategory: strOrUndef(account.businessSubcategory),
    seasonalContext: strOrUndef(account.seasonalContext),
    localEvents: Array.isArray(account.localEvents)
      ? (account.localEvents as string[]).filter((s) => typeof s === 'string')
      : undefined,
    lastPostTopics: Array.isArray(account.lastPostTopics)
      ? (account.lastPostTopics as string[]).filter((s) => typeof s === 'string')
      : undefined,
    topPerformingAngles: Array.isArray(account.topPerformingAngles)
      ? (account.topPerformingAngles as string[]).filter((s) => typeof s === 'string')
      : undefined,
    preferredCaptionLength: strOrUndef(account.preferredCaptionLength),
    avoidedTopics: Array.isArray(account.avoidedTopics)
      ? (account.avoidedTopics as string[]).filter((s) => typeof s === 'string')
      : undefined,
  };
  return hasMeaningfulBrandProfile(prof) ? prof : undefined;
}

function rowStr(p: Record<string, unknown>, camel: string, snake: string): string | undefined {
  return strOrUndef(p[camel] ?? p[snake]);
}

/** Worker DB rows (snake_case + camelCase) → BrandDNAProfile */
export function workerRawToBrandDNA(
  profile: Record<string, unknown> | null | undefined,
  account: Record<string, unknown> | null | undefined
): BrandDNAProfile | undefined {
  if (!profile && !account) return undefined;
  const p = profile ?? {};
  const a = account ?? {};
  const bt = (a.businessType ?? a.business_type ?? 'restaurant') as string;
  const name =
    rowStr(p, 'name', 'name') ||
    rowStr(a, 'name', 'name') ||
    strOrUndef(a.businessName ?? a.business_name);
  const displayType = rowStr(p, 'displayType', 'display_type');

  const dom = p.dominantColors ?? p.dominant_colors;
  const core = p.coreServices ?? p.core_services;
  const prof: BrandDNAProfile = {
    name,
    type: typeof bt === 'string' ? bt : undefined,
    displayType,
    city: (p.city as string | null | undefined) ?? null,
    neighborhood: rowStr(p, 'neighborhood', 'neighborhood'),
    brandDnaSource: rowStr(p, 'brandDnaSource', 'brand_dna_source'),
    confidenceOverall: numOrUndef(p.confidenceOverall ?? p.confidence_overall),
    brainFieldConfidence: pickBrainConf(p.brainFieldConfidence ?? p.brain_field_confidence),
    customDescription: rowStr(p, 'customDescription', 'custom_description'),
    websiteSummary: rowStr(p, 'websiteSummary', 'website_summary'),
    tagline: rowStr(p, 'tagline', 'tagline'),
    brandVibe: rowStr(p, 'brandVibe', 'brand_vibe'),
    brandColor: (p.brandColor ?? p.brand_color) as string | null | undefined,
    dominantColors: Array.isArray(dom) ? (dom as string[]).filter((s) => typeof s === 'string') : undefined,
    toneOfVoice: rowStr(p, 'toneOfVoice', 'tone_of_voice'),
    contentPersona: rowStr(p, 'contentPersona', 'content_persona'),
    uniqueDifferentiator: rowStr(p, 'uniqueDifferentiator', 'unique_differentiator'),
    visualStyle: rowStr(p, 'visualStyle', 'visual_style'),
    studioStylePreference: rowStr(p, 'studioStylePreference', 'studio_style_preference'),
    studioBgColor: rowStr(p, 'studioBgColor', 'studio_bg_color'),
    coreServices: Array.isArray(core) ? (core as string[]).filter((s) => typeof s === 'string') : undefined,
    heroProduct: rowStr(p, 'heroProduct', 'hero_product'),
    instagramHandle: rowStr(p, 'instagramHandle', 'instagram_handle'),
    pricePositioning: rowStr(p, 'pricePositioning', 'price_positioning'),
    businessSubcategory: rowStr(p, 'businessSubcategory', 'business_subcategory'),
    seasonalContext: rowStr(p, 'seasonalContext', 'seasonal_context'),
    localEvents: Array.isArray(p.localEvents ?? p.local_events)
      ? ((p.localEvents ?? p.local_events) as string[]).filter((s) => typeof s === 'string')
      : undefined,
    lastPostTopics: Array.isArray(p.lastPostTopics ?? p.last_post_topics)
      ? ((p.lastPostTopics ?? p.last_post_topics) as string[]).filter((s) => typeof s === 'string')
      : undefined,
    topPerformingAngles: Array.isArray(p.topPerformingAngles ?? p.top_performing_angles)
      ? ((p.topPerformingAngles ?? p.top_performing_angles) as string[]).filter((s) => typeof s === 'string')
      : undefined,
    preferredCaptionLength: rowStr(p, 'preferredCaptionLength', 'preferred_caption_length'),
    avoidedTopics: Array.isArray(p.avoidedTopics ?? p.avoided_topics)
      ? ((p.avoidedTopics ?? p.avoided_topics) as string[]).filter((s) => typeof s === 'string')
      : undefined,
  };
  return hasMeaningfulBrandProfile(prof) ? prof : undefined;
}


export function hasMeaningfulBrandProfile(p: BrandDNAProfile | null | undefined): boolean {
  if (!p) return false;
  return !!(
    p.name?.trim() ||
    p.displayType?.trim() ||
    p.type?.trim() ||
    (p.coreServices && p.coreServices.length) ||
    p.websiteSummary?.trim() ||
    p.uniqueDifferentiator?.trim() ||
    p.heroProduct?.trim() ||
    p.toneOfVoice?.trim()
  );
}

export function buildDataSourceNote(p: BrandDNAProfile | null | undefined): string {
  if (!p) return '';
  const src = p.brandDnaSource?.trim();
  const conf = p.confidenceOverall;
  if (!src && conf == null && !p.brainFieldConfidence) return '';
  const confStr = conf != null ? String(Math.round(conf * 100) / 100) : 'n/a';
  const lines = [
    '--- DNA provenance ---',
    src ? `Sources: ${src}.` : null,
    `Overall confidence: ${confStr}.`,
    p.brainFieldConfidence && Object.keys(p.brainFieldConfidence).length
      ? `Field confidence (0–1): ${JSON.stringify(p.brainFieldConfidence)}`
      : null,
    'Honor this block; do not invent conflicting facts.',
    '',
  ].filter((x): x is string => !!x);
  return lines.join('\n');
}

export function buildBrandDNABlock(p: BrandDNAProfile | null | undefined): string {
  if (!p || !hasMeaningfulBrandProfile(p)) return '';
  const lines: string[] = ['--- BRAND DNA ---'];
  const add = (label: string, v: string | null | undefined) => {
    const t = v?.trim();
    if (t) lines.push(`${label}: ${t}`);
  };
  add('Business name', p.name ?? undefined);
  add('Category', p.type ?? undefined);
  add('Display type', p.displayType ?? undefined);
  add('City', p.city ?? undefined);
  add('Neighborhood', p.neighborhood ?? undefined);
  add('Tagline', p.tagline);
  add('Brand vibe', p.brandVibe);
  add('Palette', p.dominantColors?.length ? p.dominantColors.join(', ') : undefined);
  add('Brand color', p.brandColor ?? undefined);
  add('Tone of voice', p.toneOfVoice);
  add('Content persona', p.contentPersona);
  add('Differentiator', p.uniqueDifferentiator);
  add('Visual style', p.visualStyle);
  add('Studio look', p.studioStylePreference);
  add('Studio backdrop', p.studioBgColor);
  add('Hero offer', p.heroProduct);
  add('Core services', p.coreServices?.length ? p.coreServices.join('; ') : undefined);
  add('Website summary', p.websiteSummary);
  add('Custom context', p.customDescription);
  add('Instagram', p.instagramHandle);
  add('Price positioning', p.pricePositioning);
  add('Subcategory', p.businessSubcategory);
  add('Seasonal context', p.seasonalContext);
  if (p.localEvents?.length) add('Local events', p.localEvents.join('; '));
  if (p.topPerformingAngles?.length) add('Winning angles', p.topPerformingAngles.join('; '));
  if (p.avoidedTopics?.length) add('Avoid topics', p.avoidedTopics.join('; '));
  if (p.preferredCaptionLength) add('Preferred caption length', p.preferredCaptionLength);
  lines.push('--- END BRAND DNA ---', '');
  return lines.join('\n');
}

/** Prepend provenance + DNA to a user-role prompt body. */
export function prependQuickpostDnaToUserPrompt(
  baseUserContent: string,
  profile?: BrandDNAProfile | null
): string {
  if (!profile || !hasMeaningfulBrandProfile(profile)) return baseUserContent;
  const note = buildDataSourceNote(profile);
  const block = buildBrandDNABlock(profile);
  return `${note}${block}\n${baseUserContent}`.trim();
}

export function briefSystemPromptWhenProfile(hasProfile: boolean): string {
  if (!hasProfile) return 'Output valid JSON only.';
  return [
    'Output valid JSON only.',
    'The user message may include BRAND DNA and provenance — treat them as authoritative for business facts and voice.',
    'Do not contradict DNA; infer gaps conservatively.',
  ].join(' ');
}

export function captionSystemSupplementWhenProfile(hasProfile: boolean): string {
  if (!hasProfile) return '';
  return ' Brand DNA in the user message overrides generic business assumptions; stay specific.';
}

export function campaignStrategistSystemPrompt(): string {
  return [
    'You are Quickpost’s social content strategist for local small businesses.',
    'Output a single JSON object only (no markdown), shape:',
    '{"ideas":[{"id":"kebab-id","emoji":"✨","contentAngle":"2-4 words","headline":"...","rationale":"one sentence","prompt":"2-5 sentence creative brief for a social post"}]}',
    'Rules: exactly 4 ideas. contentAngle is a short pill label. prompt must be actionable and specific to the brand context and any brandDna fields.',
    'Respect brandDna.avoidedTopics and do not center ideas on those themes.',
  ].join('\n');
}

export function enrichBrandBrainSystemPrompt(): string {
  return [
    'You are Quickpost’s Brand Brain refinement model for a local small-business social app.',
    'Output valid JSON only. No markdown.',
    'Use signal evidence; never invent business facts.',
  ].join(' ');
}

export function editCaptionMasterPrefix(profile?: BrandDNAProfile | null): string {
  if (!profile || !hasMeaningfulBrandProfile(profile)) return '';
  const note = buildDataSourceNote(profile);
  const block = buildBrandDNABlock(profile);
  return `${note}${block}\n\n`;
}
