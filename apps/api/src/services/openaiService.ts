/**
 * Caption generation prompt text — shared by OpenAI provider.
 * Keeps business context (display label vs AI tone bucket) explicit for the model.
 */

export type CaptionPromptParams = {
  businessName: string;
  /** User-facing business label, e.g. "Dog Grooming Salon" */
  displayType: string;
  /** Tone / template bucket, e.g. salon, retail */
  aiCategory: string;
  /** Extra nuance: custom search text, niche, etc. */
  customDescription: string;
  templateStyle: string;
  userDescription: string;
  platform: string;
};

export const CAPTION_SYSTEM_PROMPT = `You are a social media content expert. Follow the user instructions exactly. Output ONLY valid JSON with no markdown fences or extra text.`;

export function buildCaptionUserPrompt(params: CaptionPromptParams): string {
  const businessName = params.businessName || 'My Business';
  const displayType = params.displayType || params.aiCategory || 'business';
  const cat = params.aiCategory || 'retail';
  const extra = (params.customDescription || '').trim();

  const contextBlock = [
    `Business Display Name: ${businessName}`,
    `Business Type: ${displayType}`,
    `AI Category Hint: ${cat}`,
    extra ? `Additional Context: ${extra}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `You are a social media content expert for small local businesses. Create authentic, engaging captions.

${contextBlock}
Post description: ${params.userDescription}
Visual style: ${params.templateStyle}
Platform: ${params.platform}

Use AI Category Hint (${cat}) for tone, pacing, and hashtag style — but always speak to the ACTUAL business described in Business Type and Additional Context (not generic examples from that category).

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

Tone guide by AI category (apply flexibly to the specific business):
- restaurant: warm, community, "come hungry leave happy" energy
- salon: confident, empowering, transformation focused (works for grooming, beauty, personal care — adapt to species/service in Additional Context)
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
}
