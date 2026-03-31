/**
 * Social output presets for `/generate/image` — mapped to OpenAI image sizes.
 * - square: 1:1
 * - feed: wide landscape (~3:2) — typical feed cards
 * - story: tall portrait (~2:3) — stories / vertical
 * - landscape: wide 16:9 (YouTube-style)
 */
export const IMAGE_ASPECT_PRESETS = ['square', 'feed', 'story', 'landscape'] as const;
export type ImageAspectPreset = (typeof IMAGE_ASPECT_PRESETS)[number];

export function openaiImageSizeFromAspectPreset(
  preset: ImageAspectPreset | undefined
): '1024x1024' | '1536x1024' | '1024x1536' {
  switch (preset) {
    case 'feed':
      return '1536x1024';
    /** Wide 16:9 framing in prompts; OpenAI image API uses the same wide bucket as feed (1536×1024). */
    case 'landscape':
      return '1536x1024';
    case 'story':
      return '1024x1536';
    case 'square':
    default:
      return '1024x1024';
  }
}

export function aspectCompositionHint(preset: ImageAspectPreset | undefined): string {
  switch (preset) {
    case 'feed':
      return 'Composition: wide landscape (3:2), hero-style framing for feed.';
    case 'landscape':
      return 'Composition: wide landscape (16:9), cinematic horizontal framing.';
    case 'story':
      return 'Composition: tall vertical (2:3), full-bleed story-style framing.';
    case 'square':
    default:
      return 'Composition: square 1:1, balanced center-weighted framing.';
  }
}
