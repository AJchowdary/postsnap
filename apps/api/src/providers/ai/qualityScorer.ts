/**
 * Blueprint quality rubric — keyword heuristics only (no extra LLM calls).
 */
import { captionDetectionDiagnostics, type GenericDetectionContext } from './genericDetector';
import {
  QUALITY_SCORE_DELIVER_MIN,
  QUALITY_SCORE_PARTIAL_MIN,
} from '../../prompts/quickpostAI';

export type DimensionScores = {
  localSpecificity: number;
  businessSpecificity: number;
  voiceMatch: number;
  engagementHook: number;
  nonGenericLanguage: number;
};

export type QualityVerdict = 'deliver' | 'retry-partial' | 'retry-full';

export type QualityScore = {
  total: number;
  dimensions: DimensionScores;
  verdict: QualityVerdict;
  weakestDimension: keyof DimensionScores;
};

export type ScoringContext = {
  city?: string;
  neighborhood?: string;
  businessName: string;
  coreServices: string[];
  heroProduct?: string;
  brandVibe?: string;
  toneOfVoice?: string;
  currentMonth: number;
};

const DIMENSION_ORDER: (keyof DimensionScores)[] = [
  'localSpecificity',
  'businessSpecificity',
  'voiceMatch',
  'engagementHook',
  'nonGenericLanguage',
];

const REGIONAL_HINTS =
  /\b(midwest|downtown|uptown|tri-?state|bay area|neighborhood|neighbourhood|main st|main street|strip mall|locally|nearby|our block|the block)\b/i;

function cityTokens(city: string): string[] {
  const t = city.trim().toLowerCase();
  if (!t) return [];
  return t
    .split(/[,/]/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
}

function neighborhoodTokens(n: string): string[] {
  const t = n.trim().toLowerCase();
  if (!t) return [];
  return t
    .split(/[,/]/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
}

function textHasAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => n.length >= 2 && h.includes(n));
}

function scoreLocal(caption: string, ctx: ScoringContext): number {
  const cityTok = cityTokens(ctx.city ?? '');
  const neighTok = neighborhoodTokens(ctx.neighborhood ?? '');
  const lower = caption.toLowerCase();
  const hasCity = cityTok.length > 0 && textHasAny(lower, cityTok);
  const hasNeigh = neighTok.length > 0 && textHasAny(lower, neighTok);
  if (hasCity && hasNeigh) return 25;
  if (hasCity) return 18;
  if (REGIONAL_HINTS.test(caption) && !hasCity) return 8;
  return 0;
}

function scoreBusiness(caption: string, ctx: ScoringContext): number {
  const lower = caption.toLowerCase();
  const name = (ctx.businessName || '').trim().toLowerCase();
  const hasName = name.length >= 2 && lower.includes(name);
  const services = (ctx.coreServices ?? []).map((s) => s.trim().toLowerCase()).filter((s) => s.length >= 3);
  const hero = ctx.heroProduct?.trim().toLowerCase();
  const hasService = services.some((s) => lower.includes(s)) || (!!hero && hero.length >= 2 && lower.includes(hero));
  if (hasName && hasService) return 25;
  if (hasService && !hasName) return 18;
  if (hasName && !hasService) return 10;
  return 0;
}

type Vibe = 'warm' | 'professional' | 'bold' | string | undefined;
type Tone = string | undefined;

