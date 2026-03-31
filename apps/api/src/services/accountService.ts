import { getDb } from '../db';
import { getSupabase } from '../db/supabaseClient';
import { NotFoundError, ValidationError } from '../utils/errors';
import { BusinessProfileInput, CaptureSignalInput } from '../schemas/account';
import { scrapeAndAnalyzeWebsite } from './websiteScraperService';
import { enrichBrandBrain } from './brandBrainEnrichmentService';
import { trackEvent } from './analyticsEvents';
import { logger } from '../utils/logger';
import { parseHttpOrHttpsWebsiteUrl } from '../utils/websiteUrl';

function defaultDisplayType(type: string): string {
  const m: Record<string, string> = {
    restaurant: 'Restaurant',
    salon: 'Salon & Beauty',
    retail: 'Retail Store',
    gym: 'Gym & Fitness',
    cafe: 'Cafe & Coffee Shop',
  };
  return m[type] || 'Restaurant';
}

interface AccountRecord {
  id: string;
  ownerUserId: string;
  userId?: string;
  businessType: string;
  createdAt: string;
  pushToken?: string | null;
  pushNotificationsEnabled?: boolean | null;
}

interface BusinessProfileRecord {
  accountId: string;
  name: string;
  city?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
  brandVibe?: string | null;
  dominantColors?: string[] | null;
  websiteUrl?: string | null;
  websiteSummary?: string | null;
  toneExample?: string | null;
  instagramHandle?: string | null;
  facebookPage?: string | null;
  brandDnaSource?: string | null;
  businessSubcategory?: string | null;
  neighborhood?: string | null;
  tagline?: string | null;
  toneOfVoice?: string | null;
  contentPersona?: string | null;
  coreServices?: string[] | null;
  heroProduct?: string | null;
  pricePositioning?: string | null;
  uniqueDifferentiator?: string | null;
  visualStyle?: string | null;
  photoStyleExamples?: string[] | null;
  studioStylePreference?: string | null;
  studioBgColor?: string | null;
  seasonalContext?: string | null;
  localEvents?: string[] | null;
  lastPostTopics?: string[] | null;
  topPerformingAngles?: string[] | null;
  preferredCaptionLength?: string | null;
  preferredPostingDays?: string[] | null;
  photoStudioHistory?: Record<string, unknown>[] | null;
  confidenceOverall?: number | null;
  enrichmentVersion?: number | null;
  brandStyle: string;
  overlayDefaultOn: boolean;
  displayType?: string | null;
  customDescription?: string | null;
  updatedAt: string;
  avoidedTopics?: string[] | null;
  brainFieldConfidence?: Record<string, number> | null;
  signalCount?: number | null;
  signalLog?: Record<string, unknown>[] | null;
}

const TRIAL_DAYS = 14;

function normalizeWebsiteInput(raw: string): string | null {
  return parseHttpOrHttpsWebsiteUrl(raw);
}

function dedupeRecent(items: string[], max = 20): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const k = it.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it.trim());
    if (out.length >= max) break;
  }
  return out;
}

/** UTC season label — shared with seasonal context worker. */
export function currentSeasonLabel(now = new Date()): string {
  const m = now.getUTCMonth() + 1;
  if (m >= 3 && m <= 5) return 'Spring';
  if (m >= 6 && m <= 8) return 'Summer';
  if (m >= 9 && m <= 11) return 'Fall';
  return 'Winter';
}

/**
 * Resolve account_id for the authenticated user. Never use client-supplied account_id.
 * Throws if no account exists (call bootstrap first if needed).
 */
export async function requireAccountForUser(ownerUserId: string): Promise<string> {
  const db = await getDb();
  const account = await db.findOne<AccountRecord>('accounts', { owner_user_id: ownerUserId });
  if (!account) throw new NotFoundError('Account not found');
  return account.id;
}

