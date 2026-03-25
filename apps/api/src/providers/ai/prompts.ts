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
