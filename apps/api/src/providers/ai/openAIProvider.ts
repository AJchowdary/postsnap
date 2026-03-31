/**
 * OpenAIProvider – gpt-4o-mini (configurable) for captions; gpt-image-1 / gpt-image-1-mini for image editing.
 * Image edit uses SDK images.edit with proper input (bytes/URL), optional mask, timeout, and retry classification.
 */
import { IAIProvider, CaptionParams, CaptionResult, ImageParams, ProcessImageResult } from './IAIProvider';
import {
  CAPTION_SYSTEM_PROMPT,
  buildCaptionUserPrompt,
  MY_PHOTO_IMAGE_SYSTEM_PROMPT,
  buildMyPhotoImagePromptWithOverlay,
  buildMyPhotoImagePromptClean,
  computeMyPhotoOverlayText,
  buildPhotoStudioIsolationPrompt,
  buildPhotoStudioStyledPrompt,
} from './prompts';
import { parseCaptionJson } from './parseCaptionResponse';
import {
  buildGenericRetryInstruction,
  captionDetectionDiagnostics,
  type GenericDetectionContext,
} from './genericDetector';
import { logCaptionDetection, type DetectionLogOutcome } from '../../services/detectionLogService';
import { trackEvent } from '../../services/analyticsEvents';
import {
  buildFullQualityRetryInstruction,
  buildPartialQualityRetryInstruction,
  scoreCaption,
  scoringContextFromCaptionParams,
  type QualityScore,
} from './qualityScorer';
import { createImageEdit, buildImageInput } from './openaiImageEdit';
import { aspectCompositionHint, openaiImageSizeFromAspectPreset } from './imageAspectPreset';
import { config } from '../../config';
import sharp from 'sharp';
import {
  briefSystemPromptWhenProfile,
  captionSystemSupplementWhenProfile,
  prependQuickpostDnaToUserPrompt,
} from '../../prompts/quickpostAI';

// Default: gpt-image-1-mini; premium: gpt-image-1 (overridable via config)
const IMAGE_MODEL_DEFAULT = config.openaiImageModelDefault;
const IMAGE_MODEL_PREMIUM = config.openaiImageModelPremium;

function sanitizeForPrompt(s: string, maxLen: number = 200): string {
  return s.replace(/[\x00-\x1f]/g, '').slice(0, maxLen);
}

type CreativeBrief = {
  core_offer: string;
  audience: string;
  occasion_or_moment: string;
  voice_rules: string[];
  visual_direction: string[];
  hook_angles: string[];
  story_seed: string;
  cta_options: string[];
  local_cues: string[];
  avoid_phrases: string[];
};

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

function toGenericDetectionContext(params: CaptionParams): GenericDetectionContext {
  return {
    city: params.city?.trim() ?? '',
    services: params.coreServices?.filter((s) => !!s?.trim()) ?? [],
    heroProduct: params.heroProduct?.trim(),
    brandName: params.businessName?.trim() ?? '',
    currentMonth: new Date().getUTCMonth() + 1,
    allowsSuperlatives: false,
  };
}

function withCaptionMeta(
  caption: CaptionResult,
  meta: NonNullable<CaptionResult['meta']>
): CaptionResult {
  return { ...caption, meta };
}

function imageEditInputFromDataUrl(dataUrl: string) {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  return { type: 'base64' as const, data: m[2], mime: m[1] };
}

async function upscaleStudioOutputIfNeeded(
  image: string,
  minSide: number = 1080
): Promise<string> {
  if (!image.startsWith('data:image/')) return image;
  const m = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return image;
  try {
    const input = Buffer.from(m[2], 'base64');
    const meta = await sharp(input).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    const shortest = Math.min(w, h);
    if (!w || !h || shortest >= minSide) return image;
    const scale = minSide / shortest;
    const outW = Math.round(w * scale);
    const outH = Math.round(h * scale);
    const out = await sharp(input).resize(outW, outH, { fit: 'fill' }).png().toBuffer();
    return `data:image/png;base64,${out.toString('base64')}`;
  } catch {
    return image;
  }
}

async function passesStudioQualityGate(image: string | null): Promise<boolean> {
  if (!image) return false;
  if (image.startsWith('http://') || image.startsWith('https://')) return true;
  const m = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return false;
  try {
    const input = Buffer.from(m[2], 'base64');
    const meta = await sharp(input).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    return !!w && !!h && Math.min(w, h) >= 1080;
  } catch {
    return false;
  }
}