export async function bootstrapAccount(ownerUserId: string) {
  const db = await getDb();
  let account = await db.findOne<AccountRecord>('accounts', { owner_user_id: ownerUserId });
  if (!account) {
    account = await db.insertOne<AccountRecord>('accounts', {
      owner_user_id: ownerUserId,
      business_type: 'restaurant',
      created_at: new Date().toISOString(),
    });
    const now = new Date();
    const trialEndAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    await db.insertOne('business_profiles', {
      accountId: account.id,
      name: '',
      city: null,
      logoUrl: null,
      brandColor: null,
      brandStyle: 'clean',
      overlayDefaultOn: false,
      displayType: defaultDisplayType('restaurant'),
      customDescription: '',
      brandDnaSource: 'manual',
      dominantColors: [],
      coreServices: [],
      photoStyleExamples: [],
      localEvents: [],
      lastPostTopics: [],
      topPerformingAngles: [],
      preferredPostingDays: [],
      photoStudioHistory: [],
      confidenceOverall: 0.65,
      enrichmentVersion: 2,
      updatedAt: now.toISOString(),
    });
    await db.insertOne('subscriptions', {
      account_id: account.id,
      status: 'trial_active',
      trial_type: 'time',
      trial_end_at: trialEndAt.toISOString(),
      trial_posts_limit: 0,
      trial_posts_used: 0,
      updated_at: now.toISOString(),
    });
  }
  const profile = await db.findOne<BusinessProfileRecord>('business_profiles', {
    account_id: account.id,
  });
  return formatAccount(account, profile);
}

function formatAccount(
  account: AccountRecord,
  profile: BusinessProfileRecord | null
): Record<string, any> {
  const bt = account.businessType;
  const dom = profile?.dominantColors;
  const core = profile?.coreServices;
  const photoStyles = profile?.photoStyleExamples;
  const localEvents = profile?.localEvents;
  const topics = profile?.lastPostTopics;
  const angles = profile?.topPerformingAngles;
  const postingDays = profile?.preferredPostingDays;
  const studioHistory = profile?.photoStudioHistory;
  return {
    id: account.id,
    userId: account.ownerUserId ?? account.userId,
    owner_user_id: account.ownerUserId,
    businessType: account.businessType,
    createdAt: account.createdAt,
    name: profile?.name ?? '',
    type: account.businessType,
    displayType: profile?.displayType?.trim() || defaultDisplayType(bt),
    customDescription: profile?.customDescription ?? '',
    city: profile?.city ?? null,
    logo: profile?.logoUrl ?? null,
    brandColor: profile?.brandColor ?? null,
    brandVibe: profile?.brandVibe ?? undefined,
    dominantColors: Array.isArray(dom) ? dom : [],
    websiteUrl: profile?.websiteUrl ?? undefined,
    websiteSummary: profile?.websiteSummary ?? undefined,
    toneExample: profile?.toneExample ?? undefined,
    instagramHandle: profile?.instagramHandle ?? undefined,
    facebookPage: profile?.facebookPage ?? undefined,
    brandDnaSource: profile?.brandDnaSource ?? 'manual',
    businessSubcategory: profile?.businessSubcategory ?? undefined,
    neighborhood: profile?.neighborhood ?? undefined,
    tagline: profile?.tagline ?? undefined,
    toneOfVoice: profile?.toneOfVoice ?? undefined,
    contentPersona: profile?.contentPersona ?? undefined,
    coreServices: Array.isArray(core) ? core : [],
    heroProduct: profile?.heroProduct ?? undefined,
    pricePositioning: profile?.pricePositioning ?? undefined,
    uniqueDifferentiator: profile?.uniqueDifferentiator ?? undefined,
    visualStyle: profile?.visualStyle ?? undefined,
    photoStyleExamples: Array.isArray(photoStyles) ? photoStyles : [],
    studioStylePreference: profile?.studioStylePreference ?? undefined,
    studioBgColor: profile?.studioBgColor ?? undefined,
    seasonalContext: profile?.seasonalContext ?? undefined,
    localEvents: Array.isArray(localEvents) ? localEvents : [],
    lastPostTopics: Array.isArray(topics) ? topics : [],
    topPerformingAngles: Array.isArray(angles) ? angles : [],
    preferredCaptionLength: profile?.preferredCaptionLength ?? undefined,
    preferredPostingDays: Array.isArray(postingDays) ? postingDays : [],
    photoStudioHistory: Array.isArray(studioHistory) ? studioHistory : [],
    confidenceOverall: profile?.confidenceOverall ?? 0.65,
    enrichmentVersion: profile?.enrichmentVersion ?? 2,
    avoidedTopics: Array.isArray(profile?.avoidedTopics) ? profile.avoidedTopics : [],
    brainFieldConfidence:
      profile?.brainFieldConfidence && typeof profile.brainFieldConfidence === 'object'
        ? profile.brainFieldConfidence
        : {},
    signalCount: profile?.signalCount ?? 0,
    brandStyle: profile?.brandStyle ?? 'clean',
    useLogoOverlay: profile?.overlayDefaultOn ?? false,
    updatedAt: profile?.updatedAt ?? account.createdAt,
    pushNotificationsEnabled: account.pushNotificationsEnabled !== false,
  };
}

