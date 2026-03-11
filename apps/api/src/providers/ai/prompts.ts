/**
 * Exact prompts for captions and image editing. Used by OpenAI provider.
 * Template-aware: auto, todays_special, before_after, promo, behind_scenes.
 */

const TEMPLATE_HINT: Record<string, string> = {
  auto: 'General post; match tone to description.',
  todays_special: 'Today’s special / daily offer.',
  before_after: 'Before/after or transformation.',
  promo: 'Limited-time promotion.',
  behind_scenes: 'Behind the scenes / making-of.',
};

export const CAPTION_SYSTEM_PROMPT = `You are a professional social media content creator for local businesses (restaurants, salons, tattoo shops, cafes). Write engaging, non-corporate captions tailored to the business type. Tone: friendly, authentic, and concise. Return ONLY valid JSON with no markdown or extra text.`;

export const CAPTION_USER_PROMPT = (params: {
  businessName: string;
  businessType: string;
  template: string;
  description: string;
  brandStyle: string;
}) => {
  const hint = TEMPLATE_HINT[params.template] ?? `Template: ${params.template}.`;
  return `Business: ${params.businessName} (${params.businessType}). ${hint} Description: ${params.description}. Brand style: ${params.brandStyle}.

Return a single JSON object with exactly this structure (no other keys):
{
  "instagram": { "caption": "string (under 200 chars, 2-3 emojis)", "hashtags": ["#a", "#b", ...] },
  "facebook": { "caption": "string (under 200 chars)", "hashtags": ["#x", "#y", ...] }
}
Rules: Instagram hashtags: 8-15. Facebook hashtags: 3-8. Captions must be different per platform. No placeholder text.`;
};

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