function normalizeBrief(row: Record<string, unknown>, fallbackDesc: string): CreativeBrief {
  const arr = (v: unknown, max = 6): string[] =>
    Array.isArray(v)
      ? v
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          .map((x) => x.trim())
          .slice(0, max)
      : [];
  return {
    core_offer:
      (typeof row.core_offer === 'string' && row.core_offer.trim()) || fallbackDesc || 'Promote the business offering.',
    audience:
      (typeof row.audience === 'string' && row.audience.trim()) || 'Local customers likely to engage today.',
    occasion_or_moment:
      (typeof row.occasion_or_moment === 'string' && row.occasion_or_moment.trim()) ||
      'A timely local moment to post.',
    voice_rules: arr(row.voice_rules),
    visual_direction: arr(row.visual_direction),
    hook_angles: arr(row.hook_angles, 8),
    story_seed:
      (typeof row.story_seed === 'string' && row.story_seed.trim()) ||
      'Share a concrete behind-the-scenes or customer moment.',
    cta_options: arr(row.cta_options),
    local_cues: arr(row.local_cues),
    avoid_phrases: arr(row.avoid_phrases, 12),
  };
}

function buildBriefRequestPromptCore(params: CaptionParams): string {
  return `You are a Creative Strategist for local businesses.
Transform rough user input into a high-signal creative brief.

INPUT:
- Business name: ${params.businessName}
- Display type: ${params.displayType ?? params.businessType}
- AI category: ${params.aiCategory ?? params.businessType}
- Brand vibe: ${params.brandVibe ?? 'warm'}
- Brand color: ${params.brandColor ?? 'n/a'}
- City: ${params.city ?? 'n/a'}
- Website summary: ${params.websiteSummary ?? 'n/a'}
- Custom context: ${params.customDescription ?? 'n/a'}
- User post request: ${params.description}
- Platform: ${params.platform ?? 'instagram'}
- Studio style: ${params.studioStylePreference ?? 'none'}
- Tone of voice: ${params.toneOfVoice ?? 'n/a'}
- Content persona: ${params.contentPersona ?? 'n/a'}
- Unique differentiator: ${params.uniqueDifferentiator ?? 'n/a'}
- Visual style: ${params.visualStyle ?? 'n/a'}
- Studio backdrop color: ${params.studioBgColor ?? 'n/a'}
- Brand palette: ${
    params.brandColors?.length
      ? params.brandColors.join(', ')
      : params.dominantColors?.length
        ? params.dominantColors.join(', ')
        : 'n/a'
  }

RULES:
- Infer concrete specifics from context, but do not invent false claims.
- Avoid generic marketing phrases.
- Include local flavor when possible.
- Create variety in tone and concept direction.
- Output ONLY JSON.

Return:
{
  "core_offer": "what exactly this post promotes",
  "audience": "who this is for",
  "occasion_or_moment": "timing/context",
  "voice_rules": ["..."],
  "visual_direction": ["..."],
  "hook_angles": [
    "angle 1 - specific",
    "angle 2 - specific",
    "angle 3 - specific"
  ],
  "story_seed": "short authentic behind-the-scenes or customer moment",
  "cta_options": ["...", "...", "..."],
  "local_cues": ["..."],
  "avoid_phrases": ["best in town", "visit us today", "limited time offer", "don’t miss out"]
}`;
}

function buildBriefRequestPrompt(params: CaptionParams): string {
  return prependQuickpostDnaToUserPrompt(buildBriefRequestPromptCore(params), params.brandProfile);
}

function buildCaptionFromBriefPromptCore(params: CaptionParams, brief: CreativeBrief): string {
  return `You are writing social captions from a prepared brief.
Do NOT write generic social media copy.

BUSINESS:
Name: ${params.businessName}
Type: ${params.displayType ?? params.businessType}
Category tone anchor: ${params.aiCategory ?? params.businessType}
Brand vibe: ${params.brandVibe ?? 'warm'}
City: ${params.city ?? 'local area'}
Platform: ${params.platform ?? 'instagram'}
Template style: ${params.template}
Studio style: ${params.studioStylePreference ?? 'none'}
Tone of voice: ${params.toneOfVoice ?? 'n/a'}
Content persona: ${params.contentPersona ?? 'n/a'}
Differentiator: ${params.uniqueDifferentiator ?? 'n/a'}
Visual style: ${params.visualStyle ?? 'n/a'}
Original user request: ${params.description}

BRIEF JSON:
${JSON.stringify(brief, null, 2)}

CONSTRAINTS:
- Each caption must use a different hook angle.
- Mention one concrete detail (item, service, experience, or outcome).
- STORY caption must feel human and specific, 80-120 words.
- No empty hype. No clichés from avoid_phrases.
- Hashtags must be contextual and varied.
- If studio style is provided, align caption mood with that visual style and reference visual context naturally.

OUTPUT JSON ONLY:
{
  "captions": [
    {"type": "hook", "text": "..."},
    {"type": "story", "text": "..."},
    {"type": "cta", "text": "..."}
  ]
}`;
}