export async function getAccount(ownerUserId: string) {
  const db = await getDb();
  const account = await db.findOne<AccountRecord>('accounts', { owner_user_id: ownerUserId });
  if (!account) return null;
  const profile = await db.findOne<BusinessProfileRecord>('business_profiles', {
    account_id: account.id,
  });
  return formatAccount(account, profile);
}

/**
 * Same data as `getAccount`, but throws if missing. Use instead of
 * `requireAccountForUser` + `getAccount` to avoid duplicate account lookups.
 */
export async function requireAccountRecordForUser(ownerUserId: string): Promise<Record<string, any>> {
  const record = await getAccount(ownerUserId);
  if (!record) throw new NotFoundError('Account not found');
  return record;
}

export async function scanAndSaveWebsite(ownerUserId: string, rawUrl: string) {
  const normalized = normalizeWebsiteInput(rawUrl);
  if (!normalized) return null;

  const result = await scrapeAndAnalyzeWebsite(normalized);
  if (!result) return null;

  const db = await getDb();
  const account = await db.findOne<AccountRecord>('accounts', { owner_user_id: ownerUserId });
  if (!account) throw new NotFoundError('Account not found');

  const existing = await db.findOne<BusinessProfileRecord>('business_profiles', {
    account_id: account.id,
  });

  const mappedType =
    result.businessType === 'other' ? 'retail' : result.businessType;

  await db.updateOne('accounts', account.id, { businessType: mappedType });

  const ig = result.instagramHandle
    ? result.instagramHandle.replace(/^@/, '').slice(0, 120)
    : null;

  const now = new Date().toISOString();
  const patch = {
    websiteUrl: normalized,
    websiteSummary: result.brandSummary,
    brandColor: result.suggestedColor,
    brandVibe: result.suggestedVibe,
    dominantColors: result.suggestedColors,
    toneExample: result.tone,
    brandDnaSource: 'website',
    confidenceOverall: 0.9,
    enrichmentVersion: 2,
    city: result.city ?? existing?.city ?? null,
    instagramHandle: ig,
    updatedAt: now,
  };

  if (existing) {
    await db.updateOne('business_profiles', account.id, patch);
  } else {
    await db.insertOne('business_profiles', {
      accountId: account.id,
      name: '',
      logoUrl: null,
      brandStyle: 'clean',
      overlayDefaultOn: false,
      displayType: defaultDisplayType(mappedType),
      customDescription: '',
      ...patch,
    });
  }

  const updatedAccount = await db.findOne<AccountRecord>('accounts', { owner_user_id: ownerUserId });
  const profile = await db.findOne<BusinessProfileRecord>('business_profiles', {
    account_id: account.id,
  });
  if (!updatedAccount) throw new NotFoundError('Account not found');

  return {
    account: formatAccount({ ...updatedAccount, businessType: mappedType }, profile),
    scan: result,
  };
}

