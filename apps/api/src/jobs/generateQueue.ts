/**
 * DB-backed job queue for AI generation and publish.
 * Worker polls pending jobs (Postgres `claim_next_job`); optional Redis `job:lock:*` when `REDIS_URL` is set.
 */
import { getDb } from '../db';
import { getAIProvider } from '../providers/ai';
import { logger } from '../utils/logger';
import {
  brandBrainGenerationFingerprint,
  generationHash,
  isGenerationCacheHit,
} from '../utils/hash';
import {
  getPostForWorker,
  getAccountForWorker,
  getRegenLimits,
  countCompletedGenerationJobsToday,
} from '../services/postsService';
import { getOverlayText } from '../providers/ai/prompts';
import { trackEvent } from '../services/analyticsEvents';
import {
  createSignedReadUrl,
  createSignedReadUrlWithTTL,
  decodeImageInputToBuffer,
  uploadProcessedImageFromBuffer,
} from '../services/storageService';
import {
  ensurePostExportAssetsIfNeeded,
  generateAndUploadPostExportAssets,
  getPublishStoragePathForPlatform,
  type PostExportAssets,
} from '../services/postExportAssetsService';
import { getSupabase } from '../db/supabaseClient';
import { redisClient } from '../lib/redis';
import { config } from '../config';
import { getMetaConnectionOrThrow } from '../services/metaOAuthService';
import { postToFacebookPage, postToInstagram, isTransientPublishError } from '../providers/posting/metaPostingProvider';

export interface GenerationJob {
  userId: string;
  postId: string;
  accountId: string;
  premiumQuality?: boolean;
}

export interface PublishJobPayload {
  postId: string;
  accountId: string;
  ownerUserId: string;
  platforms: ('facebook' | 'instagram')[];
  idempotencyKey?: string;
}

