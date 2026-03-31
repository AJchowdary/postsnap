import { getDb } from '../db';
import { getSupabase } from '../db/supabaseClient';
import { CreatePostInput, PublishPostInput } from '../schemas/posts';
import { NotFoundError, ServiceUnavailableError, ValidationError } from '../utils/errors';
import { MockSubscriptionProvider, checkPublishEligible } from '../providers/subscription/mockSubscriptionProvider';
import { enqueueGeneration, enqueuePublishJob, GenerationJob } from '../jobs/generateQueue';
import {
  createSignedUploadUrl,
  createSignedReadUrl,
  decodeImageInputToBuffer,
  getUploadPath,
  uploadProcessedImage,
  uploadStorageObject,
} from './storageService';
import { config } from '../config';
import { logger } from '../utils/logger';
import { requireAccountForUser } from './accountService';
import type { PostExportAssets } from './postExportAssetsService';

const subscription = new MockSubscriptionProvider();

/** Max draft posts per account (Quickpost product limit). */
export const DRAFT_LIMIT = 6;

async function countDraftPostsForAccount(accountId: string): Promise<number> {
  const db = await getDb();
  return db.countDocuments('posts', { account_id: accountId, status: 'draft' });
}

function assertUnderDraftLimit(currentDraftCount: number): void {
  if (currentDraftCount >= DRAFT_LIMIT) {
    throw new ValidationError(
      `You have ${DRAFT_LIMIT} saved drafts. Delete one before saving a new draft.`
    );
  }
}

function toSafeDbMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : '';
  // Drop adapter prefixes; keep the underlying Supabase message.
  return msg.replace(/^Supabase (insertOne|updateOne) posts:\s*/i, '') || 'Database error';
}

