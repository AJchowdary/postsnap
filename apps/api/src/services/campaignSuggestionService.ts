import OpenAI from 'openai';
import { getDb } from '../db';
import { requireAccountForUser } from './accountService';
import { config } from '../config';
import { logger } from '../utils/logger';
import { campaignStrategistSystemPrompt } from '../prompts/quickpostAI';

interface AccountRow {
  businessType?: string;
  business_type?: string;
}

interface ProfileRow {
  name?: string | null;
  city?: string | null;
  coreServices?: string[] | null;
  core_services?: string[] | null;
  brandVibe?: string | null;
  brand_vibe?: string | null;
  toneOfVoice?: string | null;
  tone_of_voice?: string | null;
  tagline?: string | null;
  heroProduct?: string | null;
  hero_product?: string | null;
  uniqueDifferentiator?: string | null;
  unique_differentiator?: string | null;
  websiteSummary?: string | null;
  website_summary?: string | null;
  brandDnaSource?: string | null;
  brand_dna_source?: string | null;
  confidenceOverall?: number | null;
  confidence_overall?: number | null;
  brainFieldConfidence?: Record<string, number> | null;
  brain_field_confidence?: Record<string, number> | null;
  avoidedTopics?: string[] | null;
  avoided_topics?: string[] | null;
}

export type CampaignIdeaCard = {
  id: string;
  emoji: string;
  headline: string;
  rationale: string;
  /** Short UI label (pill). */
  contentAngle: string;
  /** Fills the campaign prompt / brief when the user selects this card. */
  prompt: string;
};

function seasonLabel(d: Date): string {
  const m = d.getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'fall';
  return 'winter';
}

function normalizeServices(p: ProfileRow | null): string[] {
  const raw = p?.coreServices ?? p?.core_services;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim());
}

function brandContextLines(
  bn: string,
  city: string | undefined,
  services: string[],
  vibe: string | undefined,
  tone: string | undefined
): string {
  const parts: string[] = [];
  if (city) parts.push(`Location: ${city}.`);
  if (services.length) parts.push(`Services / focus: ${services.slice(0, 6).join(', ')}.`);
  if (vibe) parts.push(`Brand vibe: ${vibe}.`);
  if (tone) parts.push(`Tone of voice: ${tone}.`);
  if (parts.length === 0) return '';
  return ` ${parts.join(' ')}`;
}

function verticalCard(
  businessType: string,
  bn: string,
  hintLine: string,
  extraCtx: string
): CampaignIdeaCard {
  const v = businessType.toLowerCase();
  if (v === 'salon') {
    return {
      id: 'vertical-salon',
      emoji: '💇',
      contentAngle: 'Transformation',
      headline: 'Fresh look this week',
      rationale: 'Salon-focused booking and transformation angle.',
      prompt: `Invite clients to book a fresh look at ${bn}. Transformation, confidence, one clear CTA.${hintLine}${extraCtx}`,
    };
  }
  if (v === 'gym') {
    return {
      id: 'vertical-gym',
      emoji: '💪',
      contentAngle: 'Community',
      headline: 'Train with us',
      rationale: 'Community and results for fitness brands.',
      prompt: `Motivate a visit or trial at ${bn}. One member-style win, supportive tone.${hintLine}${extraCtx}`,
    };
  }
  if (v === 'cafe') {
    return {
      id: 'vertical-cafe',
      emoji: '☕',
      contentAngle: 'Lifestyle',
      headline: 'Cup of the week',
      rationale: 'Sensory cafe lifestyle and pairing.',
      prompt: `Feature a drink or pastry pairing at ${bn}. Cozy, sensory, reason to visit today.${hintLine}${extraCtx}`,
    };
  }
  if (v === 'retail') {
    return {
      id: 'vertical-retail',
      emoji: '🛍️',
      contentAngle: 'New arrival',
      headline: 'New on the shelf',
      rationale: 'Discovery and inventory energy for retail.',
      prompt: `Showcase something new or back in stock at ${bn}. Specific product, lifestyle context.${hintLine}${extraCtx}`,
    };
  }
  return {
    id: 'vertical-restaurant',
    emoji: '🍽️',
    contentAngle: 'Tonight’s table',
    headline: 'Tonight’s table',
    rationale: 'Menu-led appetite hook for hospitality.',
    prompt: `Promote tonight or this weekend at ${bn}. Dish-led detail, reservation or visit CTA.${hintLine}${extraCtx}`,
  };
}

