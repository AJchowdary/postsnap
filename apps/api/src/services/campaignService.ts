import { getDb } from '../db';
import { NotFoundError } from '../utils/errors';
import { requireAccountForUser } from './accountService';
import { createPost, enqueueGenerate, getPost } from './postsService';
import { createSignedReadUrl } from './storageService';
import type { CreateCampaignInput, PatchCampaignInput } from '../schemas/campaigns';

interface CampaignRow {
  id: string;
  accountId: string;
  title: string;
  prompt: string;
  productUrl?: string | null;
  productName?: string | null;
  productDescription?: string | null;
  productImageUrl?: string | null;
  referenceImageUrls?: string[] | null;
  aspectRatio: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

function normalizeReferenceImageUrls(raw: unknown): string[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

interface BusinessProfileRow {
  tagline?: string | null;
  toneOfVoice?: string | null;
  tone_of_voice?: string | null;
  uniqueDifferentiator?: string | null;
  unique_differentiator?: string | null;
  heroProduct?: string | null;
  hero_product?: string | null;
  websiteSummary?: string | null;
  website_summary?: string | null;
  name?: string | null;
}

interface PostThumbRow {
  processedImagePath?: string | null;
  originalImagePath?: string | null;
}

function aspectHint(ratio: string): string {
  switch (ratio) {
    case 'feed':
      return 'wide feed (landscape)';
    case 'landscape':
      return 'wide landscape (16:9)';
    case 'story':
      return 'tall story (portrait)';
    case 'square':
    default:
      return 'square 1:1';
  }
}

function buildCampaignContext(campaign: CampaignRow, profile: BusinessProfileRow | null): string {
  const parts: string[] = [];
  if (campaign.productName?.trim()) {
    parts.push(`This campaign features the product: ${campaign.productName.trim()}.`);
    if (campaign.productDescription?.trim()) {
      parts.push(campaign.productDescription.trim());
    }
    if (campaign.productImageUrl?.trim()) {
      parts.push('Reference image provided.');
    }
  }
  const refUrls = normalizeReferenceImageUrls(campaign.referenceImageUrls);
  if (refUrls.length > 0) {
    parts.push(
      `Brand reference images: ${refUrls.length} upload(s) for mood, palette, and composition (use alongside the main product shot if any).`
    );
  }
  parts.push(`Title: ${campaign.title}`);
  parts.push(campaign.prompt);
  if (campaign.productUrl?.trim()) parts.push(`Product link: ${campaign.productUrl.trim()}`);
  parts.push(`Preferred visual format: ${aspectHint(campaign.aspectRatio || 'square')}.`);
  if (profile) {
    const name = profile.name?.trim();
    if (name) parts.push(`Business: ${name}`);
    const tagline = profile.tagline?.trim();
    if (tagline) parts.push(`Tagline: ${tagline}`);
    const tone = profile.toneOfVoice ?? profile.tone_of_voice;
    if (tone) parts.push(`Tone: ${tone}`);
    const diff = profile.uniqueDifferentiator ?? profile.unique_differentiator;
    if (diff) parts.push(`Differentiator: ${diff}`);
    const hero = profile.heroProduct ?? profile.hero_product;
    if (hero) parts.push(`Hero offering: ${hero}`);
    const web = profile.websiteSummary ?? profile.website_summary;
    if (web) parts.push(`Brand context: ${web.slice(0, 400)}`);
  }
  return parts.join('\n').slice(0, 500);
}

async function fetchImageAsDataUrl(url: string): Promise<string | undefined> {
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/')) return trimmed;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(trimmed, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 12 * 1024 * 1024) return undefined;
    const ct = res.headers.get('content-type') || 'image/jpeg';
    const base = ct.split(';')[0].trim() || 'image/jpeg';
    return `data:${base};base64,${buf.toString('base64')}`;
  } catch {
    return undefined;
  }
}

async function thumbnailUrlForLatestPost(
  accountId: string,
  campaignId: string
): Promise<string | null> {
  const db = await getDb();
  const posts = await db.findMany<PostThumbRow>(
    'posts',
    { account_id: accountId, campaign_id: campaignId },
    { createdAt: -1 }
  );
  const latest = posts[0];
  if (!latest) return null;
  const path = latest.processedImagePath ?? latest.originalImagePath;
  if (!path) return null;
  try {
    return await createSignedReadUrl(path);
  } catch {
    return null;
  }
}

export interface CampaignListItem {
  id: string;
  title: string;
  prompt: string;
  productUrl: string | null;
  productName: string | null;
  productDescription: string | null;
  productImageUrl: string | null;
  referenceImageUrls: string[];
  aspectRatio: string;
  createdAt: string;
  updatedAt: string;
  creativeCount: number;
  thumbnailUrl: string | null;
}

export async function listCampaigns(ownerUserId: string): Promise<CampaignListItem[]> {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const rows = await db.findMany<CampaignRow>('campaigns', { accountId }, { createdAt: -1 });
  const out: CampaignListItem[] = [];
  for (const c of rows) {
    const creativeCount = await db.countDocuments('posts', {
      account_id: accountId,
      campaign_id: c.id,
    });
    const thumbnailUrl = await thumbnailUrlForLatestPost(accountId, c.id);
    out.push({
      id: c.id,
      title: c.title,
      prompt: c.prompt,
      productUrl: c.productUrl ?? null,
      productName: c.productName ?? null,
      productDescription: c.productDescription ?? null,
      productImageUrl: c.productImageUrl ?? null,
      referenceImageUrls: normalizeReferenceImageUrls(c.referenceImageUrls),
      aspectRatio: c.aspectRatio ?? 'square',
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      creativeCount,
      thumbnailUrl,
    });
  }
  return out;
}

export async function getCampaign(ownerUserId: string, campaignId: string): Promise<CampaignListItem> {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const c = await db.findOne<CampaignRow>('campaigns', { _id: campaignId, accountId });
  if (!c) throw new NotFoundError('Campaign not found');
  const creativeCount = await db.countDocuments('posts', {
    account_id: accountId,
    campaign_id: c.id,
  });
  const thumbnailUrl = await thumbnailUrlForLatestPost(accountId, c.id);
  return {
    id: c.id,
    title: c.title,
    prompt: c.prompt,
    productUrl: c.productUrl ?? null,
    productName: c.productName ?? null,
    productDescription: c.productDescription ?? null,
    productImageUrl: c.productImageUrl ?? null,
    referenceImageUrls: normalizeReferenceImageUrls(c.referenceImageUrls),
    aspectRatio: c.aspectRatio ?? 'square',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    creativeCount,
    thumbnailUrl,
  };
}

export async function createCampaign(ownerUserId: string, input: CreateCampaignInput): Promise<CampaignListItem> {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const now = new Date().toISOString();
  const refUrls = input.reference_image_urls ?? [];
  const row = await db.insertOne<CampaignRow>('campaigns', {
    account_id: accountId,
    title: input.title,
    prompt: input.prompt,
    product_url: input.product_url ?? null,
    product_name: input.product_name ?? null,
    product_description: input.product_description ?? null,
    product_image_url: input.product_image_url ?? null,
    reference_image_urls: refUrls,
    aspect_ratio: input.aspect_ratio ?? 'square',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    productUrl: row.productUrl ?? null,
    productName: row.productName ?? null,
    productDescription: row.productDescription ?? null,
    productImageUrl: row.productImageUrl ?? null,
    referenceImageUrls: normalizeReferenceImageUrls(row.referenceImageUrls),
    aspectRatio: row.aspectRatio ?? 'square',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    creativeCount: 0,
    thumbnailUrl: null,
  };
}

export async function updateCampaign(
  ownerUserId: string,
  campaignId: string,
  input: PatchCampaignInput
): Promise<CampaignListItem> {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const existing = await db.findOne<CampaignRow>('campaigns', { _id: campaignId, accountId });
  if (!existing) throw new NotFoundError('Campaign not found');
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.prompt !== undefined) patch.prompt = input.prompt;
  if (input.product_url !== undefined) patch.product_url = input.product_url;
  if (input.product_name !== undefined) patch.product_name = input.product_name;
  if (input.product_description !== undefined) patch.product_description = input.product_description;
  if (input.product_image_url !== undefined) patch.product_image_url = input.product_image_url;
  if (input.reference_image_urls !== undefined) {
    patch.reference_image_urls = input.reference_image_urls ?? [];
  }
  if (input.aspect_ratio !== undefined) patch.aspect_ratio = input.aspect_ratio;
  await db.updateOne('campaigns', campaignId, patch);
  return getCampaign(ownerUserId, campaignId);
}

export async function softDeleteCampaign(ownerUserId: string, campaignId: string): Promise<void> {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const existing = await db.findOne<CampaignRow>('campaigns', { _id: campaignId, accountId });
  if (!existing) throw new NotFoundError('Campaign not found');
  await db.updateOne('campaigns', campaignId, {
    deleted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function generateCampaignCreative(
  ownerUserId: string,
  campaignId: string,
  premiumQuality?: boolean,
  productOverride?: {
    product_name?: string | null;
    product_description?: string | null;
    product_image_url?: string | null;
  }
): Promise<{ post: Record<string, unknown>; jobId: string; status: string }> {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const campaign = await db.findOne<CampaignRow>('campaigns', { _id: campaignId, accountId });
  if (!campaign) throw new NotFoundError('Campaign not found');

  const effective: CampaignRow = { ...campaign };
  if (productOverride) {
    if (productOverride.product_name !== undefined) {
      effective.productName = productOverride.product_name ?? null;
    }
    if (productOverride.product_description !== undefined) {
      effective.productDescription = productOverride.product_description ?? null;
    }
    if (productOverride.product_image_url !== undefined) {
      effective.productImageUrl = productOverride.product_image_url ?? null;
    }
  }

  const profile = await db.findOne<BusinessProfileRow>('business_profiles', { account_id: accountId });
  const contextText = buildCampaignContext(effective, profile);

  let photo: string | undefined;
  const refList = normalizeReferenceImageUrls(effective.referenceImageUrls);
  const tryUrls = [
    ...(effective.productImageUrl?.trim() ? [effective.productImageUrl.trim()] : []),
    ...refList,
  ];
  for (const u of tryUrls) {
    const dataUrl = await fetchImageAsDataUrl(u);
    if (dataUrl) {
      photo = dataUrl;
      break;
    }
  }

  const { post } = await createPost(ownerUserId, {
    template_id: 'auto',
    context_text: contextText,
    description: contextText,
    status: 'draft',
    campaign_id: campaign.id,
    photo,
  });

  const postId = (post as { id: string }).id;
  const { jobId, status } = await enqueueGenerate(ownerUserId, postId, premiumQuality);
  const full = await getPost(ownerUserId, postId);
  return { post: full, jobId, status };
}
