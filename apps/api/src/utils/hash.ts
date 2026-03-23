import { createHash } from 'crypto';

/**
 * Deterministic hash for generation cache/dedupe.
 * hash = sha256(original_image_path + template_id + context_text + brand_style + brand_color + overlay_default_on + logo_url + overlay_text + model_quality)
 */
export function generationHash(params: {
  originalImagePath: string | null;
  templateId: string;
  contextText: string;
  brandStyle: string;
  brandColor: string | null;
  overlayDefaultOn: boolean;
  logoUrl: string | null;
  overlayText: string | null;
  modelQuality: string;
}): string {
  const parts = [
    params.originalImagePath ?? '',
    params.templateId,
    params.contextText,
    params.brandStyle,
    params.brandColor ?? '',
    String(params.overlayDefaultOn),
    params.logoUrl ?? '',
    params.overlayText ?? '',
    params.modelQuality,
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

/**
 * Cache hit: same hash and we already have captions and (processed image or no original).
 * When true, worker skips OpenAI and does not increment regen_count.
 */
export function isGenerationCacheHit(
  post: {
    lastGeneratedHash?: string | null;
    captionJson?: Record<string, unknown> | null;
    processedImagePath?: string | null;
    originalImagePath?: string | null;
  },
  hash: string
): boolean {
  return (
    post.lastGeneratedHash === hash &&
    !!post.captionJson &&
    (!!post.processedImagePath || !post.originalImagePath)
  );
}