function parseIdeasJson(raw: string): CampaignIdeaCard[] | null {
  const t = raw.trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(t.slice(start, end + 1)) as { ideas?: unknown };
    if (!parsed.ideas || !Array.isArray(parsed.ideas)) return null;
    const out: CampaignIdeaCard[] = [];
    for (const item of parsed.ideas) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const id = typeof o.id === 'string' ? o.id : `idea-${out.length}`;
      const emoji = typeof o.emoji === 'string' && o.emoji.trim() ? o.emoji.trim().slice(0, 4) : '✨';
      const headline = typeof o.headline === 'string' ? o.headline : '';
      const rationale = typeof o.rationale === 'string' ? o.rationale : '';
      const prompt = typeof o.prompt === 'string' ? o.prompt : '';
      let contentAngle = typeof o.contentAngle === 'string' ? o.contentAngle.trim() : '';
      if (!contentAngle && headline) contentAngle = headline.split(/[.–—]/)[0]?.trim().slice(0, 28) || 'Idea';
      if (!headline || !prompt) continue;
      out.push({
        id,
        emoji,
        contentAngle: contentAngle || 'Idea',
        headline: headline.slice(0, 200),
        rationale: rationale.slice(0, 280),
        prompt: prompt.slice(0, 1200),
      });
    }
    return out.length >= 3 ? out : null;
  } catch {
    return null;
  }
}

async function suggestIdeasOpenAI(
  businessType: string,
  profile: ProfileRow | null,
  bn: string,
  hint?: string | null
): Promise<CampaignIdeaCard[] | null> {
  if (!config.openaiApiKey?.trim()) return null;

  const city = profile?.city?.trim() || '';
  const services = normalizeServices(profile);
  const vibe = (profile?.brandVibe ?? profile?.brand_vibe)?.trim() || '';
  const tone = (profile?.toneOfVoice ?? profile?.tone_of_voice)?.trim() || '';

  const client = new OpenAI({ apiKey: config.openaiApiKey, timeout: 45_000 });
  const avoided =
    profile?.avoidedTopics ??
    profile?.avoided_topics ??
    ([] as string[]);
  const avoidedClean = Array.isArray(avoided)
    ? avoided.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, 20)
    : [];

  const context = {
    businessType,
    businessName: bn,
    city: city || null,
    coreServices: services,
    brandVibe: vibe || null,
    toneOfVoice: tone || null,
    tagline: profile?.tagline?.trim() || null,
    heroProduct: (profile?.heroProduct ?? profile?.hero_product)?.toString().trim() || null,
    differentiator:
      (profile?.uniqueDifferentiator ?? profile?.unique_differentiator)?.toString().trim() || null,
    websiteSummary:
      (profile?.websiteSummary ?? profile?.website_summary)?.toString().trim().slice(0, 400) || null,
    optionalHint: hint?.trim().slice(0, 200) || null,
    brandDna: {
      source: (profile?.brandDnaSource ?? profile?.brand_dna_source)?.toString().trim() || null,
      confidenceOverall:
        typeof profile?.confidenceOverall === 'number'
          ? profile.confidenceOverall
          : typeof profile?.confidence_overall === 'number'
            ? profile.confidence_overall
            : null,
      fieldConfidence:
        (profile?.brainFieldConfidence ?? profile?.brain_field_confidence) &&
        typeof (profile?.brainFieldConfidence ?? profile?.brain_field_confidence) === 'object'
          ? profile?.brainFieldConfidence ?? profile?.brain_field_confidence
          : null,
      avoidedTopics: avoidedClean.length ? avoidedClean : null,
    },
  };

  const system = campaignStrategistSystemPrompt();

  try {
    const completion = await client.chat.completions.create({
      model: config.openaiCaptionModel,
      temperature: 0.85,
      max_tokens: 1800,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(context) },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return null;
    return parseIdeasJson(text);
  } catch (e) {
    logger.warn('suggestIdeasOpenAI failed', { error: (e as Error).message });
    return null;
  }
}

