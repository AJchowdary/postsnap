import { getDb } from '../db';
import { NotFoundError } from '../utils/errors';
import { BusinessProfileInput } from '../schemas/account';

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
  brandStyle: string;
  overlayDefaultOn: boolean;
  displayType?: string | null;
  customDescription?: string | null;
  updatedAt: string;
}

const TRIAL_DAYS = 14;

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
      account_id: account.id,
      name: '',
      city: null,
      logo_url: null,
      brand_color: null,
      brand_style: 'clean',
      overlay_default_on: false,
      displayType: defaultDisplayType('restaurant'),
      customDescription: '',
      updated_at: now.toISOString(),
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

export async function upsertBusinessProfile(
  ownerUserId: string,
  input: BusinessProfileInput
) {
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
  await db.updateOne('accounts', account.id, { businessType: input.type });
  const data = {
    account_id: account.id,
    name: input.name,
    city: input.city ?? null,
    logo_url: input.logo ?? null,
    brand_color: input.brandColor ?? null,
    brand_style: input.brandStyle,
    overlay_default_on: input.useLogoOverlay,
    displayType,
    customDescription,
    updated_at: now,
  };
  if (existing) {
    await db.updateOne('business_profiles', account.id, data);
    return formatAccount({ ...account, businessType: input.type }, { ...existing, ...data });
  }
  await db.insertOne('business_profiles', data);
  const profile: BusinessProfileRecord = {
    accountId: account.id,
    name: input.name,
    city: input.city ?? null,
    logoUrl: input.logo ?? null,
    brandColor: input.brandColor ?? null,
    brandStyle: input.brandStyle,
    overlayDefaultOn: input.useLogoOverlay,
    displayType,
    customDescription,
    updatedAt: now,
  };
  return formatAccount({ ...account, businessType: input.type }, profile);
}
