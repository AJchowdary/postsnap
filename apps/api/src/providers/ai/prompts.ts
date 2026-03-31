/**
 * Image-edit prompts. Caption prompts live in `services/openaiService.ts`.
 */

export { CAPTION_SYSTEM_PROMPT, buildCaptionUserPrompt } from '../../services/openaiService';

export const IMAGE_EDIT_SYSTEM_PROMPT = `You are an image enhancement assistant. Apply light, realistic enhancements. Do not distort the subject. Add branding elements within safe margins (8% from edges). Never cover the main subject. Output must be 1:1 square (1080x1080). No watermarks.`;

/** My Photo mode — stronger enhancement + optional bottom overlay bar. */
export const MY_PHOTO_IMAGE_SYSTEM_PROMPT = `You are a professional photo editor for social media. Enhance images to look polished and post-ready. Preserve composition and subject integrity. Output must be 1:1 square (1024x1024). No watermarks.`;

function firstWords(text: string, maxWords: number): string {
  const w = text.trim().split(/\s+/).filter(Boolean).slice(0, maxWords);
  return w.join(' ');
}

/**
 * In-photo overlay line for My Photo mode (bottom bar text).
 */
export function computeMyPhotoOverlayText(businessType: string, description: string): string {
  const d = description.trim();
  const words = d.split(/\s+/).filter(Boolean);
  const short = firstWords(d, 4);
  const isLong = words.length > 8;

  switch (businessType) {
    case 'restaurant':
    case 'cafe':
      if (isLong) return "Today's Special";
      return short || "Today's Special";
    case 'salon':
      if (/book|appointment/i.test(d)) return 'Book Your Appointment';
      return short.slice(0, 48) || 'Book Your Appointment';
    case 'retail':
      if (/shop now|buy now/i.test(d)) return 'Shop Now';
      if (/new|arrival|just in|drop/i.test(d)) return 'New Arrival';
      return 'New Arrival';
    case 'gym':
      return short || 'Keep Pushing';
    default:
      return short || 'Special';
  }
}

function aestheticHintsForType(businessType: string): string {
  switch (businessType) {
    case 'restaurant':
      return 'warm golden tones, appetizing, food-forward';
    case 'salon':
      return 'bright, clean, glamorous, beauty-focused';
    case 'retail':
      return 'crisp, clean product focus, commercial';
    case 'gym':
      return 'high contrast, energetic, dramatic lighting';
    case 'cafe':
      return 'warm cozy tones, artisanal feel';
    default:
      return 'professional, polished, social-media ready';
  }
}

export type MyPhotoPromptParams = {
  businessType: string;
  userDescription: string;
  overlayText: string;
};

export function buildMyPhotoImagePromptWithOverlay(params: MyPhotoPromptParams): string {
  const aesthetic = aestheticHintsForType(params.businessType);
  return `Enhance this photo to look professional and eye-catching for social media.
Business type: ${params.businessType}
Post description: ${params.userDescription}

Instructions:
1. Enhance colors — make them vivid and appealing; improve brightness, contrast, and saturation subtly.
2. Improve lighting and contrast; sharpen important details without halos.
3. Add a subtle vignette for depth (very light).
4. Add a text overlay at the bottom third of the image:
   - Semi-transparent dark bar (about 60% opacity black) spanning the full width in the lower third
   - White text: "${params.overlayText}"
   - Clean modern sans-serif font, readable but not oversized
5. Keep the main subject sharp and clear; do not crop the subject awkwardly.
6. The result should look like a professional photographer shot and edited this for social.
7. Style aesthetic: ${aesthetic}

The overlay text to add: ${params.overlayText}
Keep composition intact; enhance quality only.`;
}

export function buildMyPhotoImagePromptClean(params: {
  businessType: string;
  userDescription: string;
}): string {
  const aesthetic = aestheticHintsForType(params.businessType);
  return `Enhance this photo to look professional and eye-catching for social media.
Business type: ${params.businessType}
Post description: ${params.userDescription}

Instructions:
1. Enhance colors — vivid and appealing; improve brightness, contrast, and saturation subtly.
2. Improve lighting and contrast; sharpen important details without halos.
3. Add a subtle vignette for depth (very light).
4. Do NOT add any text, caption, logo, bar, or overlay on the image — only enhancement.
5. Keep the main subject sharp and clear.
6. Style aesthetic: ${aesthetic}
7. Output should look like a professional photographer edited this for social.
Keep composition intact; enhance quality only.`;
}

