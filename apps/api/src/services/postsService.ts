import { getDb } from '../db';
import { getSupabase } from '../db/supabaseClient';
import { getAIProvider } from '../providers/ai';
import { CreatePostInput, PublishPostInput } from '../schemas/posts';
import { NotFoundError, ServiceUnavailableError, ValidationError } from '../utils/errors';
import { MockSubscriptionProvider, checkPublishEligible } from '../providers/subscription/mockSubscriptionProvider';
import { enqueueGeneration, enqueuePublishJob, GenerationJob } from '../jobs/generateQueue';
import { createSignedUploadUrl, createSignedReadUrl, getUploadPath } from './storageService';
import { generationHash } from '../utils/hash';
import { config } from '../config';
import { logger } from '../utils/logger';
import { requireAccountForUser } from './accountService';

const subscription = new MockSubscriptionProvider();

function toSafeDbMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : '';
  // Drop adapter prefixes; keep the underlying Supabase message.
  return msg.replace(/^Supabase (insertOne|updateOne) posts:\s*/i, '') || 'Database error';
}

interface PostRecord {
  id: string;
  accountId: string;
  status: string;
  templateId: string;
  contextText: string;
  originalImagePath?: string | null;
  processedImagePath?: string | null;
  captionJson?: Record<string, { caption: string; hashtags: string[] }> | null;
  publishTargets?: string[] | null;
  regenCount: number;
  lastGeneratedHash?: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

function postToLegacy(post: PostRecord): Record<string, any> {
  const caption = post.captionJson?.instagram?.caption ?? post.captionJson?.facebook?.caption ?? '';
  const out: Record<string, any> = {
    id: post.id,
    userId: post.accountId,
    template: post.templateId,
    description: post.contextText,
    caption,
    processedImage: post.processedImagePath,
    photo: post.originalImagePath,
    platforms: post.publishTargets ?? [],
    status: post.status,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    publishedAt: post.publishedAt,
  };
  if (post.captionJson) out.captionJson = post.captionJson;
  return out;
}

/** Attach signed READ URLs for image paths (generated on demand; never stored in DB). */
async function withSignedUrls(legacy: Record<string, any>, post: PostRecord): Promise<Record<string, any>> {
  const out = { ...legacy };
  try {
    if (post.originalImagePath) {
      out.photoUrl = await createSignedReadUrl(post.originalImagePath);
    }
    if (post.processedImagePath) {
      out.processedImageUrl = await createSignedReadUrl(post.processedImagePath);
    }
  } catch {
    // If signing fails, omit URLs; client still has paths for debugging
  }
  return out;
}

export async function listPosts(ownerUserId: string, filter?: string) {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const query: Record<string, any> = { account_id: accountId };
  if (filter && filter !== 'all') query.status = filter;
  const posts = await db.findMany<PostRecord>('posts', query, { createdAt: -1 });
  return Promise.all(posts.map((p) => withSignedUrls(postToLegacy(p), p)));
}

export async function getPost(ownerUserId: string, postId: string) {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const post = await db.findOne<PostRecord>('posts', { _id: postId });
  if (!post || post.accountId !== accountId) throw new NotFoundError('Post not found');
  return withSignedUrls(postToLegacy(post), post);
}

/** Create post (no base64). Returns post + uploadUrl for client to upload image. v1: no scheduling. */
export async function createPost(ownerUserId: string, input: {
  template_id?: string;
  context_text?: string;
  description?: string;
  template?: string;
  platforms?: string[];
  status?: string;
}) {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const now = new Date().toISOString();
  const templateId = input.template_id ?? input.template ?? 'auto';
  const contextText = (input.context_text ?? input.description ?? '').slice(0, 500);

  const payload = {
    account_id: accountId,
    status: input.status ?? 'draft',
    template_id: templateId,
    context_text: contextText,
    original_image_path: null,
    processed_image_path: null,
    caption_json: null,
    publish_targets: input.platforms ?? [],
    regen_count: 0,
    last_generated_hash: null,
    created_at: now,
    updated_at: now,
  };
  let post: PostRecord;
  try {
    post = await db.insertOne<PostRecord>('posts', payload);
  } catch (err) {
    throw new ValidationError(toSafeDbMessage(err));
  }

  let uploadUrl: string | null = null;
  let uploadPath: string | null = null;
  try {
    const signed = await createSignedUploadUrl(accountId, post.id);
    uploadUrl = signed.url;
    uploadPath = signed.path;
  } catch (err) {
    // Storage is optional for verification/v1; don't fail post creation if bucket is missing.
    logger.warn('Create post: signed upload URL unavailable', {
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
  return { post: postToLegacy(post), uploadUrl, uploadPath };
}

/** Legacy: save post (accepts description/template; no base64 stored). */
export async function savePost(ownerUserId: string, input: CreatePostInput) {
  const accountId = await requireAccountForUser(ownerUserId);
  const db = await getDb();
  const now = new Date().toISOString();

  if (input.postId) {
    const existing = await db.findOne<PostRecord>('posts', { _id: input.postId });
    if (existing && existing.accountId === accountId) {
      try {
        await db.updateOne('posts', existing.id, {
          context_text: input.description?.slice(0, 500) ?? existing.contextText,
          template_id: input.template ?? existing.templateId,
          publish_targets: input.platforms,
          status: input.status,
          updated_at: now,
        });
      } catch (err) {
        throw new ValidationError(toSafeDbMessage(err));
      }
      const updated = await db.findOne<PostRecord>('posts', { _id: existing.id });
      return postToLegacy(updated!);
    }
  }

  const insertPayload = {
    account_id: accountId,
    status: input.status ?? 'draft',
    template_id: input.template ?? 'auto',
    context_text: (input.description ?? '').slice(0, 500),
    original_image_path: null,
    processed_image_path: null,
    caption_json: null,
    publish_targets: input.platforms ?? [],
    regen_count: 0,
    created_at: now,
    updated_at: now,
  };
  let inserted: PostRecord;
  try {
    inserted = await db.insertOne<PostRecord>('posts', insertPayload);
  } catch (err) {
    throw new ValidationError(toSafeDbMessage(err));
  }
  return postToLegacy(inserted);
}

export async function markUploadComplete(ownerUserId: string, postId: string, storagePath: string) {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const post = await db.findOne<PostRecord>('posts', { _id: postId });
  if (!post || post.accountId !== accountId) throw new NotFoundError('Post not found');
  await db.updateOne('posts', postId, {
    original_image_path: storagePath,
    updated_at: new Date().toISOString(),
  });
  return getPost(ownerUserId, postId);
}

export async function deletePost(ownerUserId: string, postId: string) {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const post = await db.findOne<PostRecord>('posts', { _id: postId });
  if (!post || post.accountId !== accountId) throw new NotFoundError('Post not found');
  await db.deleteOne('posts', postId);
}

export async function enqueueGenerate(
  ownerUserId: string,
  postId: string,
  premiumQuality?: boolean
): Promise<{ jobId: string; status: string }> {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const post = await db.findOne<PostRecord>('posts', { _id: postId });
  if (!post || post.accountId !== accountId) throw new NotFoundError('Post not found');
  await db.updateOne('posts', postId, {
    status: 'generating',
    updated_at: new Date().toISOString(),
  });
  const job: GenerationJob = { userId: ownerUserId, postId, accountId, premiumQuality: !!premiumQuality };
  const jobId = await enqueueGeneration(job);
  return { jobId, status: 'accepted' };
}

/** Response when publish is accepted (async job). */
export interface PublishAccepted {
  jobId: string;
  status: 'accepted';
}

/** Response when publish already done (idempotent). */
export interface PublishResult {
  success: boolean;
  status: string;
  postedTo: string[];
  failed: string[];
  message: string;
}

export async function publishPost(
  ownerUserId: string,
  postId: string,
  input: PublishPostInput,
  idempotencyKey?: string
): Promise<PublishAccepted | PublishResult> {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const post = await db.findOne<PostRecord>('posts', { _id: postId });
  if (!post || post.accountId !== accountId) throw new NotFoundError('Post not found');

  const sub = await subscription.getStatus(ownerUserId);
  const subRecord = await db.findOne<{ trial_end_at?: string | null }>('subscriptions', {
    account_id: accountId,
  });
  checkPublishEligible(sub, subRecord?.trial_end_at ?? null);

  if (!config.publishEnabled) {
    throw new ServiceUnavailableError(
      'Publishing is temporarily disabled. Please try again later.'
    );
  }

  const platforms = input.platforms as ('facebook' | 'instagram')[];
  const existingResults = await db.findMany<{ platform: string; status: string }>(
    'post_publish_results',
    { post_id: postId }
  );

  if (idempotencyKey && existingResults.length > 0) {
    const published = existingResults.filter((r) => r.status === 'published').map((r) => r.platform);
    const allRequestedPublished = platforms.every((p) => published.includes(p));
    if (allRequestedPublished) {
      return {
        success: true,
        status: 'published',
        postedTo: platforms,
        failed: [],
        message: 'Already published (idempotent)',
      };
    }
  }

  if (post.status === 'published') {
    const published = existingResults.filter((r) => r.status === 'published').map((r) => r.platform);
    if (platforms.every((p) => published.includes(p))) {
      return {
        success: true,
        status: 'published',
        postedTo: platforms,
        failed: [],
        message: 'Already published',
      };
    }
  }

  const pendingPublishJobs = await db.findMany<{ id: string; status: string }>('jobs', {
    post_id: postId,
    type: 'publish',
  });
  const inProgress = pendingPublishJobs.find((j) => j.status === 'pending' || j.status === 'processing');
  if (inProgress) {
    return { jobId: inProgress.id, status: 'accepted' };
  }

  const jobId = await enqueuePublishJob({
    postId,
    accountId,
    ownerUserId,
    platforms,
    idempotencyKey,
  });
  await db.updateOne('posts', postId, {
    status: 'publishing',
    updated_at: new Date().toISOString(),
  });
  return { jobId, status: 'accepted' };
}

export async function getPostForWorker(postId: string): Promise<PostRecord | null> {
  const db = await getDb();
  return db.findOne<PostRecord>('posts', { _id: postId });
}

export async function getAccountForWorker(accountId: string) {
  const db = await getDb();
  const account = await db.findOne<Record<string, any>>('accounts', { id: accountId });
  const profile = await db.findOne<Record<string, any>>('business_profiles', {
    account_id: accountId,
  });
  return { account, profile };
}

export function getRegenLimits(isPaid: boolean): { perPost: number; perDay: number } {
  return isPaid
    ? { perPost: config.regenLimitPaidPerPost, perDay: config.regenLimitPaidPerDay }
    : { perPost: config.regenLimitTrialPerPost, perDay: 0 };
}

/** Count generation jobs completed today for this account (for per-day regen limit). */
export async function countCompletedGenerationJobsToday(accountId: string): Promise<number> {
  const supabase = getSupabase();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const iso = startOfDay.toISOString();
  const { data, error } = await supabase
    .from('jobs')
    .select('id')
    .eq('type', 'generate')
    .eq('status', 'done')
    .gte('updated_at', iso)
    .filter('payload->>accountId', 'eq', accountId);
  if (error) return 0;
  return Array.isArray(data) ? data.length : 0;
}
