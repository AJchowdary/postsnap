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
} from './prompts';
import { parseCaptionJson } from './parseCaptionResponse';
import { createImageEdit, buildImageInput } from './openaiImageEdit';
import { MockAIProvider } from './mockAIProvider';
import { config } from '../../config';

// Default: gpt-image-1-mini; premium: gpt-image-1 (overridable via config)
const IMAGE_MODEL_DEFAULT = config.openaiImageModelDefault;
const IMAGE_MODEL_PREMIUM = config.openaiImageModelPremium;

const fallback = new MockAIProvider();

function sanitizeForPrompt(s: string, maxLen: number = 200): string {
  return s.replace(/[\x00-\x1f]/g, '').slice(0, maxLen);
}

export class OpenAIProvider implements IAIProvider {
  async generateCaption(params: CaptionParams): Promise<CaptionResult> {
    if (!config.openaiApiKey) return fallback.generateCaption(params);
    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: config.openaiApiKey, timeout: 30_000 });
      const userContent = buildCaptionUserPrompt({
        businessName: sanitizeForPrompt(params.businessName, 100),
        displayType: sanitizeForPrompt(params.displayType ?? params.businessType, 80),
        aiCategory: sanitizeForPrompt(params.aiCategory ?? params.businessType, 32),
        customDescription: sanitizeForPrompt(params.customDescription ?? '', 400),
        brandColor: params.brandColor ? sanitizeForPrompt(params.brandColor, 32) : undefined,
        brandVibe: params.brandVibe ? sanitizeForPrompt(params.brandVibe, 24) : undefined,
        dominantColors: params.dominantColors,
        websiteSummary: params.websiteSummary
          ? sanitizeForPrompt(params.websiteSummary, 800)
          : undefined,
        city: params.city ? sanitizeForPrompt(params.city, 80) : undefined,
        instagramHandle: params.instagramHandle
          ? sanitizeForPrompt(params.instagramHandle, 80)
          : undefined,
        templateStyle: sanitizeForPrompt(params.template, 80),
        userDescription: sanitizeForPrompt(params.description, 500),
        platform: sanitizeForPrompt(params.platform ?? 'Instagram & Facebook', 80),
      });
      const response = await client.chat.completions.create({
        model: config.openaiCaptionModel,
        max_tokens: 2500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: CAPTION_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      });
      const raw = response.choices[0]?.message?.content?.trim();
      if (!raw) return fallback.generateCaption(params);
      const result = parseCaptionJson(raw);
      if (result) return result;
      return fallback.generateCaption(params);
    } catch {
      return fallback.generateCaption(params);
    }
  }

  async processImage(params: ImageParams): Promise<ProcessImageResult | null> {
    if (!config.openaiApiKey) return null;
    const imageInput = buildImageInput({
      photoBase64: params.photoBase64,
      imagePath: params.imagePath,
    });
    if (!imageInput) return null;

    const model = params.premiumQuality ? IMAGE_MODEL_PREMIUM : IMAGE_MODEL_DEFAULT;

    const overlayText =
      params.overlayText?.trim() ||
      computeMyPhotoOverlayText(params.businessType, params.description ?? '');

    const dnaExtra = [
      params.brandVibe && `Brand vibe: ${sanitizeForPrompt(params.brandVibe, 40)}`,
      params.websiteSummary && `Brand story: ${sanitizeForPrompt(params.websiteSummary, 240)}`,
      params.city && `Location: ${sanitizeForPrompt(params.city, 60)}`,
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
        size: '1024x1024',
        quality: 'auto',
      }),
      createImageEdit({
        image: imageInput,
        mask: undefined,
        prompt: cleanPrompt,
        model,
        size: '1024x1024',
        quality: 'auto',
      }),
    ]);

    return { withOverlay, clean };
  }
}
