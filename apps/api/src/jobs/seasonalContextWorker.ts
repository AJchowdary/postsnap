/**
 * Weekly (Monday 06:00 UTC) refresh of Brand Brain `seasonal_context` via LLM.
 * Run from the long-lived worker process — not from stateless API replicas.
 */
import { getSupabase } from '../db/supabaseClient';
import { getDb } from '../db';
import { config } from '../config';
import { logger } from '../utils/logger';
import { currentSeasonLabel } from '../services/accountService';

function utcMonthName(d = new Date()): string {
  return d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
}

async function llmSeasonalContext(input: {
  month: string;
  season: string;
  city: string | null;
  businessType: string;
  displayType: string;
}): Promise<string | null> {
  if (!config.openaiApiKey) {
    logger.warn('seasonal context: OPENAI_API_KEY missing');
    return null;
  }
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: config.openaiApiKey, timeout: 30_000 });
  const cityLine = input.city?.trim()
    ? input.city.trim()
    : 'Not specified — use general seasonal cues only; do not invent a city.';

  const user = `Write exactly 1–2 short sentences (max 320 characters) of seasonal context for a local business social content calendar.

Inputs:
- Calendar month (UTC): ${input.month}
- Season: ${input.season}
- City: ${cityLine}
- Business category: ${input.businessType}
- Display label: ${input.displayType}

Requirements:
- Tie the season, and when the city is known, local weather and timely moments (holidays, community rhythms) to content ideas for THIS business type in THIS city.
- If city was not specified, stay general to the Northern Hemisphere season without naming a place.
- Plain text only. No quotation marks around the answer.`;

  const resp = await client.chat.completions.create({
    model: config.openaiCaptionModel,
    max_tokens: 220,
    messages: [
      {
        role: 'system',
        content: 'You write concise seasonal marketing context for small businesses. No markdown.',
      },
      { role: 'user', content: user },
    ],
  });
  const text = resp.choices[0]?.message?.content?.trim() ?? '';
  return text ? text.slice(0, 500) : null;
}

/** Refresh `seasonal_context` for one account (e.g. tests or manual trigger). */
export async function updateSeasonalContextForAccount(accountId: string): Promise<void> {
  const db = await getDb();
  const account = await db.findOne<{ id: string; businessType: string }>('accounts', { id: accountId });
  const profile = await db.findOne<{
    displayType?: string | null;
    city?: string | null;
  }>('business_profiles', { account_id: accountId });
  if (!account || !profile) return;

  const month = utcMonthName();
  const season = currentSeasonLabel();
  const displayType = profile.displayType?.trim() || account.businessType;
  const text = await llmSeasonalContext({
    month,
    season,
    city: profile.city ?? null,
    businessType: account.businessType,
    displayType,
  });
  if (!text) return;

  await db.updateOne('business_profiles', accountId, {
    seasonalContext: text,
    updatedAt: new Date().toISOString(),
  });
}

/** All accounts with an active trial or paid subscription. */
export async function updateSeasonalContextAllActiveAccounts(): Promise<void> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('account_id')
    .in('status', ['trial_active', 'active_subscription']);
  if (error) {
    logger.warn('seasonal context: subscription query failed', { error: error.message });
    return;
  }
  const rows = data ?? [];
  for (const row of rows) {
    const accountId = (row as { account_id: string }).account_id;
    try {
      await updateSeasonalContextForAccount(accountId);
    } catch (e) {
      logger.warn('seasonal context: account failed', {
        accountId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  logger.info('seasonal context: batch finished', { accounts: rows.length });
}

let lastRunUtcDayKey: string | null = null;

/** Every Monday, once during the 06:00–06:59 UTC hour. */
export function startSeasonalContextScheduler(): void {
  const tick = () => {
    const now = new Date();
    if (now.getUTCDay() !== 1) return;
    if (now.getUTCHours() !== 6) return;
    const dayKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
    if (lastRunUtcDayKey === dayKey) return;
    lastRunUtcDayKey = dayKey;
    void updateSeasonalContextAllActiveAccounts().catch((e) =>
      logger.error('seasonal context batch failed', {
        error: e instanceof Error ? e.message : String(e),
      })
    );
  };
  setInterval(tick, 60 * 1000);
  tick();
}