function scoreCaptionToneSignals(lower: string): Record<string, number> {
  const s: Record<string, number> = {
    warm: 0,
    professional: 0,
    bold: 0,
    casual: 0,
    conversational: 0,
    inspiring: 0,
  };
  if (/\b(cozy|welcome|heart|together|community|neighbor|neighbors|feel like home|warmly)\b/i.test(lower)) s.warm += 2;
  if (/[☕❤️🌿]/.test(lower)) s.warm += 1;
  if (/\b(schedule|consultation|appointment|expert|professional|certified)\b/i.test(lower)) s.professional += 2;
  if (/\b(fire|unstoppable|level up|game-?changer|bold|win big)\b/i.test(lower)) s.bold += 2;
  if (/\b(hey|gonna|y'all|lol|quick|grab a|pop in)\b/i.test(lower)) s.casual += 2;
  if (/\b(we |you |your |let's|tell you|here's why)\b/i.test(lower)) s.conversational += 1;
  if (/\b(dream|transform|elevate|journey|inspire|rise)\b/i.test(lower)) s.inspiring += 2;
  return s;
}

function expectedToneBucket(vibe: Vibe, tone: Tone): string | null {
  const v = (vibe || '').toLowerCase();
  const t = (tone || '').toLowerCase();
  if (t.includes('casual')) return 'casual';
  if (t.includes('conversational')) return 'conversational';
  if (t.includes('inspiring')) return 'inspiring';
  if (t.includes('bold')) return 'bold';
  if (t.includes('professional')) return 'professional';
  if (v === 'warm') return 'warm';
  if (v === 'professional') return 'professional';
  if (v === 'bold') return 'bold';
  return null;
}

function scoreVoice(caption: string, ctx: ScoringContext): number {
  const lower = caption.toLowerCase();
  const sig = scoreCaptionToneSignals(lower);
  const bucket = expectedToneBucket(ctx.brandVibe, ctx.toneOfVoice);
  if (!bucket) return 12;

  const primary = (): number => {
    switch (bucket) {
      case 'warm':
        return sig.warm;
      case 'professional':
        return sig.professional;
      case 'bold':
        return sig.bold;
      case 'casual':
        return sig.casual;
      case 'conversational':
        return sig.conversational;
      case 'inspiring':
        return sig.inspiring;
      default:
        return 0;
    }
  };

  const p = primary();
  const conflict =
    (bucket === 'warm' && sig.professional >= 4 && sig.warm <= 0) ||
    (bucket === 'professional' && sig.casual >= 4) ||
    (bucket === 'bold' && sig.warm >= 4 && sig.bold <= 0);

  if (conflict) return 0;
  if (p >= 2) return 20;
  return 12;
}

function scoreEngagement(caption: string): number {
  const t = caption.trim();
  const lower = t.toLowerCase();
  const strongOpener =
    /^\s*(\?|what |why |how |did you know|here's|story time|meet |this week|today only|\d+\s*%)/i.test(t) ||
    /\n\?\s/.test(t);
  const decentOpener = strongOpener || /^(when |where |which )/i.test(t) || lower.includes('reason to visit');
  const strongCta =
    /\b(visit|call|book|order|reserve|stop by|open \d|today at|tomorrow|grab|tap|swipe)\b/i.test(lower) &&
    !/^.{0,120}link in bio.{0,80}$/i.test(lower.replace(/\s+/g, ' '));
  const weakCta = /\b(dm us|message us|link in bio)\b/i.test(lower);
  const decentCta = strongCta || (weakCta && lower.length > 160);

  if ((strongOpener || decentOpener) && strongCta) return 15;
  if (decentOpener || decentCta || strongCta) return 10;
  if (weakCta || lower.includes('!')) return 5;
  return 0;
}

function scoreNonGeneric(caption: string, genCtx: GenericDetectionContext): number {
  const diag = captionDetectionDiagnostics(caption, genCtx);
  if (diag.isGeneric) return 0;
  const sf = diag.softFlags?.length ?? 0;
  if (sf === 0) return 15;
  if (sf <= 2) return 8;
  return 0;
}

function sumDimensions(d: DimensionScores): number {
  return (
    d.localSpecificity +
    d.businessSpecificity +
    d.voiceMatch +
    d.engagementHook +
    d.nonGenericLanguage
  );
}

function pickWeakest(dim: DimensionScores): keyof DimensionScores {
  let min = Infinity;
  let key: keyof DimensionScores = 'nonGenericLanguage';
  for (const k of DIMENSION_ORDER) {
    const v = dim[k];
    if (v < min) {
      min = v;
      key = k;
    }
  }
  return key;
}

export function scoreCaption(caption: string, context: ScoringContext): QualityScore {
  const genCtx: GenericDetectionContext = {
    city: context.city?.trim() ?? '',
    services: context.coreServices ?? [],
    heroProduct: context.heroProduct?.trim(),
    brandName: context.businessName?.trim() ?? '',
    currentMonth: context.currentMonth,
    allowsSuperlatives: false,
  };

  const dimensions: DimensionScores = {
    localSpecificity: scoreLocal(caption, context),
    businessSpecificity: scoreBusiness(caption, context),
    voiceMatch: scoreVoice(caption, context),
    engagementHook: scoreEngagement(caption),
    nonGenericLanguage: scoreNonGeneric(caption, genCtx),
  };

  const total = sumDimensions(dimensions);
  const weakestDimension = pickWeakest(dimensions);
  let verdict: QualityVerdict;
  if (total >= QUALITY_SCORE_DELIVER_MIN) verdict = 'deliver';
  else if (total >= QUALITY_SCORE_PARTIAL_MIN) verdict = 'retry-partial';
  else verdict = 'retry-full';

  return { total, dimensions, verdict, weakestDimension };
}

export function buildPartialQualityRetryInstruction(weakest: keyof DimensionScores): string {
  const map: Record<keyof DimensionScores, string> = {
    localSpecificity:
      'QUALITY RETRY (local only): Add the city name and one neighborhood or landmark detail from the business profile. Do not change unrelated sections.',
    businessSpecificity:
      'QUALITY RETRY (business detail only): Name the business and one concrete service or product from the profile. Keep voice and structure.',
    voiceMatch:
      'QUALITY RETRY (voice only): Match the brand vibe and tone of voice from the brief — warmer, more conversational, or more professional as specified. Keep facts the same.',
    engagementHook:
      'QUALITY RETRY (hook/CTA only): Open with a question or specific moment and end with a clear action (visit, call, book, hours).',
    nonGenericLanguage:
      'QUALITY RETRY (non-generic language): Remove clichés and marketing filler; keep specifics and local detail.',
  };
  return map[weakest];
}

export function buildFullQualityRetryInstruction(): string {
  return `QUALITY RETRY (full regeneration): Re-write all three caption parts with tighter constraints — concrete local detail, named services, brand voice match, strong hook + CTA, zero generic openers. Return valid JSON with the captions array only.`;
}

export function scoringContextFromCaptionParams(
  p: {
    city?: string;
    businessName: string;
    coreServices?: string[];
    heroProduct?: string;
    brandVibe?: string;
    toneOfVoice?: string;
  },
  neighborhood?: string
): ScoringContext {
  return {
    city: p.city,
    neighborhood,
    businessName: p.businessName,
    coreServices: p.coreServices ?? [],
    heroProduct: p.heroProduct,
    brandVibe: p.brandVibe,
    toneOfVoice: p.toneOfVoice,
    currentMonth: new Date().getUTCMonth() + 1,
  };
}
