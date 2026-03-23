import { IAIProvider, CaptionParams, CaptionResult, ImageParams } from './IAIProvider';

const EMOJI: Record<string, string> = {
  restaurant: '🍽️',
  salon: '💅',
  retail: '🛍️',
  gym: '💪',
  cafe: '☕',
};

const TEMPLATES: Record<string, (name: string, type: string, desc: string) => string> = {
  'today-special': (n, t, d) =>
    `${EMOJI[t] ?? '✨'} Today's special at ${n}: ${d}! #dailyspecial #local #${t}`,
  'behind-scenes': (n, _t, d) =>
    `👀 Behind the scenes at ${n}! ${d}. #behindthescenes #local`,
  promo: (n, t, d) =>
    `🎉 Special offer at ${n}! ${d}. #promo #local #${t}`,
  'before-after': (n, _t, d) =>
    `✨ Amazing transformation at ${n}! ${d}. #beforeandafter #transformation`,
  'new-item': (n, t, d) =>
    `🆕 New at ${n}! ${d}. #new #${t}`,
  'new-arrival': (n, _t, d) =>
    `🛍️ Fresh arrivals at ${n}! ${d}. #newstock #retail`,
  sale: (n, _t, d) =>
    `💸 SALE at ${n}! ${d}. #sale #discount`,
  transformation: (n, _t, d) =>
    `💪 Results at ${n}! ${d}. #fitness #transformation`,
  'new-class': (n, _t, d) =>
    `🏋️ New class at ${n}! ${d}. #fitness #newclass`,
  'new-look': (n, _t, d) =>
    `💅 Fresh look from ${n}! ${d}. #beauty #style`,
};

function toCaptionResult(caption: string): CaptionResult {
  const base = ['#local', '#smallbusiness', '#smallbusiness', '#supportlocal'];
  const ig = [...base, '#instagram', '#explore', '#daily', '#lifestyle', '#vibes', '#feed', '#post'].slice(0, 12);
  const fb = base.slice(0, 5);
  return {
    instagram: { caption, hashtags: ig.length >= 8 ? ig : [...ig, '#insta', '#photo'].slice(0, 10) },
    facebook: { caption, hashtags: fb.length >= 3 ? fb : [...fb, '#community'].slice(0, 5) },
  };
}

export class MockAIProvider implements IAIProvider {
  async generateCaption(params: CaptionParams): Promise<CaptionResult> {
    const fn = TEMPLATES[params.template];
    const caption = fn
      ? fn(params.businessName, params.businessType, params.description)
      : `${EMOJI[params.businessType] ?? '✨'} ${params.description}! Visit ${params.businessName} today. #local #smallbusiness #${params.businessType}`;
    return toCaptionResult(caption);
  }

  async processImage(_params: ImageParams): Promise<string | null> {
    return null;
  }
}