function buildCaptionFromBriefPrompt(params: CaptionParams, brief: CreativeBrief): string {
  return prependQuickpostDnaToUserPrompt(buildCaptionFromBriefPromptCore(params, brief), params.brandProfile);
}

export class OpenAIProvider implements IAIProvider {
  async generateCaption(params: CaptionParams): Promise<CaptionResult> {
    if (!config.openaiApiKey) {
      throw new Error('AI caption generation is not configured (missing OPENAI_API_KEY).');
    }
    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: config.openaiApiKey, timeout: 30_000 });
      const safeParams: CaptionParams = {
        ...params,
        businessName: sanitizeForPrompt(params.businessName, 100),
        displayType: sanitizeForPrompt(params.displayType ?? params.businessType, 80),
        aiCategory: sanitizeForPrompt(params.aiCategory ?? params.businessType, 32),
        customDescription: sanitizeForPrompt(params.customDescription ?? '', 400),
        brandColor: params.brandColor ? sanitizeForPrompt(params.brandColor, 32) : undefined,
        brandVibe: params.brandVibe ? sanitizeForPrompt(params.brandVibe, 24) : undefined,
        websiteSummary: params.websiteSummary
          ? sanitizeForPrompt(params.websiteSummary, 800)
          : undefined,
        city: params.city ? sanitizeForPrompt(params.city, 80) : undefined,
        instagramHandle: params.instagramHandle
          ? sanitizeForPrompt(params.instagramHandle, 80)
          : undefined,
        studioStylePreference: params.studioStylePreference,
        toneOfVoice: params.toneOfVoice ? sanitizeForPrompt(params.toneOfVoice, 80) : undefined,
        contentPersona: params.contentPersona ? sanitizeForPrompt(params.contentPersona, 200) : undefined,
        uniqueDifferentiator: params.uniqueDifferentiator
          ? sanitizeForPrompt(params.uniqueDifferentiator, 300)
          : undefined,
        visualStyle: params.visualStyle ? sanitizeForPrompt(params.visualStyle, 80) : undefined,
        studioBgColor: params.studioBgColor ? sanitizeForPrompt(params.studioBgColor, 32) : undefined,
        brandColors: params.brandColors?.length
          ? params.brandColors.map((c) => sanitizeForPrompt(c, 16)).slice(0, 12)
          : params.dominantColors?.length
            ? params.dominantColors.map((c) => sanitizeForPrompt(c, 16)).slice(0, 12)
            : undefined,
        template: sanitizeForPrompt(params.template, 80),
        description: sanitizeForPrompt(params.description, 500),
        platform: sanitizeForPrompt(params.platform ?? 'Instagram & Facebook', 80),
        coreServices: params.coreServices?.length
          ? params.coreServices.map((s) => sanitizeForPrompt(s, 120)).slice(0, 20)
          : undefined,
        heroProduct: params.heroProduct ? sanitizeForPrompt(params.heroProduct, 200) : undefined,
        detectionContext: params.detectionContext,
        neighborhood: params.neighborhood ? sanitizeForPrompt(params.neighborhood, 120) : undefined,
        brandProfile: params.brandProfile,
      };
      const briefPrompt = buildBriefRequestPrompt(safeParams);
      const hasDna = !!safeParams.brandProfile;
      const briefResp = await client.chat.completions.create({
        model: config.openaiCaptionModel,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: briefSystemPromptWhenProfile(hasDna) },
          { role: 'user', content: briefPrompt },
        ],
      });
      const briefRaw = briefResp.choices[0]?.message?.content?.trim() || '';
      const briefParsed = parseJsonObject(briefRaw) ?? {};
      const brief = normalizeBrief(briefParsed, safeParams.description);
      const userContent = buildCaptionFromBriefPrompt(safeParams, brief);
      const ctx = toGenericDetectionContext(safeParams);
      const detAccount = safeParams.detectionContext?.accountId;
      const detPost = safeParams.detectionContext?.postId;
      const logSrc = safeParams.detectionContext?.source ?? 'api';

      const logDet = async (
        outcome: DetectionLogOutcome,
        diag: ReturnType<typeof captionDetectionDiagnostics>
      ) => {
        await logCaptionDetection({
          accountId: detAccount,
          postId: detPost,
          outcome,
          result: {
            isGeneric: diag.isGeneric,
            reasons: diag.reasons,
            score: diag.score,
          },
          softFlags: diag.softFlags,
          source: logSrc,
        });
      };

      const runOnce = async (extraInstruction?: string) =>
        client.chat.completions.create({
          model: config.openaiCaptionModel,
          max_tokens: 2500,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: CAPTION_SYSTEM_PROMPT + captionSystemSupplementWhenProfile(hasDna),
            },
            {
              role: 'user',
              content: `${userContent}\n${extraInstruction ?? ''}`.trim(),
            },
          ],
        });

      const IMPORTANT_RETRY =
        'IMPORTANT: Story caption must be 80-120 words and narrative. Avoid clichés and generic lines like "visit us today", "best in town", "limited time offer". Return valid JSON only with captions array.';

      const mergeQualityMeta = (
        q: QualityScore,
        qualityRetryCount: number,
        base: NonNullable<CaptionResult['meta']>
      ): NonNullable<CaptionResult['meta']> => ({
        ...base,
        qualityScore: q.total,
        qualityDimensions: q.dimensions,
        qualityVerdict: q.verdict,
        qualityRetryCount,
      });

      const finalizeWithQuality = async (
        captionResult: CaptionResult,
        baseMeta: NonNullable<CaptionResult['meta']>
      ): Promise<CaptionResult> => {
        const scoringCtx = scoringContextFromCaptionParams(safeParams, safeParams.neighborhood);
        let q = scoreCaption(captionResult.instagram.caption, scoringCtx);
        let out = captionResult;
        let attempts = baseMeta.attempts;

        if (q.verdict === 'deliver') {
          return withCaptionMeta(out, mergeQualityMeta(q, 0, baseMeta));
        }

        if (q.verdict === 'retry-partial') {
          if (detAccount) {
            void trackEvent({
              name: 'QUALITY_RETRY_TRIGGERED',
              accountId: detAccount,
              postId: detPost ?? null,
              properties: { strategy: 'partial' },
            });
          }
          const extra = buildPartialQualityRetryInstruction(q.weakestDimension);
          const resp = await runOnce(extra);
          const raw = resp.choices[0]?.message?.content?.trim();
          const parsed = raw ? parseCaptionJson(raw) : null;
          const qualityRetryCount = 1;
          attempts += 1;
          if (parsed) {
            out = parsed;
            q = scoreCaption(out.instagram.caption, scoringCtx);
          }
          return withCaptionMeta(out, {
            ...mergeQualityMeta(q, qualityRetryCount, baseMeta),
            attempts,
            strategy: 'brief-retry',
            reason: baseMeta.reason ?? 'quality_partial_retry',
          });
        }

        if (detAccount) {
          void trackEvent({
            name: 'QUALITY_RETRY_TRIGGERED',
            accountId: detAccount,
            postId: detPost ?? null,
            properties: { strategy: 'full' },
          });
        }
        const fullExtra = buildFullQualityRetryInstruction();
        const fullResp = await runOnce(fullExtra);
        const fullRaw = fullResp.choices[0]?.message?.content?.trim();
        const fullParsed = fullRaw ? parseCaptionJson(fullRaw) : null;
        const qualityRetryCount = 1;
        attempts += 1;
        if (fullParsed) {
          out = fullParsed;
          q = scoreCaption(out.instagram.caption, scoringCtx);
        }
        return withCaptionMeta(out, {
          ...mergeQualityMeta(q, qualityRetryCount, baseMeta),
          attempts,
          strategy: 'brief-retry',
          reason: baseMeta.reason ?? 'quality_full_retry',
        });
      };

      const firstResp = await runOnce();
      const firstRaw = firstResp.choices[0]?.message?.content?.trim();
      const firstParsed = firstRaw ? parseCaptionJson(firstRaw) : null;

      if (firstParsed) {
        const d1 = captionDetectionDiagnostics(firstParsed.instagram.caption, ctx);
        await logDet(d1.isGeneric ? 'fail_retry' : 'pass', d1);
        if (!d1.isGeneric) {
          return finalizeWithQuality(firstParsed, {
            attempts: 1,
            strategy: 'brief-primary',
          });
        }
        const genResp = await runOnce(buildGenericRetryInstruction(d1.reasons));
        const genRaw = genResp.choices[0]?.message?.content?.trim();
        const genParsed = genRaw ? parseCaptionJson(genRaw) : null;
        if (genParsed) {
          const d2 = captionDetectionDiagnostics(genParsed.instagram.caption, ctx);
          await logDet(d2.isGeneric ? 'deliver_after_fail' : 'pass', d2);
          return finalizeWithQuality(genParsed, {
            attempts: 2,
            strategy: 'brief-retry',
            reason: d2.isGeneric ? 'generic_detection_failed_after_retry' : undefined,
          });
        }
      }

      const secondResp = await runOnce(IMPORTANT_RETRY);
      const secondRaw = secondResp.choices[0]?.message?.content?.trim();
      const secondParsed = secondRaw ? parseCaptionJson(secondRaw) : null;
      if (secondParsed) {
        const d3 = captionDetectionDiagnostics(secondParsed.instagram.caption, ctx);
        await logDet(d3.isGeneric ? 'deliver_after_fail' : 'pass', d3);
        return finalizeWithQuality(secondParsed, {
          attempts: firstParsed ? 3 : 2,
          strategy: 'brief-retry',
          reason: d3.isGeneric ? 'generic_detection_after_important_retry' : undefined,
        });
      }

      const legacyPrompt = prependQuickpostDnaToUserPrompt(
        buildCaptionUserPrompt({
          businessName: safeParams.businessName,
          displayType: safeParams.displayType ?? safeParams.businessType,
          aiCategory: safeParams.aiCategory ?? safeParams.businessType,
          customDescription: safeParams.customDescription ?? '',
          brandColor: safeParams.brandColor,
          brandVibe: safeParams.brandVibe,
          dominantColors: safeParams.dominantColors,
          websiteSummary: safeParams.websiteSummary,
          city: safeParams.city,
          instagramHandle: safeParams.instagramHandle,
          templateStyle: safeParams.template,
          userDescription: safeParams.description,
          platform: safeParams.platform ?? 'Instagram & Facebook',
          toneOfVoice: safeParams.toneOfVoice,
          contentPersona: safeParams.contentPersona,
          uniqueDifferentiator: safeParams.uniqueDifferentiator,
          visualStyle: safeParams.visualStyle,
          studioStylePreference: safeParams.studioStylePreference,
        }),
        safeParams.brandProfile
      );
      const legacyResp = await client.chat.completions.create({
        model: config.openaiCaptionModel,
        max_tokens: 2500,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: CAPTION_SYSTEM_PROMPT + captionSystemSupplementWhenProfile(hasDna),
          },
          { role: 'user', content: legacyPrompt },
        ],
      });
      const legacyRaw = legacyResp.choices[0]?.message?.content?.trim() || '';
      const legacyParsed = legacyRaw ? parseCaptionJson(legacyRaw) : null;
      if (legacyParsed) {
        const d4 = captionDetectionDiagnostics(legacyParsed.instagram.caption, ctx);
        await logDet(d4.isGeneric ? 'deliver_after_fail' : 'pass', d4);
        return finalizeWithQuality(legacyParsed, {
          attempts: firstParsed ? 4 : 3,
          strategy: 'legacy-fallback',
          reason: d4.isGeneric ? 'generic_detection_after_legacy' : undefined,
        });
      }

      throw new Error('AI caption output is too generic or could not be parsed.');
    } catch (e) {
      throw new Error(
        e instanceof Error ? e.message : 'AI caption generation failed.'
      );
    }
  }

  async processImage(params: ImageParams): Promise<ProcessImageResult | null> {
    if (!config.openaiApiKey) return null;
    const outSize = openaiImageSizeFromAspectPreset(params.aspectPreset);
    const aspectHint = aspectCompositionHint(params.aspectPreset);
    const imageInput = buildImageInput({
      photoBase64: params.photoBase64,
      imagePath: params.imagePath,
    });
    if (!imageInput) {
      const textPrompt = sanitizeForPrompt(params.description ?? '', 700);
      if (!textPrompt) return null;
      try {
        const { default: OpenAI } = await import('openai');
        const client = new OpenAI({ apiKey: config.openaiApiKey, timeout: 45_000 });
        const briefParams: CaptionParams = {
          description: textPrompt,
          template: params.templateId ?? 'auto',
          businessName: params.businessName,
          businessType: params.businessType,
          brandStyle: params.brandStyle,
          displayType: params.displayType,
          aiCategory: params.aiCategory,
          customDescription: params.customDescription,
          brandColor: params.brandColor ?? undefined,
          brandVibe: params.brandVibe,
          dominantColors: params.dominantColors,
          websiteSummary: params.websiteSummary,
          city: params.city,
          instagramHandle: params.instagramHandle,
          platform: 'instagram',
          studioStylePreference: params.studioStylePreference,
          toneOfVoice: params.toneOfVoice,
          contentPersona: params.contentPersona,
          uniqueDifferentiator: params.uniqueDifferentiator,
          visualStyle: params.visualStyle,
          studioBgColor: params.studioBgColor,
          brandColors: params.brandColors?.length ? params.brandColors : params.dominantColors,
          brandProfile: params.brandProfile,
        };
        const briefHasDna = !!briefParams.brandProfile;
        const briefResp = await client.chat.completions.create({
          model: config.openaiCaptionModel,
          max_tokens: 1000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: briefSystemPromptWhenProfile(briefHasDna) },
            { role: 'user', content: buildBriefRequestPrompt(briefParams) },
          ],
        });
        const briefRaw = briefResp.choices[0]?.message?.content?.trim() || '';
        const briefParsed = parseJsonObject(briefRaw) ?? {};
        const brief = normalizeBrief(briefParsed, textPrompt);
        const prompt = `Create a social-media-ready image concept from this brief.
Avoid generic stock-like composition.

BRIEF JSON:
${JSON.stringify(brief, null, 2)}

HARD RULES:
- Choose ONE hook_angle and reflect it visually.
- Include one concrete object/detail tied to core_offer.
- Match vibe: ${params.brandVibe ?? 'warm'}; color accents: ${params.brandColor ?? '#2A9D8F'}.
- If text overlay is included, keep it short (2-5 words), specific, and non-generic.
- Composition should feel campaign-ready, not random decorative.
- No watermark, no gibberish text.
- ${aspectHint}`;

        const preferredModel = params.premiumQuality ? IMAGE_MODEL_PREMIUM : IMAGE_MODEL_DEFAULT;
        const modelCandidates = Array.from(new Set([preferredModel, 'gpt-image-1'].filter(Boolean)));

        for (const model of modelCandidates) {
          try {
            const response = await client.images.generate({
              model,
              prompt,
              size: outSize,
              quality: 'auto',
              n: 1,
            });
            const first = response.data?.[0];
            if (first?.b64_json) {
              return { withOverlay: `data:image/png;base64,${first.b64_json}`, clean: null };
            }
            if (first?.url) {
              return { withOverlay: first.url, clean: null };
            }
          } catch (err) {
            // Try next candidate model; keep server alive even if one model is unavailable.
            const reason = err instanceof Error ? err.message : 'unknown';
            console.warn(`[openai.image.generate] model=${model} failed: ${reason}`);
          }
        }
        return null;
      } catch {
        return null;
      }
    }

    const model = params.premiumQuality ? IMAGE_MODEL_PREMIUM : IMAGE_MODEL_DEFAULT;

    if (params.studioStylePreference) {
      const studioDesc = sanitizeForPrompt(params.description ?? '', 500);
      const isolationPrompt = `${MY_PHOTO_IMAGE_SYSTEM_PROMPT}\n\n${buildPhotoStudioIsolationPrompt({
        businessType: sanitizeForPrompt(params.businessType, 32),
        userDescription: studioDesc,
      })}`;
      const isolated = await createImageEdit({
        image: imageInput,
        mask: undefined,
        prompt: isolationPrompt,
        model,
        size: outSize,
        quality: 'auto',
      });
      const isoInput = isolated ? imageEditInputFromDataUrl(isolated) : null;
      if (!isoInput) return null;
      const paletteForStudio =
        params.brandColors?.length ? params.brandColors : params.dominantColors ?? null;
      const styledPrompt = `${MY_PHOTO_IMAGE_SYSTEM_PROMPT}\n\n${buildPhotoStudioStyledPrompt({
        businessType: sanitizeForPrompt(params.businessType, 32),
        userDescription: studioDesc,
        style: params.studioStylePreference,
        brandColor: params.brandColor ?? null,
        studioBgColor: params.studioBgColor ?? null,
        visualStyle: params.visualStyle ? sanitizeForPrompt(params.visualStyle, 80) : null,
        brandColors: paletteForStudio,
      })}`;
      const runStudioStyled = async (extraRule?: string) =>
        createImageEdit({
          image: isoInput,
          mask: undefined,
          prompt: `${styledPrompt}\n${extraRule ?? ''}`.trim(),
          model,
          size: outSize,
          quality: 'auto',
        });
      const variantRules = [
        'Variant A: centered composition, clean focus on subject.',
        'Variant B: slight angle shift and depth layering while preserving identity.',
        'Variant C: brand-color accent emphasis in background details only.',
        'Variant D: more editorial framing with balanced negative space.',
      ];
      const variantResults = await Promise.all(
        variantRules.map(async (rule) => {
          let out = await runStudioStyled(rule);
          if (out) out = await upscaleStudioOutputIfNeeded(out, 1080);
          if (!(await passesStudioQualityGate(out))) {
            out = await runStudioStyled(
              `${rule}\nQUALITY RETRY: preserve subject identity exactly, improve edge realism, and maintain clean high-resolution output. No text, no logos, no artifacts.`
            );
            if (out) out = await upscaleStudioOutputIfNeeded(out, 1080);
          }
          return (await passesStudioQualityGate(out)) ? out : null;
        })
      );
      const variants = variantResults.filter((v): v is string => !!v);
      if (variants.length === 0) return null;
      return { withOverlay: null, clean: variants[0], variants };
    }

    const overlayText =
      params.overlayText?.trim() ||
      computeMyPhotoOverlayText(params.businessType, params.description ?? '');

    const paletteLine =
      (params.brandColors?.length ? params.brandColors : params.dominantColors)?.slice(0, 8).join(', ') ||
      '';
    const dnaExtra = [
      params.brandVibe && `Brand vibe: ${sanitizeForPrompt(params.brandVibe, 40)}`,
      params.websiteSummary && `Brand story: ${sanitizeForPrompt(params.websiteSummary, 240)}`,
      params.city && `Location: ${sanitizeForPrompt(params.city, 60)}`,
      params.toneOfVoice && `Tone: ${sanitizeForPrompt(params.toneOfVoice, 60)}`,
      params.contentPersona && `Persona: ${sanitizeForPrompt(params.contentPersona, 120)}`,
      params.uniqueDifferentiator && `Differentiator: ${sanitizeForPrompt(params.uniqueDifferentiator, 160)}`,
      params.visualStyle && `Visual style: ${sanitizeForPrompt(params.visualStyle, 60)}`,
      params.studioBgColor && `Studio backdrop: ${sanitizeForPrompt(params.studioBgColor, 32)}`,
      paletteLine && `Palette: ${sanitizeForPrompt(paletteLine, 120)}`,
    ]
      .filter(Boolean)
      .join(' ');
    const userDesc = sanitizeForPrompt(
      [params.description ?? '', dnaExtra].filter(Boolean).join('\n'),
      500
    );
    const withPrompt = `${MY_PHOTO_IMAGE_SYSTEM_PROMPT}\n\n${buildMyPhotoImagePromptWithOverlay({
      businessType: sanitizeForPrompt(params.businessType, 32),
      userDescription: userDesc,
      overlayText: sanitizeForPrompt(overlayText, 80),
    })}`;
    const cleanPrompt = `${MY_PHOTO_IMAGE_SYSTEM_PROMPT}\n\n${buildMyPhotoImagePromptClean({
      businessType: sanitizeForPrompt(params.businessType, 32),
      userDescription: userDesc,
    })}`;

    const [withOverlay, clean] = await Promise.all([
      createImageEdit({
        image: imageInput,
        mask: undefined,
        prompt: withPrompt,
        model,
        size: outSize,
        quality: 'auto',
      }),
      createImageEdit({
        image: imageInput,
        mask: undefined,
        prompt: cleanPrompt,
        model,
        size: outSize,
        quality: 'auto',
      }),
    ]);

    return { withOverlay, clean };
  }
}
