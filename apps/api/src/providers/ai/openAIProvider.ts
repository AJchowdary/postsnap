/**
 * OpenAIProvider – gpt-5-mini (configurable) for captions; gpt-image-1 / gpt-image-1-mini for image editing.
 * Image edit uses SDK images.edit with proper input (bytes/URL), optional mask, timeout, and retry classification.
 */
import { IAIProvider, CaptionParams, CaptionResult, ImageParams } from './IAIProvider';
import { CAPTION_SYSTEM_PROMPT, CAPTION_USER_PROMPT, IMAGE_EDIT_SYSTEM_PROMPT, IMAGE_EDIT_USER_PROMPT } from './prompts';
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
      const client = new OpenAI({ apiKey: config.openaiApiKey });
      const userContent = CAPTION_USER_PROMPT({
        businessName: sanitizeForPrompt(params.businessName, 100),
        businessType: sanitizeForPrompt(params.businessType, 50),
        template: sanitizeForPrompt(params.template, 50),
        description: sanitizeForPrompt(params.description, 300),
        brandStyle: sanitizeForPrompt(params.brandStyle, 20),
      });
      const response = await client.chat.completions.create({
        model: config.openaiCaptionModel,
        max_tokens: 400,
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

  async processImage(params: ImageParams): Promise<string | null> {
    if (!config.openaiApiKey) return null;
    const imageInput = buildImageInput({
      photoBase64: params.photoBase64,
      imagePath: params.imagePath,
    });
    if (!imageInput) return null;

    const model = params.premiumQuality ? IMAGE_MODEL_PREMIUM : IMAGE_MODEL_DEFAULT;
    const stylePreset = params.brandStyle === 'bold' ? 'bold' : params.brandStyle === 'minimal' ? 'minimal' : 'clean';
    const prompt = IMAGE_EDIT_USER_PROMPT({
      stylePreset,
      brandColor: params.brandColor ?? null,
      overlayText: params.overlayText ?? null,
      hasLogo: !!params.logoUrl,
    });

    const result = await createImageEdit({
      image: imageInput,
      mask: undefined,
      prompt,
      model,
      size: '1024x1024',
      quality: 'auto',
    });
    return result;
  }
}