export async function upsertBusinessProfile(ownerUserId: string, input: BusinessProfileInput) {
  const db = await getDb();
  const account = await db.findOne<AccountRecord>('accounts', {
    owner_user_id: ownerUserId,
  });
  if (!account) throw new NotFoundError('Account not found');
  const existing = await db.findOne<BusinessProfileRecord>('business_profiles', {
    account_id: account.id,
  });
  const now = new Date().toISOString();
  const displayType = (input.displayType?.trim() || defaultDisplayType(input.type)) as string;
  const customDescription = input.customDescription?.trim() ?? '';

  const websiteFromInput = input.websiteUrl !== undefined ? input.websiteUrl.trim() || null : undefined;
  let brandDnaSource = input.brandDnaSource ?? existing?.brandDnaSource ?? 'manual';
  if (
    input.brandDnaSource === undefined &&
    websiteFromInput !== undefined &&
    websiteFromInput &&
    existing?.brandDnaSource === 'manual'
  ) {
    brandDnaSource = 'hybrid';
  }

  const pick = <T>(v: T | undefined, fallback: T | null | undefined): T | null | undefined =>
    v !== undefined ? v : fallback;

  const resolvedWebsite =
    websiteFromInput !== undefined ? websiteFromInput : existing?.websiteUrl ?? null;

  await db.updateOne('accounts', account.id, { businessType: input.type });
  const data: Record<string, any> = {
    accountId: account.id,
    name: input.name,
    city: pick(input.city, existing?.city) ?? null,
    logoUrl: pick(input.logo, existing?.logoUrl) ?? null,
    brandColor: pick(input.brandColor, existing?.brandColor) ?? null,
    brandVibe: pick(input.brandVibe, existing?.brandVibe) ?? null,
    dominantColors: input.dominantColors ?? existing?.dominantColors ?? [],
    websiteUrl: resolvedWebsite,
    websiteSummary: pick(input.websiteSummary, existing?.websiteSummary) ?? null,
    toneExample: pick(input.toneExample, existing?.toneExample) ?? null,
    instagramHandle: pick(input.instagramHandle, existing?.instagramHandle) ?? null,
    facebookPage: pick(input.facebookPage, existing?.facebookPage) ?? null,
    businessSubcategory: pick(input.businessSubcategory, existing?.businessSubcategory) ?? null,
    neighborhood: pick(input.neighborhood, existing?.neighborhood) ?? null,
    tagline: pick(input.tagline, existing?.tagline) ?? null,
    toneOfVoice: pick(input.toneOfVoice, existing?.toneOfVoice) ?? null,
    contentPersona: pick(input.contentPersona, existing?.contentPersona) ?? null,
    coreServices: input.coreServices ?? existing?.coreServices ?? [],
    heroProduct: pick(input.heroProduct, existing?.heroProduct) ?? null,
    pricePositioning: pick(input.pricePositioning, existing?.pricePositioning) ?? null,
    uniqueDifferentiator:
      pick(input.uniqueDifferentiator, existing?.uniqueDifferentiator) ?? null,
    visualStyle: pick(input.visualStyle, existing?.visualStyle) ?? null,
    photoStyleExamples: input.photoStyleExamples ?? existing?.photoStyleExamples ?? [],
    studioStylePreference:
      pick(input.studioStylePreference, existing?.studioStylePreference) ?? null,
    studioBgColor: pick(input.studioBgColor, existing?.studioBgColor) ?? null,
    seasonalContext: pick(input.seasonalContext, existing?.seasonalContext) ?? null,
    localEvents: input.localEvents ?? existing?.localEvents ?? [],
    lastPostTopics: input.lastPostTopics ?? existing?.lastPostTopics ?? [],
    topPerformingAngles:
      input.topPerformingAngles ?? existing?.topPerformingAngles ?? [],
    preferredCaptionLength:
      pick(input.preferredCaptionLength, existing?.preferredCaptionLength) ?? null,
    preferredPostingDays: input.preferredPostingDays ?? existing?.preferredPostingDays ?? [],
    photoStudioHistory: input.photoStudioHistory ?? existing?.photoStudioHistory ?? [],
    confidenceOverall:
      input.confidenceOverall !== undefined
        ? input.confidenceOverall
        : existing?.confidenceOverall ?? 0.65,
    brainFieldConfidence:
      input.brainFieldConfidence !== undefined
        ? input.brainFieldConfidence
        : existing?.brainFieldConfidence ?? {},
    enrichmentVersion:
      input.enrichmentVersion !== undefined
        ? input.enrichmentVersion
        : existing?.enrichmentVersion ?? 2,
    brandDnaSource,
    brandStyle: input.brandStyle,
    overlayDefaultOn: input.useLogoOverlay,
    displayType,
    customDescription,
    updatedAt: now,
  };

  if (existing) {
    await db.updateOne('business_profiles', account.id, data);
    const profile = await db.findOne<BusinessProfileRecord>('business_profiles', {
      account_id: account.id,
    });
    return formatAccount({ ...account, businessType: input.type }, profile);
  }
  await db.insertOne('business_profiles', data);
  const profile = await db.findOne<BusinessProfileRecord>('business_profiles', {
    account_id: account.id,
  });
  return formatAccount({ ...account, businessType: input.type }, profile);
}