function buildFallbackIdeas(
  businessType: string,
  profile: ProfileRow | null,
  bn: string,
  hint?: string | null
): { ideas: CampaignIdeaCard[] } {
  const city = profile?.city?.trim() || '';
  const services = normalizeServices(profile);
  const vibe = (profile?.brandVibe ?? profile?.brand_vibe)?.trim() || '';
  const tone = (profile?.toneOfVoice ?? profile?.tone_of_voice)?.trim() || '';
  const extraCtx = brandContextLines(bn, city || undefined, services, vibe, tone);
  const hintLine =
    hint && hint.trim() ? ` Incorporate this angle: ${hint.trim().slice(0, 200)}.` : '';

  const ideas: CampaignIdeaCard[] = [];

  ideas.push({
    id: 'spotlight',
    emoji: '✨',
    contentAngle: 'Brand spotlight',
    headline: `${bn} — this week’s highlight`,
    rationale: 'Puts your brand forward with a confident, timely hook.',
    prompt: `Feature ${bn} and what makes you the right choice this week. Lead with a benefit, end with a friendly CTA.${hintLine}${extraCtx}`,
  });

  const season = seasonLabel(new Date());
  ideas.push({
    id: 'seasonal',
    emoji: '🌿',
    contentAngle: 'Seasonal',
    headline: `${season} moment`,
    rationale: 'Ties your post to the current season for extra relevance.',
    prompt: `Create a ${season} post for ${bn}: seasonal mood, one concrete detail, and a reason to act now.${hintLine}${extraCtx}`,
  });

  const hero = profile?.heroProduct ?? profile?.hero_product;
  if (hero && String(hero).trim()) {
    ideas.push({
      id: 'hero-product',
      emoji: '🎯',
      contentAngle: 'Hero offer',
      headline: `Spotlight: ${String(hero).slice(0, 52)}${String(hero).length > 52 ? '…' : ''}`,
      rationale: 'Uses your Brand Brain hero offering.',
      prompt: `Center the post on "${String(hero).trim()}". Say who it helps and the outcome they get.${hintLine}${extraCtx}`,
    });
  }

  const tag = profile?.tagline?.trim();
  if (tag) {
    ideas.push({
      id: 'tagline',
      emoji: '💬',
      contentAngle: 'Tagline',
      headline: 'Lead with your tagline',
      rationale: 'Echoes the line customers associate with you.',
      prompt: `Open with the spirit of "${tag}" and expand into a short proof point or story for ${bn}.${hintLine}${extraCtx}`,
    });
  }

  const diff = profile?.uniqueDifferentiator ?? profile?.unique_differentiator;
  if (diff && String(diff).trim()) {
    ideas.push({
      id: 'differentiator',
      emoji: '⚡',
      contentAngle: 'Differentiator',
      headline: 'Why we’re different',
      rationale: 'Surfaces your differentiator so the copy stays specific.',
      prompt: `Explain in plain language why ${bn} is different: ${String(diff).trim()}. Avoid generic superlatives.${hintLine}${extraCtx}`,
    });
  }

  ideas.push(verticalCard(businessType, bn, hintLine, extraCtx));

  const webRaw = profile?.websiteSummary ?? profile?.website_summary;
  const web = webRaw?.trim().slice(0, 160);
  if (web) {
    ideas.push({
      id: 'brand-story',
      emoji: '📖',
      contentAngle: 'Brand story',
      headline: 'Brand story bite',
      rationale: 'Grounds the post in your website summary.',
      prompt: `Turn this brand essence into a tight social post: ${web}.${hintLine}${extraCtx}`,
    });
  }

  const seen = new Set<string>();
  const deduped = ideas.filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });

  return { ideas: deduped.slice(0, 6) };
}

export async function suggestCampaignIdeas(
  ownerUserId: string,
  hint?: string | null
): Promise<{ ideas: CampaignIdeaCard[] }> {
  const accountId = await requireAccountForUser(ownerUserId);
  const db = await getDb();
  const account = await db.findOne<AccountRow>('accounts', { id: accountId });
  const profile = await db.findOne<ProfileRow>('business_profiles', { account_id: accountId });

  const businessType = (account?.businessType ?? account?.business_type ?? 'retail').toLowerCase();
  const bn = (profile?.name && profile.name.trim()) || 'your business';

  const llm = await suggestIdeasOpenAI(businessType, profile, bn, hint);
  if (llm && llm.length >= 3) {
    return { ideas: llm.slice(0, 6) };
  }

  return buildFallbackIdeas(businessType, profile, bn, hint);
}
