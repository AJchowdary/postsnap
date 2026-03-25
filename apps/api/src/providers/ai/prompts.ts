/**
 * Caption prompts for OpenAI provider.
 * Model returns JSON: { "captions": [ { "type": "hook"|"story"|"cta", "text": "..." } ] }
 */

export const CAPTION_SYSTEM_PROMPT = `You are a social media content expert. Follow the user instructions exactly. Output ONLY valid JSON with no markdown fences or extra text.`;

export const CAPTION_USER_PROMPT = (params: {
  businessName: string;
  businessType: string;
  templateStyle: string;
  userDescription: string;
  platform: string;
}) => `You are a social media content expert for small local businesses. Create authentic, engaging captions.

Business: ${params.businessName} (${params.businessType})
Post description: ${params.userDescription}
Visual style: ${params.templateStyle}
Platform: ${params.platform}

Generate 3 caption options:

CAPTION 1 — Hook & Punch (max 60 words)
Start with an attention-grabbing first line.
Be direct, confident, conversational.
End with ONE relevant emoji.
Include 5 hashtags.

CAPTION 2 — Story & Connect (80-120 words)
Tell a mini story or share a behind-the-scenes moment.
Make it feel personal and authentic.
Sound like the owner wrote it, not a marketing team.
Include 6-8 hashtags.

CAPTION 3 — CTA Focus (max 80 words)
Build desire then drive action.
Use "you" language to speak directly to customer.
Clear call to action at the end.
Include 5-6 hashtags.

Tone guide by business type:
- restaurant: warm, community, "come hungry leave happy" energy
- salon: confident, empowering, transformation focused
- retail: exciting, FOMO-inducing, trend-aware
- gym: motivational, results-driven, no excuses energy
- cafe: cozy, artisanal, slow-living lifestyle

NEVER use: synergy, leverage, cutting-edge, innovative, seamlessly, game-changer

Format response as JSON:
{
  "captions": [
    {"type": "hook", "text": "..."},
    {"type": "story", "text": "..."},
    {"type": "cta", "text": "..."}
  ]
}`;

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
