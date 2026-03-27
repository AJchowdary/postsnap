import { getDb } from '../db';
import { NotFoundError } from '../utils/errors';
import { BusinessProfileInput } from '../schemas/account';
import { scrapeAndAnalyzeWebsite } from './websiteScraperService';

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
  brandStyle: string;
  overlayDefaultOn: boolean;
  displayType?: string | null;
  customDescription?: string | null;
  updatedAt: string;
}

const TRIAL_DAYS = 14;

function normalizeWebsiteInput(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t.startsWith('http://') || t.startsWith('https://') ? t : `https://${t}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
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
    brandStyle: profile?.brandStyle ?? 'clean',
    useLogoOverlay: profile?.overlayDefaultOn ?? false,
    updatedAt: profile?.updatedAt ?? account.createdAt,
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
