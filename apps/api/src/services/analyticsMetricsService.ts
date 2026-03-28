import { getSupabase } from '../db/supabaseClient';

export interface AdminMetricsLast30Days {
  periodDays: number;
  since: string;
  until: string;
  countsByEvent: Record<string, number>;
  uniqueAccountsWithEvents: number;
  postsGenerated: number;
  postsPublished: number;
  qualityRetries: number;
  genericDetected: number;
  studioUsed: number;
  brandBrainEnriched: number;
  onboardingCompleted: number;
  /** Accounts whose first-ever POST_PUBLISHED is within 24h of account creation (all-time first publish). */
  accountsFirstPublishWithin24hOfSignup: number;
  /** Accounts with at least one POST_PUBLISHED (all-time), used for rate denominator. */
  accountsWithAnyPublish: number;
  /** Median hours from account creation to first POST_PUBLISHED (all-time); null if none. */
  medianHoursToFirstPublish: number | null;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid];
  return (s[mid - 1] + s[mid]) / 2;
}

export async function getAdminMetricsLast30Days(): Promise<AdminMetricsLast30Days> {
  const periodDays = 30;
  const until = new Date();
  const since = new Date(until.getTime() - periodDays * 86400000);
  const sinceIso = since.toISOString();
  const untilIso = until.toISOString();

  const supabase = getSupabase();
  const { data: windowRows, error: wErr } = await supabase
    .from('analytics_events')
    .select('event_name, account_id')
    .gte('created_at', sinceIso)
    .lte('created_at', untilIso);

  if (wErr) throw new Error(`analytics_events window: ${wErr.message}`);

  const rows = windowRows ?? [];
  const countsByEvent: Record<string, number> = {};
  const accountsInWindow = new Set<string>();
  for (const r of rows) {
    const name = r.event_name as string;
    countsByEvent[name] = (countsByEvent[name] ?? 0) + 1;
    if (r.account_id) accountsInWindow.add(r.account_id as string);
  }

  const { data: allPublished, error: pErr } = await supabase
    .from('analytics_events')
    .select('account_id, created_at')
    .eq('event_name', 'POST_PUBLISHED');

  if (pErr) throw new Error(`analytics_events POST_PUBLISHED: ${pErr.message}`);

  const firstPublishByAccount = new Map<string, string>();
  for (const r of allPublished ?? []) {
    const aid = r.account_id as string;
    const t = r.created_at as string;
    const prev = firstPublishByAccount.get(aid);
    if (!prev || t < prev) firstPublishByAccount.set(aid, t);
  }

  const accountIds = [...firstPublishByAccount.keys()];
  let medianHoursToFirstPublish: number | null = null;
  let accountsFirstPublishWithin24hOfSignup = 0;
  let accountsWithAnyPublish = firstPublishByAccount.size;

  if (accountIds.length > 0) {
    const { data: accRows, error: aErr } = await supabase
      .from('accounts')
      .select('id, created_at')
      .in('id', accountIds);

    if (aErr) throw new Error(`accounts for metrics: ${aErr.message}`);

    const created = new Map<string, string>();
    for (const a of accRows ?? []) {
      created.set(a.id as string, a.created_at as string);
    }

    const hoursList: number[] = [];
    for (const [aid, pubIso] of firstPublishByAccount) {
      const c = created.get(aid);
      if (!c) continue;
      const h = (new Date(pubIso).getTime() - new Date(c).getTime()) / 3600000;
      if (Number.isFinite(h)) hoursList.push(h);
      if (h <= 24) accountsFirstPublishWithin24hOfSignup += 1;
    }
    medianHoursToFirstPublish = median(hoursList);
  }

  return {
    periodDays,
    since: sinceIso,
    until: untilIso,
    countsByEvent,
    uniqueAccountsWithEvents: accountsInWindow.size,
    postsGenerated: countsByEvent.POST_GENERATED ?? 0,
    postsPublished: countsByEvent.POST_PUBLISHED ?? 0,
    qualityRetries: countsByEvent.QUALITY_RETRY_TRIGGERED ?? 0,
    genericDetected: countsByEvent.GENERIC_DETECTED ?? 0,
    studioUsed: countsByEvent.STUDIO_USED ?? 0,
    brandBrainEnriched: countsByEvent.BRAND_BRAIN_ENRICHED ?? 0,
    onboardingCompleted: countsByEvent.ONBOARDING_COMPLETED ?? 0,
    accountsFirstPublishWithin24hOfSignup,
    accountsWithAnyPublish,
    medianHoursToFirstPublish,
  };
}
