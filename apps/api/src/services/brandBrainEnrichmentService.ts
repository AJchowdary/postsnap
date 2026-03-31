/**
 * Flywheel: merge LLM-inferred Brand Brain updates from recent signals.
 * Called from captureSignal after every 5th signal or on publish.
 */
import { getDb } from '../db';
import { config } from '../config';
import { logger } from '../utils/logger';
import { trackEvent } from './analyticsEvents';
import { enrichBrandBrainSystemPrompt } from '../prompts/quickpostAI';

const ENRICH_CONF = 0.75;
const HIGH_CONF_GUARD = 0.85;

type EnrichableKey =
  | 'tone_of_voice'
  | 'content_persona'
  | 'preferred_caption_length'
  | 'top_performing_angles'
  | 'avoided_topics';

interface ProfileRow {
  accountId: string;
  toneOfVoice?: string | null;
  contentPersona?: string | null;
  preferredCaptionLength?: string | null;
  topPerformingAngles?: string[] | null;
  avoidedTopics?: string[] | null;
  brainFieldConfidence?: Record<string, number> | null;
  signalLog?: unknown[] | null;
  enrichmentVersion?: number | null;
}

interface AccountRow {
  id: string;
  businessType: string;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const t = raw.trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.trim() || null;
  return null;
}

function asStrArray(v: unknown, max: number): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (typeof x !== 'string') continue;
    const t = x.trim();
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= max) break;
  }
  return out.length ? out : null;
}

function allowedCaptionLength(v: unknown): 'short' | 'medium' | 'long' | null {
  const s = asStr(v);
  if (s === 'short' || s === 'medium' || s === 'long') return s;
  return null;
}

function canOverwriteField(
  field: EnrichableKey,
  brainFieldConfidence: Record<string, number>
): boolean {
  const c = brainFieldConfidence[field];
  if (c === undefined || c === null) return true;
  return c < HIGH_CONF_GUARD;
}

