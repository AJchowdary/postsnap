/**
 * Caption generation prompt text — shared by OpenAI provider.
 * Brand DNA (website scan + onboarding) is folded into the user prompt.
 */

export type CaptionPromptParams = {
  businessName: string;
  displayType: string;
  aiCategory: string;
  customDescription?: string;
  brandColor?: string;
  brandVibe?: string;
  dominantColors?: string[];
  websiteSummary?: string;
  city?: string;
  instagramHandle?: string;
  templateStyle: string;
  platform: string;
  userDescription: string;
};

export const CAPTION_SYSTEM_PROMPT = `You are a social media content expert. Follow the user instructions exactly. Output ONLY valid JSON with no markdown fences or extra text.`;

export function buildCaptionUserPrompt(params: CaptionPromptParams): string {
  const vibeGuide: Record<string, string> = {
    professional:
      'Clean polished language. Expert positioning. No slang. Trustworthy and authoritative.',
    bold: 'Energetic punchy words. Short sentences. Create urgency and excitement. Make people stop scrolling.',
    warm: 'Conversational and personal. Use "we" and "our community". Feels like a local favourite. Cozy and welcoming.',
  };

  const typeGuide: Record<string, string> = {
    restaurant:
      'Appetizing sensory words. Warmth and community. "Come hungry". Make food sound irresistible.',
    cafe: 'Cozy artisanal lifestyle. Morning ritual energy. Slow living. Make them smell the coffee.',
    salon:
      'Transformation and confidence. "Treat yourself". Empowering language. Before/after energy.',
    retail: 'Trending and new. Limited stock urgency. Style and lifestyle focus. FOMO-inducing.',
    gym: 'Results and strength. "You vs you". Transformation. Motivational. No excuses energy.',
    other: 'Authentic local-business voice. Clear benefit. Friendly confidence.',
  };

  const cat = (params.aiCategory || 'retail').toLowerCase();
  const typeHint = typeGuide[cat] ?? typeGuide.other;
  const vibeKey = params.brandVibe && vibeGuide[params.brandVibe] ? params.brandVibe : 'warm';
  const vibeText = vibeGuide[vibeKey];
  const cityTag =
    params.city && params.city.trim()
      ? `Include #${params.city.replace(/\s+/g, '').replace(/[^a-zA-Z0-9_]/g, '')}`
      : '';

  const dom =
    params.dominantColors && params.dominantColors.length
      ? params.dominantColors.slice(0, 5).join(', ')
      : '';

  return `
You are a social media expert for local small businesses.
Write authentic captions that sound like the real owner wrote them.

BUSINESS:
Name: ${params.businessName || 'My Business'}
Type: ${params.displayType || params.aiCategory || 'business'}
Location: ${params.city?.trim() || 'local area'}
${params.customDescription?.trim() ? `Context: ${params.customDescription.trim()}` : ''}

BRAND DNA:
${params.brandVibe ? `Personality: ${params.brandVibe} — ${vibeText}` : ''}
${params.brandColor ? `Brand color: ${params.brandColor}` : ''}
${dom ? `Palette hints: ${dom}` : ''}
${params.websiteSummary?.trim() ? `About this business: ${params.websiteSummary.trim()}` : ''}
${params.instagramHandle?.trim() ? `Instagram: ${params.instagramHandle.trim()}` : ''}

POST:
Platform: ${params.platform || 'instagram'}
Template style: ${params.templateStyle || 'auto'}
What this post is about: ${params.userDescription}

WRITE 3 CAPTIONS:

[HOOK] Under 60 words. Attention-grabbing opener.
Match the ${vibeKey} personality.
${typeHint}
Sound like the owner. One emoji. 5 hashtags.
${cityTag}

[STORY] 80-120 words. Mini story or behind the scenes.
Personal and authentic. Mention location naturally.
6-8 hashtags mixing local and niche.

[CTA] Under 80 words. Build desire then drive action.
"You" language. Clear CTA. 5-6 hashtags.

NEVER USE: synergy, leverage, cutting-edge, seamlessly,
game-changer, innovative, revolutionize, empower,
transformative, holistic

Return ONLY this JSON, no other text:
{
  "captions": [
    {"type": "hook", "text": "caption text"},
    {"type": "story", "text": "caption text"},
    {"type": "cta", "text": "caption text"}
  ]
}
`;
}