/** Plain caption from client → same JSON shape as worker/OpenAI (for Meta publish). */
function buildCaptionJsonFromPlainCaption(caption: string | undefined | null): Record<string, { caption: string; hashtags: string[] }> | null {
  const t = (caption ?? '').trim().slice(0, 2200);
  if (!t) return null;
  const tags = [...new Set((t.match(/#[\w\u0080-\uFFFF]+/g) ?? []))].slice(0, 30);
  return {
    instagram: { caption: t, hashtags: tags },
    facebook: { caption: t, hashtags: tags.slice(0, 5) },
  };
}

/** Upload client-supplied base64/data-URL images to storage; returns snake_case DB patch keys. */
async function uploadClientImagesToStorage(
  accountId: string,
  postId: string,
  input: Pick<CreatePostInput, 'photo' | 'processedImage'>
): Promise<{ processed_image_path?: string; original_image_path?: string }> {
  const patch: { processed_image_path?: string; original_image_path?: string } = {};
  const proc = input.processedImage?.trim();
  if (proc) {
    try {
      patch.processed_image_path = await uploadProcessedImage(accountId, postId, proc);
    } catch (e) {
      logger.warn('Post image upload (processed) failed', {
        postId,
        error: e instanceof Error ? e.message : String(e),
      });
      throw new ValidationError(
        e instanceof Error ? e.message : 'Could not upload processed image. Try again or use a smaller image.'
      );
    }
  }
  const ph = input.photo?.trim();
  if (ph) {
    try {
      let buf: Buffer;
      if (ph.startsWith('data:')) {
        buf = await decodeImageInputToBuffer(ph);
      } else {
        buf = Buffer.from(ph, 'base64');
      }
      if (buf.length > 12 * 1024 * 1024) {
        throw new ValidationError('Photo exceeds 12MB after decode');
      }
      const path = getUploadPath(accountId, postId, 'original');
      await uploadStorageObject(path, buf, 'image/jpeg');
      patch.original_image_path = path;
    } catch (e) {
      if (e instanceof ValidationError) throw e;
      logger.warn('Post image upload (original) failed', {
        postId,
        error: e instanceof Error ? e.message : String(e),
      });
      throw new ValidationError(
        e instanceof Error ? e.message : 'Could not upload photo. Use JPEG or PNG, or try a smaller file.'
      );
    }
  }
  return patch;
}

interface PostRecord {
  id: string;
  accountId: string;
  campaignId?: string | null;
  status: string;
  templateId: string;
  contextText: string;
  originalImagePath?: string | null;
  processedImagePath?: string | null;
  exportAssets?: PostExportAssets | null;
  captionJson?: Record<string, { caption: string; hashtags: string[] }> | null;
  qualityScore?: number | null;
  qualityDimensions?: Record<string, number> | null;
  publishTargets?: string[] | null;
  regenCount: number;
  lastGeneratedHash?: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  scheduledAt?: string | null;
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
    exportAssets: post.exportAssets ?? undefined,
    photo: post.originalImagePath,
    platforms: post.publishTargets ?? [],
    status: post.status,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    publishedAt: post.publishedAt,
  };
  if (post.captionJson) out.captionJson = post.captionJson;
  if (post.qualityScore != null) out.qualityScore = post.qualityScore;
  if (post.qualityDimensions) out.qualityDimensions = post.qualityDimensions;
  if (post.campaignId) out.campaignId = post.campaignId;
  if (post.scheduledAt) out.scheduledAt = post.scheduledAt;
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

/** Create post. Returns post + optional signed upload URL for direct original upload. v1: no scheduling. */
export async function createPost(ownerUserId: string, input: {
  template_id?: string;
  context_text?: string;
  description?: string;
  template?: string;
  platforms?: string[];
  status?: string;
  caption?: string;
  photo?: string | null;
  processedImage?: string | null;
  campaign_id?: string | null;
  /** ISO timestamp when status is scheduled */
  scheduled_at?: string | null;
}) {
  const db = await getDb();
  const accountId = await requireAccountForUser(ownerUserId);
  const now = new Date().toISOString();
  const templateId = input.template_id ?? input.template ?? 'auto';
  const contextText = (input.context_text ?? input.description ?? '').slice(0, 500);
  const captionJson = buildCaptionJsonFromPlainCaption(input.caption ?? '');

  const status = input.status ?? 'draft';
  const scheduledAt =
    status === 'scheduled' && input.scheduled_at?.trim() ? input.scheduled_at.trim() : null;

  if (status === 'draft') {
    const n = await countDraftPostsForAccount(accountId);
    assertUnderDraftLimit(n);
  }

  const payload = {
    account_id: accountId,
    status,
    template_id: templateId,
    context_text: contextText,
    original_image_path: null,
    processed_image_path: null,
    caption_json: captionJson,
    publish_targets: input.platforms ?? [],
    regen_count: 0,
    last_generated_hash: null,
    campaign_id: input.campaign_id ?? null,
    scheduled_at: scheduledAt,
    created_at: now,
    updated_at: now,
  };
  let post: PostRecord;
  try {
    post = await db.insertOne<PostRecord>('posts', payload);
  } catch (err) {
    throw new ValidationError(toSafeDbMessage(err));
  }

  const imagePatch = await uploadClientImagesToStorage(accountId, post.id, {
    photo: input.photo ?? undefined,
    processedImage: input.processedImage ?? undefined,
  });
  if (Object.keys(imagePatch).length > 0) {
    try {
      await db.updateOne('posts', post.id, { ...imagePatch, updated_at: now });
      const refreshed = await db.findOne<PostRecord>('posts', { _id: post.id });
      if (refreshed) post = refreshed;
    } catch (err) {
      throw new ValidationError(toSafeDbMessage(err));
    }
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
  const legacy = postToLegacy(post);
  return { post: await withSignedUrls(legacy, post), uploadUrl, uploadPath };
}

/** Save post: persists caption_json and uploads photo/processed images for publish worker. */
export async function savePost(ownerUserId: string, input: CreatePostInput) {
  const accountId = await requireAccountForUser(ownerUserId);
  const db = await getDb();
  const now = new Date().toISOString();
  const captionJson = buildCaptionJsonFromPlainCaption(input.caption ?? '');

  if (input.postId) {
    const existing = await db.findOne<PostRecord>('posts', { _id: input.postId });
    if (existing && existing.accountId === accountId) {
      const imagePatch = await uploadClientImagesToStorage(accountId, existing.id, {
        photo: input.photo ?? undefined,
        processedImage: input.processedImage ?? undefined,
      });
      const nextStatus = input.status ?? existing.status;
      const scheduledAt =
        nextStatus === 'scheduled' && input.scheduledAt?.trim()
          ? input.scheduledAt.trim()
          : nextStatus === 'scheduled'
            ? existing.scheduledAt ?? null
            : null;

      if (nextStatus === 'draft' && existing.status !== 'draft') {
        const n = await countDraftPostsForAccount(accountId);
        assertUnderDraftLimit(n);
      }

      try {
        await db.updateOne('posts', existing.id, {
          context_text: input.description?.slice(0, 500) ?? existing.contextText,
          template_id: input.template ?? existing.templateId,
          publish_targets: input.platforms,
          status: nextStatus,
          caption_json: captionJson,
          scheduled_at: scheduledAt,
          ...imagePatch,
          updated_at: now,
        });
      } catch (err) {
        throw new ValidationError(toSafeDbMessage(err));
      }
      const updated = await db.findOne<PostRecord>('posts', { _id: existing.id });
      const p = updated!;
      return withSignedUrls(postToLegacy(p), p);
    }
  }

  const insertStatus = input.status ?? 'draft';
  const insertScheduledAt =
    insertStatus === 'scheduled' && input.scheduledAt?.trim() ? input.scheduledAt.trim() : null;

  if (insertStatus === 'draft') {
    const n = await countDraftPostsForAccount(accountId);
    assertUnderDraftLimit(n);
  }

  const insertPayload = {
    account_id: accountId,
    status: insertStatus,
    template_id: input.template ?? 'auto',
    context_text: (input.description ?? '').slice(0, 500),
    original_image_path: null,
    processed_image_path: null,
    caption_json: captionJson,
    publish_targets: input.platforms ?? [],
    regen_count: 0,
    scheduled_at: insertScheduledAt,
    created_at: now,
    updated_at: now,
  };
  let inserted: PostRecord;
  try {
    inserted = await db.insertOne<PostRecord>('posts', insertPayload);
  } catch (err) {
    throw new ValidationError(toSafeDbMessage(err));
  }

  const imagePatch = await uploadClientImagesToStorage(accountId, inserted.id, {
    photo: input.photo ?? undefined,
    processedImage: input.processedImage ?? undefined,
  });
  if (Object.keys(imagePatch).length > 0) {
    try {
      await db.updateOne('posts', inserted.id, { ...imagePatch, updated_at: now });
      const refreshed = await db.findOne<PostRecord>('posts', { _id: inserted.id });
      if (refreshed) inserted = refreshed;
    } catch (err) {
      throw new ValidationError(toSafeDbMessage(err));
    }
  }

  return withSignedUrls(postToLegacy(inserted), inserted);
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
