import OpenAI from 'openai';
import { config } from '../config';
import { logger } from '../utils/logger';
import { editCaptionMasterPrefix, type BrandDNAProfile } from '../prompts/quickpostAI';

export type EditCaptionChatTurn = { role: 'user' | 'assistant'; content: string };

export type EditCaptionRequest = {
  userRequest: string;
  currentCaption: string;
  currentHashtags: string[];
  businessName: string;
  city: string;
  ideaText: string;
  brandVibe?: string;
  toneOfVoice?: string;
  chatHistory: EditCaptionChatTurn[];
  brandProfile?: BrandDNAProfile;
};

export type EditCaptionResult = {
  message: string;
  newCaption: string;
  newHashtags: string[];
};

function buildSystemPrompt(ctx: EditCaptionRequest): string {
  const tags = ctx.currentHashtags.length ? ctx.currentHashtags.join(', ') : '(none)';
  const dna = editCaptionMasterPrefix(ctx.brandProfile);
  return `${dna}You are an AI social media editor for ${ctx.businessName} in ${ctx.city || 'your area'}.
You help refine social media captions for Instagram and Facebook.

Current caption:
${ctx.currentCaption}

Current hashtags: ${tags}

Original post idea:
${ctx.ideaText || '(not provided)'}

Brand vibe: ${ctx.brandVibe ?? 'warm'}
Tone of voice: ${ctx.toneOfVoice ?? 'conversational'}

When the user asks for changes, respond with:
1. A brief explanation of what you changed (1 sentence).
2. The complete new caption on its own line after the label exactly: NEW CAPTION:
3. Updated hashtags after the label exactly: HASHTAGS: as a comma-separated list (words only, no # in the list).

Keep the business name and local references where appropriate.
Avoid generic marketing filler.`;
}

export function parseEditCaptionReply(raw: string): { newCaption: string; newHashtags: string[]; message: string } {
  const text = raw.trim();
  const newCapBlock = text.match(/NEW CAPTION:\s*([\s\S]*?)(?=^\s*HASHTAGS:|$)/im);
  const hashLine = text.match(/HASHTAGS:\s*([^\n]+)/im);
  let newCaption = newCapBlock?.[1]?.trim() ?? '';
  if (!newCaption) {
    newCaption = text;
  }
  const newHashtags: string[] = [];
  if (hashLine?.[1]) {
    hashLine[1]
      .split(/[,，]/)
      .map((s) => s.trim().replace(/^#/u, ''))
      .filter(Boolean)
      .forEach((t) => newHashtags.push(t));
  } else {
    const fromCap = newCaption.match(/#[\w\u0080-\uFFFF]+/g) ?? [];
    fromCap.forEach((h) => newHashtags.push(h.slice(1)));
  }
  return { message: text, newCaption: newCaption || text, newHashtags };
}

export async function runEditCaption(req: EditCaptionRequest): Promise<EditCaptionResult> {
  const system = buildSystemPrompt(req);
  const userLines = [
    `User request: ${req.userRequest}`,
    'Reply following the NEW CAPTION: and HASHTAGS: format.',
  ].join('\n');

  if (!config.openaiApiKey?.trim()) {
    const parsed = parseEditCaptionReply(
      `Offline mode: set OPENAI_API_KEY on the server for full AI editing.\n\nNEW CAPTION:\n${req.currentCaption}\nHASHTAGS: ${req.currentHashtags.join(', ') || 'local'}`
    );
    return {
      message: parsed.message,
      newCaption: parsed.newCaption,
      newHashtags: parsed.newHashtags.length ? parsed.newHashtags : [...req.currentHashtags],
    };
  }

  try {
    const client = new OpenAI({ apiKey: config.openaiApiKey, timeout: 60_000 });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
      ...req.chatHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: userLines },
    ];

    const completion = await client.chat.completions.create({
      model: config.openaiCaptionModel,
      messages,
      temperature: 0.7,
      max_tokens: 1200,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!raw) {
      throw new Error('Empty AI response');
    }

    const parsed = parseEditCaptionReply(raw);
    return {
      message: parsed.message,
      newCaption: parsed.newCaption,
      newHashtags: parsed.newHashtags.length ? parsed.newHashtags : [...req.currentHashtags],
    };
  } catch (e) {
    logger.error('editCaption LLM failed', { error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}
