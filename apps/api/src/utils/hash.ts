import { createHash } from 'crypto';

/**
 * Deterministic hash for generation cache/dedupe.
 * Includes studio + Brand Brain fields that affect caption/image output (worker + interactive flows).
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
  /** Studio preference when a source image exists; empty when no photo (matches Create flow). */
  studioStylePreference?: string | null;
  /** Serialized Brand Brain slice passed into AI (tone, persona, palette, etc.). */
  brandBrainFingerprint?: string | null;
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
    params.studioStylePreference ?? '',
    params.brandBrainFingerprint ?? '',
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

/** Stable string for cache invalidation when Brand Brain / studio inputs change. */
export function brandBrainGenerationFingerprint(parts: {
  studioStylePreference?: string | null;
  toneOfVoice?: string | null;
  contentPersona?: string | null;
  uniqueDifferentiator?: string | null;
  visualStyle?: string | null;
  studioBgColor?: string | null;
  dominantColors?: string[] | null;
}): string {
  const dom = (parts.dominantColors ?? []).map((c) => c.trim().toLowerCase()).join(',');
  return [
    parts.studioStylePreference ?? '',
    (parts.toneOfVoice ?? '').trim(),
    (parts.contentPersona ?? '').trim(),
    (parts.uniqueDifferentiator ?? '').trim(),
    (parts.visualStyle ?? '').trim(),
    (parts.studioBgColor ?? '').trim(),
    dom,
  ].join('\x1e');
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