interface JobRecord {
  id: string;
  postId: string;
  type: string;
  status: string;
  attempts: number;
  runAt: string;
  lastError?: string | null;
  payload: GenerationJob | PublishJobPayload;
  result?: any;
  createdAt: string;
  updatedAt: string;
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [5000, 30000, 120000];

const STUDIO_STYLE_VALUES = [
  'clean-white',
  'lifestyle',
  'dark-dramatic',
  'flat-lay',
  'outdoor-natural',
] as const;

function parseStudioStylePreference(
  raw: unknown,
  hasSourcePhoto: boolean
): (typeof STUDIO_STYLE_VALUES)[number] | undefined {
  if (!hasSourcePhoto || raw == null || typeof raw !== 'string') return undefined;
  return (STUDIO_STYLE_VALUES as readonly string[]).includes(raw)
    ? (raw as (typeof STUDIO_STYLE_VALUES)[number])
    : undefined;
}

/** Distributed lock TTL so a dead worker’s key expires (Postgres `claim_next_job` is still authoritative). */
const JOB_LOCK_TTL_SEC = 30 * 60;

async function releaseJobToPending(jobId: string): Promise<void> {
  const db = await getDb();
  await db.updateOne('jobs', jobId, {
    status: 'pending',
    updated_at: new Date().toISOString(),
  });
}

export async function enqueueGeneration(job: GenerationJob): Promise<string> {
  const db = await getDb();
  const record = await db.insertOne<JobRecord>('jobs', {
    post_id: job.postId,
    type: 'generate',
    status: 'pending',
    attempts: 0,
    run_at: new Date().toISOString(),
    payload: job,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return record.id;
}

export async function enqueuePublishJob(payload: PublishJobPayload): Promise<string> {
  const db = await getDb();
  const record = await db.insertOne<JobRecord>('jobs', {
    post_id: payload.postId,
    type: 'publish',
    status: 'pending',
    attempts: 0,
    run_at: new Date().toISOString(),
    payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return record.id;
}

/** Atomically claim one pending job (FOR UPDATE SKIP LOCKED + UPDATE RETURNING via claim_next_job()). */
async function claimNextPendingJob(): Promise<JobRecord | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('claim_next_job');
  if (error) {
    logger.warn('claim_next_job RPC failed', { error: error.message });
    return null;
  }
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    postId: row.post_id as string,
    type: row.type as string,
    status: row.status as string,
    attempts: (row.attempts as number) ?? 0,
    runAt: row.run_at as string,
    lastError: row.last_error as string | null,
    payload: row.payload as GenerationJob,
    result: row.result,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  } as JobRecord;
}

const PUBLISH_SIGNED_URL_TTL_SEC = 20 * 60; // 20 min for Meta to fetch (configurable via constant)
const PUBLISH_MAX_ATTEMPTS = 3;
const PUBLISH_BACKOFF_MS = [5000, 30000, 120000];

async function processPublishJob(job: JobRecord): Promise<void> {
  const payload = job.payload as PublishJobPayload;
  const db = await getDb();
  const now = new Date().toISOString();

  if (!config.publishEnabled) {
    const msg = 'Publishing is temporarily disabled (PUBLISH_ENABLED=false).';
    for (const platform of payload.platforms) {
      await db.insertOne('post_publish_results', {
        post_id: payload.postId,
        platform,
        platform_post_id: null,
        status: 'failed',
        error_message: msg,
        published_at: null,
        created_at: now,
      });
    }
    await db.updateOne('posts', payload.postId, {
      status: 'failed',
      updated_at: now,
    });
    await db.updateOne('jobs', job.id, {
      status: 'error',
      last_error: msg,
      updated_at: now,
    });
    logger.warn(`Publish job ${job.id} rejected: ${msg}`);
    return;
  }

  const post = await getPostForWorker(payload.postId);
  if (!post) {
    await db.updateOne('jobs', job.id, {
      status: 'error',
      last_error: 'Post not found',
      updated_at: now,
    });
    return;
  }
  const hasBaseImage = !!(post.processedImagePath ?? post.originalImagePath);
  if (!hasBaseImage) {
    const noImageMsg = 'No image available';
    for (const platform of payload.platforms) {
      await db.insertOne('post_publish_results', {
        post_id: payload.postId,
        platform,
        platform_post_id: null,
        status: 'failed',
        error_message: noImageMsg,
        published_at: null,
        created_at: now,
      });
    }
    await db.updateOne('posts', payload.postId, {
      status: 'failed',
      updated_at: now,
    });
    await db.updateOne('jobs', job.id, {
      status: 'done',
      last_error: noImageMsg,
      updated_at: now,
    });
    return;
  }

  let exportAssets: PostExportAssets | null = post.exportAssets ?? null;
  try {
    const ensured = await ensurePostExportAssetsIfNeeded(
      {
        id: post.id,
        exportAssets: post.exportAssets,
        processedImagePath: post.processedImagePath ?? null,
      },
      payload.accountId
    );
    if (ensured) exportAssets = ensured;
  } catch (err: any) {
    logger.warn('Publish: export asset build failed', { postId: post.id, error: err?.message });
  }

  const caption =
    (post.captionJson?.instagram?.caption ?? post.captionJson?.facebook?.caption ?? '').slice(0, 2000);
  const existingResults = await db.findMany<{ platform: string; status: string }>(
    'post_publish_results',
    { post_id: payload.postId }
  );
  const alreadyPublished = new Set(
    existingResults.filter((r) => r.status === 'published').map((r) => r.platform)
  );
  const toPublish = payload.platforms.filter((p) => !alreadyPublished.has(p));
  const posted = [...alreadyPublished];
  const failed: string[] = [];
  const errors: Record<string, string> = {};
  /** Per-platform: true only if the failure was transient (429, 5xx, timeout). */
  const transientByPlatform: Record<string, boolean> = {};

  for (const platform of toPublish) {
    try {
      const storagePath = getPublishStoragePathForPlatform(
        {
          exportAssets,
          processedImagePath: post.processedImagePath ?? null,
          originalImagePath: post.originalImagePath ?? null,
        },
        platform
      );
      if (!storagePath) throw new Error('No image path for platform');
      let imageUrl: string;
      try {
        imageUrl = await createSignedReadUrlWithTTL(storagePath, PUBLISH_SIGNED_URL_TTL_SEC);
      } catch (urlErr: any) {
        throw new Error(urlErr?.message ?? 'Failed to generate image URL');
      }

      const conn = await getMetaConnectionOrThrow(payload.ownerUserId, platform);
      if (platform === 'facebook') {
        if (!conn.metaPageId) throw new Error('Page not linked');
        const result = await postToFacebookPage({
          pageId: conn.metaPageId,
          pageAccessToken: conn.accessToken,
          message: caption,
          imageUrlOrPath: imageUrl,
        });
        await db.insertOne('post_publish_results', {
          post_id: payload.postId,
          platform: 'facebook',
          platform_post_id: result.platformPostId,
          status: 'published',
          published_at: now,
          created_at: now,
        });
        posted.push('facebook');
        void trackEvent({
          name: 'POST_PUBLISHED',
          accountId: payload.accountId,
          postId: payload.postId,
          properties: {
            platform: 'facebook',
            qualityScore: post.qualityScore ?? null,
          },
        });
      } else {
        if (!conn.igBusinessId) throw new Error('Instagram not linked');
        const result = await postToInstagram({
          igBusinessId: conn.igBusinessId,
          pageAccessToken: conn.accessToken,
          caption,
          imageUrlOrPath: imageUrl,
        });
        await db.insertOne('post_publish_results', {
          post_id: payload.postId,
          platform: 'instagram',
          platform_post_id: result.platformPostId,
          status: 'published',
          published_at: now,
          created_at: now,
        });
        posted.push('instagram');
        void trackEvent({
          name: 'POST_PUBLISHED',
          accountId: payload.accountId,
          postId: payload.postId,
          properties: {
            platform: 'instagram',
            qualityScore: post.qualityScore ?? null,
          },
        });
      }
    } catch (err: any) {
      const transient = err?.transient === true || isTransientPublishError(err?.status, err?.data);
      const msg = err?.message ?? 'Publish failed';
      errors[platform] = msg;
      transientByPlatform[platform] = transient;
      failed.push(platform);
      await db.insertOne('post_publish_results', {
        post_id: payload.postId,
        platform,
        platform_post_id: null,
        status: 'failed',
        error_message: msg,
        published_at: null,
        created_at: now,
      });
      if (!transient) {
        logger.warn(`Publish ${platform} failed (permanent)`, { postId: payload.postId, message: msg });
      }
    }
  }

  const postStatus =
    posted.length === payload.platforms.length
      ? 'published'
      : posted.length > 0
        ? 'partial_failed'
        : 'failed';
  await db.updateOne('posts', payload.postId, {
    status: postStatus,
    published_at: posted.length > 0 ? now : null,
    publish_targets: posted,
    updated_at: now,
  });

  const attempts = (job.attempts ?? 0) + 1;
  const anyFailedTransient = failed.some((p) => transientByPlatform[p] === true);
  const shouldRetry =
    failed.length > 0 &&
    attempts < PUBLISH_MAX_ATTEMPTS &&
    anyFailedTransient;
  if (shouldRetry) {
    const nextRun = new Date(Date.now() + (PUBLISH_BACKOFF_MS[attempts - 1] ?? 120000));
    await db.updateOne('jobs', job.id, {
      status: 'pending',
      attempts,
      last_error: Object.values(errors).join('; '),
      run_at: nextRun.toISOString(),
      updated_at: now,
    });
    return;
  }
  await db.updateOne('jobs', job.id, {
    status: 'done',
    result: { posted, failed },
    last_error: failed.length > 0 ? Object.values(errors).join('; ') : null,
    updated_at: now,
  });
  logger.info(`Publish job ${job.id} completed for post ${payload.postId}`, {
    posted: posted.length,
    failed: failed.length,
  });
}

async function processJob(job: JobRecord): Promise<void> {
  if (job.type === 'publish') {
    await processPublishJob(job);
    return;
  }
  const payload = job.payload as GenerationJob;
  const db = await getDb();
  const post = await getPostForWorker(job.postId);
  if (!post) {
    await db.updateOne('jobs', job.id, {
      status: 'error',
      last_error: 'Post not found',
      updated_at: new Date().toISOString(),
    });
    return;
  }

  const { account, profile } = await getAccountForWorker(payload.accountId);
  const businessName = profile?.name ?? account?.name ?? 'My Business';
  const businessType = (account?.businessType ?? account?.business_type ?? 'restaurant') as string;
  const brandStyle = (profile?.brandStyle ?? profile?.brand_style ?? 'clean') as string;
  const brandColor = profile?.brandColor ?? profile?.brand_color ?? null;
  const overlayDefaultOn = profile?.overlayDefaultOn ?? profile?.overlay_default_on ?? false;
  const logoUrl = profile?.logoUrl ?? profile?.logo_url ?? null;
  const hasSourcePhoto = !!post.originalImagePath;
  const studioStylePreference = parseStudioStylePreference(
    profile?.studioStylePreference ?? profile?.studio_style_preference,
    hasSourcePhoto
  );
  const dominantColors = Array.isArray(profile?.dominantColors)
    ? (profile.dominantColors as string[])
    : Array.isArray(profile?.dominant_colors)
      ? (profile.dominant_colors as string[])
      : [];
  const toneOfVoice = (profile?.toneOfVoice ?? profile?.tone_of_voice) as string | undefined;
  const contentPersona = (profile?.contentPersona ?? profile?.content_persona) as string | undefined;
  const uniqueDifferentiator = (profile?.uniqueDifferentiator ??
    profile?.unique_differentiator) as string | undefined;
  const visualStyle = (profile?.visualStyle ?? profile?.visual_style) as string | undefined;
  const studioBgColor = (profile?.studioBgColor ?? profile?.studio_bg_color) as string | undefined;
  const coreServices = Array.isArray(profile?.coreServices)
    ? (profile.coreServices as string[])
    : Array.isArray(profile?.core_services)
      ? (profile.core_services as string[])
      : [];
  const heroProduct = (profile?.heroProduct ?? profile?.hero_product) as string | undefined;

  const sub = await db.findOne<{ status: string }>('subscriptions', {
    account_id: payload.accountId,
  });
  const isPaid = sub?.status === 'active_subscription';
  const { perPost, perDay } = getRegenLimits(isPaid);

  const regenCount = post.regenCount ?? 0;
  if (regenCount >= perPost) {
    await db.updateOne('jobs', job.id, {
      status: 'error',
      last_error: 'Regen limit per post exceeded',
      updated_at: new Date().toISOString(),
    });
    return;
  }
  if (perDay > 0) {
    const doneToday = await countCompletedGenerationJobsToday(payload.accountId);
    if (doneToday >= perDay) {
      await db.updateOne('jobs', job.id, {
        status: 'error',
        last_error: 'Regen limit per day exceeded',
        updated_at: new Date().toISOString(),
      });
      return;
    }
  }

  const modelQuality = payload.premiumQuality ? 'premium' : 'default';
  const overlayText = overlayDefaultOn
    ? getOverlayText(post.templateId ?? 'auto', post.contextText ?? '', businessType)
    : '';
  const hash = generationHash({
    originalImagePath: post.originalImagePath ?? null,
    templateId: post.templateId,
    contextText: post.contextText,
    brandStyle,
    brandColor,
    overlayDefaultOn,
    logoUrl,
    overlayText,
    modelQuality,
    studioStylePreference: studioStylePreference ?? null,
    brandBrainFingerprint: brandBrainGenerationFingerprint({
      studioStylePreference: studioStylePreference ?? null,
      toneOfVoice: toneOfVoice ?? null,
      contentPersona: contentPersona ?? null,
      uniqueDifferentiator: uniqueDifferentiator ?? null,
      visualStyle: visualStyle ?? null,
      studioBgColor: studioBgColor ?? null,
      dominantColors: dominantColors.length ? dominantColors : null,
    }),
  });

  if (isGenerationCacheHit(post, hash)) {
    logger.info(`Job ${job.id} skipped (cache hit) for post ${post.id}`);
    const now = new Date().toISOString();
    try {
      await ensurePostExportAssetsIfNeeded(
        {
          id: post.id,
          exportAssets: post.exportAssets,
          processedImagePath: post.processedImagePath ?? null,
        },
        payload.accountId
      );
    } catch (e: any) {
      logger.warn('Cache-hit export backfill failed', { postId: post.id, error: e?.message });
    }
    await db.updateOne('posts', post.id, { status: 'ready', updated_at: now });
    await db.updateOne('jobs', job.id, {
      status: 'done',
      result: { cached: true },
      updated_at: now,
    });
    void trackEvent({
      name: 'POST_GENERATED',
      accountId: payload.accountId,
      postId: post.id,
      properties: { cached: true, source: 'worker' },
    });
    return;
  }

  const ai = getAIProvider();
  const now = new Date().toISOString();

  try {
    const captionResult = await ai.generateCaption({
      description: post.contextText,
      template: post.templateId ?? 'auto',
      businessName,
      businessType,
      brandStyle,
      displayType: profile?.displayType ?? profile?.display_type,
      aiCategory: businessType,
      customDescription: profile?.customDescription ?? profile?.custom_description ?? '',
      brandColor: profile?.brandColor ?? profile?.brand_color,
      brandVibe: profile?.brandVibe ?? profile?.brand_vibe,
      dominantColors: dominantColors.length ? dominantColors : undefined,
      websiteSummary: profile?.websiteSummary ?? profile?.website_summary,
      city: profile?.city,
      neighborhood: profile?.neighborhood ?? undefined,
      instagramHandle: profile?.instagramHandle ?? profile?.instagram_handle,
      platform: 'Instagram & Facebook',
      studioStylePreference,
      toneOfVoice,
      contentPersona,
      uniqueDifferentiator,
      visualStyle,
      studioBgColor,
      brandColors: dominantColors.length ? dominantColors : undefined,
      coreServices: coreServices.length ? coreServices : undefined,
      heroProduct: heroProduct ?? undefined,
      detectionContext: { accountId: payload.accountId, postId: post.id, source: 'worker' },
    });

    let processedImagePath: string | null = null;
    let exportAssetsPayload: PostExportAssets | null = null;
    if (post.originalImagePath) {
      try {
        const imageUrl = await createSignedReadUrl(post.originalImagePath);
        const processedResult = await ai.processImage({
          imagePath: imageUrl,
          templateId: post.templateId ?? 'auto',
          businessName,
          businessType,
          brandStyle,
          brandColor,
          description: post.contextText ?? '',
          overlayText: overlayText || undefined,
          logoUrl: overlayDefaultOn ? logoUrl ?? undefined : undefined,
          premiumQuality: payload.premiumQuality ?? false,
          displayType: profile?.displayType ?? profile?.display_type,
          aiCategory: businessType,
          customDescription: profile?.customDescription ?? profile?.custom_description ?? '',
          brandVibe: profile?.brandVibe ?? profile?.brand_vibe,
          websiteSummary: profile?.websiteSummary ?? profile?.website_summary,
          dominantColors: dominantColors.length ? dominantColors : undefined,
          city: profile?.city,
          instagramHandle: profile?.instagramHandle ?? profile?.instagram_handle,
          studioStylePreference,
          toneOfVoice,
          contentPersona,
          uniqueDifferentiator,
          visualStyle,
          studioBgColor,
          brandColors: dominantColors.length ? dominantColors : undefined,
        });
        const processedDataUrlOrUrl =
          processedResult?.withOverlay ?? processedResult?.clean ?? null;
        if (processedDataUrlOrUrl) {
          const masterBuf = await decodeImageInputToBuffer(processedDataUrlOrUrl);
          processedImagePath = await uploadProcessedImageFromBuffer(
            payload.accountId,
            post.id,
            masterBuf
          );
          try {
            exportAssetsPayload = await generateAndUploadPostExportAssets(
              payload.accountId,
              post.id,
              masterBuf
            );
          } catch (ex: any) {
            logger.warn(`Export assets failed for post ${post.id}`, { error: ex.message });
          }
        }
      } catch (imgErr: any) {
        logger.warn(`Image generation failed for post ${post.id}, keeping captions`, {
          error: imgErr.message,
        });
      }
    }

    await db.updateOne('posts', post.id, {
      caption_json: captionResult,
      processed_image_path: processedImagePath,
      export_assets: exportAssetsPayload,
      last_generated_hash: hash,
      regen_count: (post.regenCount ?? 0) + 1,
      status: 'ready',
      updated_at: now,
      quality_score: captionResult.meta?.qualityScore ?? null,
      quality_dimensions: captionResult.meta?.qualityDimensions ?? null,
    });

    await db.updateOne('jobs', job.id, {
      status: 'done',
      result: { caption: captionResult, processedImagePath },
      updated_at: now,
    });
    void trackEvent({
      name: 'POST_GENERATED',
      accountId: payload.accountId,
      postId: post.id,
      properties: {
        premiumQuality: !!payload.premiumQuality,
        regen: (post.regenCount ?? 0) > 0,
        qualityScore: captionResult.meta?.qualityScore ?? null,
        source: 'worker',
      },
    });
    logger.info(`Job ${job.id} completed for post ${post.id}`);
  } catch (err: any) {
    const attempts = (job.attempts ?? 0) + 1;
    const nextRun = new Date(Date.now() + (BACKOFF_MS[attempts - 1] ?? 120000));
    const status = attempts >= MAX_ATTEMPTS ? 'dead_letter' : 'pending';
    await db.updateOne('jobs', job.id, {
      status,
      attempts,
      last_error: err.message,
      run_at: status === 'pending' ? nextRun.toISOString() : undefined,
      updated_at: now,
    });
    if (status === 'dead_letter') {
      logger.error(`Job ${job.id} moved to dead letter after ${attempts} attempts`, { error: err.message });
    } else {
      logger.error(`Job ${job.id} failed (attempt ${attempts})`, { error: err.message });
    }
  }
}

export async function runWorkerLoop(): Promise<void> {
  const job = await claimNextPendingJob();
  if (!job) return;

  if (redisClient) {
    const lockKey = `job:lock:${job.id}`;
    try {
      const acquired = await redisClient.set(lockKey, '1', 'EX', JOB_LOCK_TTL_SEC, 'NX');
      if (acquired !== 'OK') {
        logger.warn('Job lock not acquired; releasing job to pending', { jobId: job.id });
        await releaseJobToPending(job.id);
        return;
      }
    } catch (err: any) {
      logger.warn('Redis job lock error; releasing job to pending', { jobId: job.id, error: err?.message });
      try {
        await releaseJobToPending(job.id);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      await processJob(job);
    } finally {
      await redisClient.del(lockKey).catch(() => {});
    }
    return;
  }

  await processJob(job);
}

export function startWorker(): void {
  logger.info('DB-backed job worker started');
  const interval = setInterval(() => {
    runWorkerLoop().catch((e) => logger.error('Worker tick error', { error: (e as Error).message }));
  }, 2000);
  runWorkerLoop().catch((e) => logger.error('Worker initial run', { error: (e as Error).message }));
}