const STUDIO_STYLE_HINTS: Record<
  'clean-white' | 'lifestyle' | 'dark-dramatic' | 'flat-lay' | 'outdoor-natural',
  string
> = {
  'clean-white': 'minimal seamless off-white background, product-forward, no distractions',
  lifestyle: 'real-world contextual background, warm human feel, authentic setting',
  'dark-dramatic': 'high contrast moody scene, deep charcoal backdrop, premium dramatic lighting',
  'flat-lay': 'top-down editorial composition, textured neutral surface, clean arrangement',
  'outdoor-natural': 'natural light environment, organic textures, approachable airy mood',
};

export function buildPhotoStudioIsolationPrompt(params: {
  businessType: string;
  userDescription: string;
}): string {
  return `Isolate the main subject from this image while preserving true subject identity.
Business type: ${params.businessType}
Post description: ${params.userDescription}

Rules:
- Preserve shape, texture, color, logos, and key details of the main subject.
- Remove distracting background elements and keep clean subject edges.
- Keep realistic shadow/reflection where it improves realism.
- Do not add text, badges, or new objects.
- Keep output square and high quality.`;
}

export function buildPhotoStudioStyledPrompt(params: {
  businessType: string;
  userDescription: string;
  style: string;
  brandColor?: string | null;
  studioBgColor?: string | null;
  visualStyle?: string | null;
  brandColors?: string[] | null;
}): string {
  const rawStyle = params.style.trim();
  const styleHint =
    rawStyle in STUDIO_STYLE_HINTS
      ? STUDIO_STYLE_HINTS[rawStyle as keyof typeof STUDIO_STYLE_HINTS]
      : rawStyle.slice(0, 500);
  const palette =
    params.brandColors && params.brandColors.length
      ? params.brandColors.slice(0, 8).join(', ')
      : '';
  return `Transform this isolated subject into a studio-quality marketing scene.
Business type: ${params.businessType}
Post description: ${params.userDescription}
Style preset: ${params.style} (${styleHint})
Brand accent color: ${params.brandColor ?? 'none'}
${params.studioBgColor?.trim() ? `Preferred backdrop / studio base: ${params.studioBgColor.trim()}` : ''}
${params.visualStyle?.trim() ? `Brand visual style: ${params.visualStyle.trim()}` : ''}
${palette ? `Brand palette hints: ${palette}` : ''}

Rules:
- Keep subject identity unchanged.
- Build a polished background consistent with the style preset.
- Ensure lighting consistency between subject and background.
- Use subtle brand color harmony only when natural.
- No text, no logos, no watermark, no landmarks.`;
}

export const IMAGE_EDIT_USER_PROMPT = (params: {
  stylePreset: string;
  brandColor: string | null;
  overlayText: string | null;
  hasLogo: boolean;
}) => `Goals: Light enhancement, keep subject clear. Style: ${params.stylePreset}. Brand color: ${params.brandColor ?? 'none'}. Overlay text (2-5 words, small badge): ${params.overlayText ?? 'none'}. ${params.hasLogo ? 'Add small corner logo if provided.' : ''} Safe margin 8%; never cover subject. Output: 1:1 square 1080x1080. No watermark.`;

/**
 * Overlay badge text by template. When overlay_default_on is true, use this for the small badge.
 * auto: infer from context or empty.
 */
export function getOverlayText(
  templateId: string,
  _contextText: string,
  _businessType: string
): string {
  switch (templateId) {
    case 'todays_special':
      return "Today's Special";
    case 'before_after':
      return 'Before → After';
    case 'promo':
      return 'Limited Time';
    case 'behind_scenes':
      return 'Behind the Scenes';
    case 'auto':
    default:
      return '';
  }
}