export async function enrichBrandBrain(accountId: string): Promise<void> {
  if (!config.openaiApiKey) {
    logger.warn('enrichBrandBrain skipped: OPENAI_API_KEY not set');
    return;
  }

  const db = await getDb();
  const account = await db.findOne<AccountRow>('accounts', { id: accountId });
  const profile = await db.findOne<ProfileRow>('business_profiles', { account_id: accountId });
  if (!account || !profile) {
    logger.warn('enrichBrandBrain: account or profile missing', { accountId });
    return;
  }

  const brainFieldConfidence: Record<string, number> = {
    ...(profile.brainFieldConfidence && typeof profile.brainFieldConfidence === 'object'
      ? profile.brainFieldConfidence
      : {}),
  };

  const currentBrain = {
    tone_of_voice: profile.toneOfVoice ?? null,
    content_persona: profile.contentPersona ?? null,
    preferred_caption_length: profile.preferredCaptionLength ?? null,
    top_performing_angles: Array.isArray(profile.topPerformingAngles) ? profile.topPerformingAngles : [],
    avoided_topics: Array.isArray(profile.avoidedTopics) ? profile.avoidedTopics : [],
  };

  const signalLog = Array.isArray(profile.signalLog) ? profile.signalLog : [];

  const userPrompt = `You refine Brand Brain fields for a local small-business social app using real user signals.

SIGNAL TYPES (each log row may include meta):
- publish — user shipped content; boost confidence in angles/topics used; meta may include postId, platform, qualityScore, studioStyle, workflow.
- regenerate — user rejected AI output; deprioritize similar angles; meta may include postId, previousAngle, reason.
- edit_caption — user changed caption text; infer preferred_caption_length from editDelta (longer vs shorter habit); meta: originalCaption, editedCaption, editDelta, postId.
- thumbs_up / thumbs_down — explicit quality; thumbs_up reinforces angles/topics; thumbs_down adds to avoided_topics.
- studio_style_selected — user picked a photo studio look; meta.context is create | template (preference already stored on profile).
- variant_selected — user picked an image variant; reinforces studio style (see meta.variantIndex).
- save_without_publish — draft saved without posting; weak neutral signal (eventual publish rate).
- topic_skip — user did not pick a suggested topic chip; meta.selectedTopic vs skipped topic id — add skipped suggestions to avoided_topics.

CURRENT BRAND BRAIN (JSON):
${JSON.stringify(currentBrain, null, 2)}

BUSINESS TYPE (account): ${account.businessType}

RECENT SIGNAL LOG (newest first, JSON array):
${JSON.stringify(signalLog.slice(0, 40), null, 2)}

PER-FIELD CONFIDENCE (0–1) — do NOT propose changes for fields where confidence >= ${HIGH_CONF_GUARD} unless the signals contain clear, direct evidence that the stored value is wrong:
${JSON.stringify(brainFieldConfidence, null, 2)}

TASK:
Return JSON ONLY with this shape:
{
  "tone_of_voice": string | null,
  "content_persona": string | null,
  "preferred_caption_length": "short" | "medium" | "long" | null,
  "top_performing_angles": string[] | null,
  "avoided_topics": string[] | null,
  "fields_touched": string[]
}

RULES:
- Only set a field to a non-null value when recent signals provide clear, direct evidence. Never invent business facts.
- If a field should stay unchanged, set it to null (meaning "no update").
- For top_performing_angles and avoided_topics: when updating, return the full merged list you recommend (max 20 strings each), deduped.
- Never contradict or dilute a high-confidence field unless signals explicitly disprove it.
- fields_touched must list which keys you actually changed from the current brain (subset of: tone_of_voice, content_persona, preferred_caption_length, top_performing_angles, avoided_topics).`;

  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: config.openaiApiKey, timeout: 45_000 });
    const resp = await client.chat.completions.create({
      model: config.openaiCaptionModel,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: enrichBrandBrainSystemPrompt() },
        { role: 'user', content: userPrompt },
      ],
    });
    const raw = resp.choices[0]?.message?.content?.trim() ?? '';
    const parsed = parseJsonObject(raw);
    if (!parsed) {
      logger.warn('enrichBrandBrain: could not parse LLM JSON', { accountId });
      return;
    }

    const patch: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    const nextConf = { ...brainFieldConfidence };

    if (canOverwriteField('tone_of_voice', brainFieldConfidence) && parsed.tone_of_voice !== undefined) {
      const v = asStr(parsed.tone_of_voice);
      if (v) {
        patch.toneOfVoice = v;
        nextConf.tone_of_voice = ENRICH_CONF;
      }
    }
    if (canOverwriteField('content_persona', brainFieldConfidence) && parsed.content_persona !== undefined) {
      const v = asStr(parsed.content_persona);
      if (v) {
        patch.contentPersona = v;
        nextConf.content_persona = ENRICH_CONF;
      }
    }
    if (
      canOverwriteField('preferred_caption_length', brainFieldConfidence) &&
      parsed.preferred_caption_length !== undefined
    ) {
      const v = allowedCaptionLength(parsed.preferred_caption_length);
      if (v) {
        patch.preferredCaptionLength = v;
        nextConf.preferred_caption_length = ENRICH_CONF;
      }
    }
    if (canOverwriteField('top_performing_angles', brainFieldConfidence) && parsed.top_performing_angles !== undefined) {
      const arr = asStrArray(parsed.top_performing_angles, 20);
      if (arr && arr.length > 0) {
        patch.topPerformingAngles = arr;
        nextConf.top_performing_angles = ENRICH_CONF;
      }
    }
    if (canOverwriteField('avoided_topics', brainFieldConfidence) && parsed.avoided_topics !== undefined) {
      const arr = asStrArray(parsed.avoided_topics, 20);
      if (arr && arr.length > 0) {
        patch.avoidedTopics = arr;
        nextConf.avoided_topics = ENRICH_CONF;
      }
    }

    const touchedAny =
      'toneOfVoice' in patch ||
      'contentPersona' in patch ||
      'preferredCaptionLength' in patch ||
      'topPerformingAngles' in patch ||
      'avoidedTopics' in patch;

    if (!touchedAny) {
      return;
    }

    patch.enrichmentVersion = Math.max(profile.enrichmentVersion ?? 2, 2) + 1;
    patch.brainFieldConfidence = nextConf;

    await db.updateOne('business_profiles', accountId, patch);
    const fieldsTouched = Object.keys(patch).filter(
      (k) => k !== 'updatedAt' && k !== 'enrichmentVersion' && k !== 'brainFieldConfidence'
    );
    void trackEvent({
      name: 'BRAND_BRAIN_ENRICHED',
      accountId,
      properties: {
        fieldsTouched,
        enrichmentVersion: patch.enrichmentVersion,
      },
    });
    logger.info('enrichBrandBrain applied', { accountId, keys: Object.keys(patch) });
  } catch (e) {
    logger.warn('enrichBrandBrain failed', {
      accountId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
