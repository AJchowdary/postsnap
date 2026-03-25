/**
 * Image-edit prompts. Caption prompts live in `services/openaiService.ts`.
 */

export { CAPTION_SYSTEM_PROMPT, buildCaptionUserPrompt } from '../../services/openaiService';

export const IMAGE_EDIT_SYSTEM_PROMPT = `You are an image enhancement assistant. Apply light, realistic enhancements. Do not distort the subject. Add branding elements within safe margins (8% from edges). Never cover the main subject. Output must be 1:1 square (1080x1080). No watermarks.`;

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