export async function captureSignal(ownerUserId: string, input: CaptureSignalInput) {
  const db = await getDb();
  const account = await db.findOne<AccountRecord>('accounts', { owner_user_id: ownerUserId });
  if (!account) throw new NotFoundError('Account not found');
  const existing = await db.findOne<BusinessProfileRecord>('business_profiles', {
    account_id: account.id,
  });
  if (!existing) throw new NotFoundError('Business profile not found');

  const now = new Date().toISOString();
  const nextSignalCount = (existing.signalCount ?? 0) + 1;
  const prevLog = Array.isArray(existing.signalLog) ? [...existing.signalLog] : [];
  const meta = input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
  const metaRec = meta as Record<string, unknown>;
  const signalLog = [
    {
      signalType: input.signalType,
      topic: input.topic ?? null,
      angle: input.angle ?? null,
      studioStyle: input.studioStyle ?? null,
      at: now,
      meta,
    },
    ...prevLog,
  ].slice(0, 50);
  const topics = Array.isArray(existing.lastPostTopics) ? [...existing.lastPostTopics] : [];
  const angles = Array.isArray(existing.topPerformingAngles) ? [...existing.topPerformingAngles] : [];
  const studioHistory = Array.isArray(existing.photoStudioHistory) ? [...existing.photoStudioHistory] : [];
  let avoidedTopics = Array.isArray(existing.avoidedTopics) ? [...existing.avoidedTopics] : [];

  if (input.topic) topics.unshift(input.topic);
  if ((input.signalType === 'publish' || input.signalType === 'thumbs_up') && input.angle) {
    angles.unshift(input.angle);
  }
  if (input.signalType === 'studio_style_selected' && input.studioStyle) {
    studioHistory.unshift({
      style: input.studioStyle,
      at: now,
      signal: input.signalType,
      ...meta,
    });
  }

  if (input.signalType === 'thumbs_down' && input.topic) {
    avoidedTopics.unshift(input.topic);
  }
  if (input.signalType === 'topic_skip' && input.topic) {
    avoidedTopics.unshift(`topic_suggestion:${input.topic}`);
  }

  const confidenceBase = existing.confidenceOverall ?? 0.65;
  const confidenceDelta =
    input.signalType === 'publish' || input.signalType === 'thumbs_up'
      ? 0.01
      : input.signalType === 'thumbs_down'
        ? -0.015
        : input.signalType === 'save_without_publish'
          ? 0.002
          : 0;
  const confidenceOverall = Math.max(0, Math.min(1, confidenceBase + confidenceDelta));

  const patch: Record<string, unknown> = {
    lastPostTopics: dedupeRecent(topics, 20),
    topPerformingAngles: dedupeRecent(angles, 20),
    avoidedTopics: dedupeRecent(avoidedTopics, 30),
    photoStudioHistory: studioHistory.slice(0, 100),
    confidenceOverall,
    enrichmentVersion: Math.max(existing.enrichmentVersion ?? 2, 2),
    signalCount: nextSignalCount,
    signalLog,
    updatedAt: now,
  };
  if (input.signalType === 'studio_style_selected' && input.studioStyle) {
    patch.studioStylePreference = input.studioStyle;
  }

  await db.updateOne('business_profiles', account.id, patch);

  const postIdMeta = typeof metaRec.postId === 'string' ? metaRec.postId : null;
  if (input.signalType === 'regenerate') {
    void trackEvent({
      name: 'POST_REGENERATED',
      accountId: account.id,
      postId: postIdMeta,
      properties: {
        topic: input.topic ?? null,
        angle: input.angle ?? null,
        ...meta,
      },
    });
  }
  if (input.signalType === 'edit_caption') {
    void trackEvent({
      name: 'POST_EDITED',
      accountId: account.id,
      postId: postIdMeta,
      properties: { ...meta },
    });
  }
  if (
    input.signalType === 'publish' &&
    (input.studioStyle != null || metaRec.workflow === 'template')
  ) {
    void trackEvent({
      name: 'STUDIO_USED',
      accountId: account.id,
      postId: postIdMeta,
        properties: {
          studioStyle: input.studioStyle ?? null,
          workflow: metaRec.workflow ?? null,
        },
    });
  }

  const shouldEnrich = input.signalType === 'publish' || nextSignalCount % 5 === 0;
  if (shouldEnrich) {
    void enrichBrandBrain(account.id).catch((err) => {
      logger.warn('enrichBrandBrain failed', {
        accountId: account.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  const profile = await db.findOne<BusinessProfileRecord>('business_profiles', {
    account_id: account.id,
  });
  return formatAccount(account, profile);
}

export interface NotificationItem {
  id: string;
  accountId: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  postId: string | null;
  createdAt: string;
  updatedAt: string;
}

function formatNotificationRow(row: {
  id: string;
  accountId: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  postId?: string | null;
  createdAt: string;
  updatedAt: string;
}): NotificationItem {
  return {
    id: row.id,
    accountId: row.accountId,
    title: row.title,
    body: row.body,
    type: row.type,
    read: row.read,
    postId: row.postId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function saveExpoPushToken(ownerUserId: string, token: string): Promise<void> {
  const accountId = await requireAccountForUser(ownerUserId);
  const db = await getDb();
  const trimmed = token.trim();
  if (!trimmed) throw new ValidationError('Push token required');
  await db.updateOne('accounts', accountId, {
    pushToken: trimmed,
    updatedAt: new Date().toISOString(),
  });
}

export async function setPushNotificationsEnabled(
  ownerUserId: string,
  enabled: boolean
): Promise<Record<string, unknown>> {
  const db = await getDb();
  const account = await db.findOne<AccountRecord>('accounts', { owner_user_id: ownerUserId });
  if (!account) throw new NotFoundError('Account not found');
  await db.updateOne('accounts', account.id, {
    pushNotificationsEnabled: enabled,
    updatedAt: new Date().toISOString(),
  });
  const profile = await db.findOne<BusinessProfileRecord>('business_profiles', {
    account_id: account.id,
  });
  return formatAccount({ ...account, pushNotificationsEnabled: enabled }, profile);
}

export async function listNotifications(
  ownerUserId: string,
  opts?: { limit?: number }
): Promise<NotificationItem[]> {
  const accountId = await requireAccountForUser(ownerUserId);
  const db = await getDb();
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
  const rows = await db.findMany<{
    id: string;
    accountId: string;
    title: string;
    body: string;
    type: string;
    read: boolean;
    postId?: string | null;
    createdAt: string;
    updatedAt: string;
  }>('notifications', { accountId }, { createdAt: -1 });
  return rows.slice(0, limit).map(formatNotificationRow);
}

export async function unreadNotificationCount(ownerUserId: string): Promise<number> {
  const accountId = await requireAccountForUser(ownerUserId);
  const db = await getDb();
  return db.countDocuments('notifications', { accountId, read: false });
}

export async function markNotificationRead(
  ownerUserId: string,
  notificationId: string
): Promise<NotificationItem> {
  const accountId = await requireAccountForUser(ownerUserId);
  const db = await getDb();
  const row = await db.findOne<{
    id: string;
    accountId: string;
    title: string;
    body: string;
    type: string;
    read: boolean;
    postId?: string | null;
    createdAt: string;
    updatedAt: string;
  }>('notifications', { id: notificationId, accountId });
  if (!row) throw new NotFoundError('Notification not found');
  const now = new Date().toISOString();
  await db.updateOne('notifications', notificationId, {
    read: true,
    updatedAt: now,
  });
  return formatNotificationRow({ ...row, read: true, updatedAt: now });
}

export async function markAllNotificationsRead(ownerUserId: string): Promise<{ updated: number }> {
  const accountId = await requireAccountForUser(ownerUserId);
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true, updated_at: now })
    .eq('account_id', accountId)
    .eq('read', false)
    .select('id');
  if (error) throw new Error(`markAllNotificationsRead: ${error.message}`);
  return { updated: data?.length ?? 0 };
}
