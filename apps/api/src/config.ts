import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function required(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

/** CORS allowlist: comma-separated origins. No wildcard in production. */
export function getCorsAllowlist(): string[] {
  const raw = optional('CORS_ALLOWLIST', 'http://localhost:19006,http://localhost:3000,http://127.0.0.1:19006,http://127.0.0.1:3000');
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

export const config = {
  port: parseInt(optional('PORT', '4000'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),
  // Supabase only for v1 — no MongoDB default
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  openaiApiKey: optional('OPENAI_API_KEY', ''),
  openaiCaptionModel: optional('OPENAI_CAPTION_MODEL', 'gpt-4o-mini'),
  openaiImageModelDefault: optional('OPENAI_IMAGE_MODEL_DEFAULT', 'gpt-image-1-mini'),
  openaiImageModelPremium: optional('OPENAI_IMAGE_MODEL_PREMIUM', 'gpt-image-1'),
  openaiImageEditTimeoutMs: parseInt(optional('OPENAI_IMAGE_EDIT_TIMEOUT_MS', '120000'), 10),
  openaiImageEditMaxRetries: parseInt(optional('OPENAI_IMAGE_EDIT_MAX_RETRIES', '3'), 10),
  storageBucket: optional('STORAGE_BUCKET', 'post-images'),
  aiProvider: (optional('AI_PROVIDER', 'mock') === 'openai' ? 'openai' : 'mock') as 'mock' | 'openai',
  // Optional Redis for BullMQ; if missing, use DB-backed queue
  redisUrl: optional('REDIS_URL', ''),
  // Rate limits (per window)
  rateLimitAuthWindowMs: parseInt(optional('RATE_LIMIT_AUTH_WINDOW_MS', '60000'), 10),
  rateLimitAuthMax: parseInt(optional('RATE_LIMIT_AUTH_MAX', '5'), 10),
  rateLimitPostsWindowMs: parseInt(optional('RATE_LIMIT_POSTS_WINDOW_MS', '60000'), 10),
  rateLimitPostsMax: parseInt(optional('RATE_LIMIT_POSTS_MAX', '60'), 10),
  rateLimitSubscriptionWindowMs: parseInt(optional('RATE_LIMIT_SUBSCRIPTION_WINDOW_MS', '60000'), 10),
  rateLimitSubscriptionMax: parseInt(optional('RATE_LIMIT_SUBSCRIPTION_MAX', '10'), 10),
  /**
   * Rate limit store: 'memory' (default, single-instance only), 'redis' (recommended for multi-instance),
   * or 'supabase' (table-backed for key endpoints when Redis is not available).
   * At ~100 businesses single-instance with memory is acceptable; know this limitation for scale.
   */
  rateLimitStore: (optional('RATE_LIMIT_STORE', 'memory').toLowerCase() || 'memory') as 'memory' | 'redis' | 'supabase',
  // Regen limits
  regenLimitTrialPerPost: 1,
  regenLimitPaidPerPost: 2,
  regenLimitPaidPerDay: 10,
  /** v1: scheduling disabled; no scheduled_at column. Set SCHEDULING_ENABLED=true to enable. */
  schedulingEnabled: process.env.SCHEDULING_ENABLED === 'true',
  /** When true, API process runs the job worker loop (default false for Render; run separate worker service). */
  runWorkerInProcess: process.env.RUN_WORKER_IN_PROCESS === 'true',
  /** When true and schedulingEnabled, API process runs the schedule processor (default false; do not run in prod API). */
  runSchedulerInProcess: process.env.RUN_SCHEDULER_IN_PROCESS === 'true',
  // Meta OAuth (Step 4). In production, required for social connect.
  metaAppId: optional('META_APP_ID', ''),
  metaAppSecret: optional('META_APP_SECRET', ''),
  metaRedirectUri: optional('META_REDIRECT_URI', ''),
  metaOauthScopes: optional(
    'META_OAUTH_SCOPES',
    'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  metaGraphVersion: optional('META_GRAPH_VERSION', 'v20.0'),
  publicAppUrl: optional('PUBLIC_APP_URL', 'http://localhost:19006'),
  tokenEncryptionKey: optional('TOKEN_ENCRYPTION_KEY', ''),
  // IAP (Step 6): server-side verification only
  appleSharedSecret: optional('APPLE_SHARED_SECRET', ''),
  appleProductIds: optional('APPLE_SUBSCRIPTION_PRODUCT_IDS', '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  googlePackageName: optional('GOOGLE_PLAY_PACKAGE_NAME', ''),
  googleProductIds: optional('GOOGLE_SUBSCRIPTION_PRODUCT_IDS', '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /** Path to Google service account JSON for Play Developer API, or leave empty to skip Android verify */
  googleServiceAccountKeyPath: optional('GOOGLE_SERVICE_ACCOUNT_KEY_PATH', ''),
  /** If false, publish jobs are rejected with a clear error (kill switch). Default true. */
  publishEnabled: process.env.PUBLISH_ENABLED !== 'false',
};

/** Fail startup in production if required env is missing. Clear error messages. */
export function validateProductionEnv(): void {
  if (config.nodeEnv !== 'production') return;
  const missing: string[] = [];
  if (!process.env.CORS_ALLOWLIST || process.env.CORS_ALLOWLIST.trim() === '') {
    missing.push('CORS_ALLOWLIST (comma-separated origins; required in production, no wildcard)');
  }
  if (!config.tokenEncryptionKey) {
    missing.push('TOKEN_ENCRYPTION_KEY');
  } else if (config.tokenEncryptionKey.length < 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be at least 32 bytes (base64 or hex).');
  }
  if (!config.metaAppId) missing.push('META_APP_ID');
  if (!config.metaAppSecret) missing.push('META_APP_SECRET');
  if (!config.metaRedirectUri) missing.push('META_REDIRECT_URI');
  if (missing.length > 0) {
    throw new Error(`Production env missing: ${missing.join('. ')}`);
  }
  if (config.appleProductIds.length > 0 && !config.appleSharedSecret) {
    throw new Error('Production: APPLE_SUBSCRIPTION_PRODUCT_IDS is set but APPLE_SHARED_SECRET is missing (required for iOS IAP verify).');
  }
}
