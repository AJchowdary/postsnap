# PostSnap MVP – Exact Changes List

## Phase A — Architecture / Scale Fixes

### 1. MongoDB removed as default
- **`apps/api/src/config.ts`**: Removed `MONGO_URL`, `DB_NAME`, `DB_PROVIDER`. Config now requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only. No MongoDB default.
- **`apps/api/src/db/index.ts`**: `getDb()` always returns `SupabaseAdapter`; MongoDB adapter no longer used.
- **`apps/api/src/index.ts`**: Removed `getMongoDb()`; startup uses `getDb()` only.
- **`apps/api/src/db/mongoAdapter.ts`**: Left in repo but unused (can be deleted later).

### 2. Supabase as only DB (v1)
- **`apps/api/src/db/supabaseClient.ts`**: Now exports `getSupabase()` that uses `config.supabaseUrl` and `config.supabaseServiceKey` (no throw at import).
- **`apps/api/src/db/supabaseAdapter.ts`**: Full implementation of `IDatabase`: `findOne`, `findMany`, `insertOne`, `updateOne`, `upsertOne`, `deleteOne`, `countDocuments` with table mapping (accounts, business_profiles, social_connections, subscriptions, templates, posts, post_publish_results, jobs). Snake_case ↔ camelCase mapping. No base64 in DB.

### 3. Custom auth replaced with Supabase Auth
- **`apps/api/src/middleware/auth.ts`**: Replaced JWT verify with Supabase: `getSupabase().auth.getUser(token)`. Sets `req.userId = user.id`. `authenticate` and `optionalAuth` forward errors via `next()`.
- **`apps/api/src/utils/jwt.ts`**: No longer used (custom sign/verify removed).
- **`apps/api/src/services/authService.ts`**: No longer used (register/login removed; client must use Supabase Auth).
- **`apps/api/src/routes/auth.ts`**: Removed `POST /register` and `POST /login`. Only `GET /auth/me` (authenticate + return `{ userId }`). Added `authRateLimiter`.

### 4. CORS and request limits
- **`apps/api/src/config.ts`**: Added `getCorsAllowlist()` reading `CORS_ALLOWLIST` (comma-separated; default localhost origins).
- **`apps/api/src/server.ts`**: CORS uses allowlist (no `*`). `express.json({ limit: '2mb' })`. `app.disable('x-powered-by')`. Helmet with `contentSecurityPolicy: false`, `crossOriginResourcePolicy: 'cross-origin'`.

### 5. Rate limiting
- **`apps/api/src/config.ts`**: Added `rateLimitAuthWindowMs/Max`, `rateLimitPostsWindowMs/Max`, `rateLimitSubscriptionWindowMs/Max`, `regenLimitTrialPerPost`, `regenLimitPaidPerPost`, `regenLimitPaidPerDay`.
- **`apps/api/src/utils/errors.ts`**: Added `RateLimitError` (429).
- **`apps/api/src/middleware/rateLimit.ts`**: New file – `authRateLimiter` (5/min per IP), `postsRateLimiter` (60/min per user), `subscriptionRateLimiter` (10/min per user). Keys use `req.userId` when set.
- **`apps/api/src/routes/auth.ts`**: Uses `authRateLimiter`.
- **`apps/api/src/routes/posts.ts`**: Uses `authenticate` then `postsRateLimiter`.
- **`apps/api/src/routes/subscription.ts`**: Uses `subscriptionRateLimiter`; removed dev/set-status endpoint.

### 6. Regen limits
- **`apps/api/src/config.ts`**: `regenLimitTrialPerPost = 1`, `regenLimitPaidPerPost = 2`, `regenLimitPaidPerDay = 10`.
- **`apps/api/src/services/postsService.ts`**: Exported `getRegenLimits(isPaid)`.
- **`apps/api/src/jobs/generateQueue.ts`**: Worker checks `regenCount < perPost` and (when paid) total regens before running generation; returns error when limits hit.

---

## Phase B — Supabase Database and Storage

### 1. SQL migrations
- **`apps/api/supabase/migrations/001_initial_schema.sql`**: Tables: `accounts` (id, owner_user_id, business_type, created_at), `business_profiles` (account_id PK, name, city, logo_url, brand_color, brand_style, overlay_default_on, updated_at), `social_connections` (id, account_id, platform, handle_or_page, status, …), `subscriptions` (account_id PK, status, trial_type, trial_end_at, …), `templates` (id, business_type PK composite), `posts` (id, account_id, status, template_id, context_text, original_image_path, processed_image_path, caption_json, publish_targets, regen_count, last_generated_hash, …), `post_publish_results`, `jobs`. Indexes and RLS policies for all (owner via accounts.owner_user_id = auth.uid()).
- **`apps/api/supabase/migrations/002_seed_templates.sql`**: Seed rows for `templates` (id, business_type, title, description, default_overlay_text).

### 2. Storage
- **`apps/api/src/services/storageService.ts`**: New file – `getUploadPath(accountId, postId, file)`, `createSignedUploadUrl(accountId, postId)`, `createSignedReadUrl(storagePath)`. Paths: `account/{accountId}/posts/{postId}/original.jpg`, `processed.jpg`.
- **`apps/api/src/config.ts`**: `storageBucket` (default `post-images`).

### 3. Account / profile schema
- **`apps/api/src/services/accountService.ts`**: Rewritten for Supabase: `bootstrapAccount(ownerUserId)` creates account + business_profile + subscription with `trial_end_at = now + 14 days`, `status = trial_active`. `getAccount` / `upsertBusinessProfile` use `owner_user_id` and `business_profiles` with snake_case columns.

---

## Phase C — OpenAI Integration

### 1. Captions (GPT-5 mini)
- **`apps/api/src/providers/ai/prompts.ts`**: New file – `CAPTION_SYSTEM_PROMPT`, `CAPTION_USER_PROMPT` (forces JSON; IG 8–15 hashtags, FB 3–8).
- **`apps/api/src/providers/ai/IAIProvider.ts`**: `CaptionResult` type `{ instagram: { caption, hashtags }, facebook: { caption, hashtags } }`. `generateCaption` returns `CaptionResult`.
- **`apps/api/src/providers/ai/openAIProvider.ts`**: Uses `response_format: { type: 'json_object' }`, parses via `parseCaptionJson` (strict validation + fallback). Model from config `OPENAI_CAPTION_MODEL` (default `gpt-5-mini`).
- **`apps/api/src/providers/ai/parseCaptionResponse.ts`**: Strict JSON parse and validation; normalizes caption/hashtags; returns null on invalid shape (fallback to mock).
- **`apps/api/src/providers/ai/mockAIProvider.ts`**: Returns `CaptionResult` shape.

### 2. Image editing (gpt-image-1-mini / gpt-image-1)
- **`apps/api/src/providers/ai/prompts.ts`**: `IMAGE_EDIT_SYSTEM_PROMPT`, `IMAGE_EDIT_USER_PROMPT` (goals, style preset, brand color, overlay rules, safe 8%, 1080x1080, no watermark).
- **`apps/api/src/providers/ai/IAIProvider.ts`**: `ImageParams` extended with `imagePath`, `brandColor`, `overlayText`, `logoUrl`, `premiumQuality`.
- **`apps/api/src/providers/ai/openAIProvider.ts`**: `processImage` uses `IMAGE_MODEL_DEFAULT` / `IMAGE_MODEL_PREMIUM`, builds prompt from params; calls `client.images?.edit?.(…)` (stub-safe). Returns URL or null.

---

## Phase D — Async Queue and Caching

### 1. DB-backed job queue
- **`apps/api/src/jobs/generateQueue.ts`**: Rewritten. `enqueueGeneration(job)` inserts into `jobs` (post_id, type, status, payload). `claimNextPendingJob()` selects one pending job and updates to `processing` (conditional on status=’pending’). Worker loop runs every 2s, processes job: load post + account/profile, check regen limits, compute hash, if cache hit skip AI and mark job done; else call AI caption then image (image failure leaves caption, processed_image_path null), update post (caption_json, processed_image_path, last_generated_hash, regen_count, status=’ready’), mark job done. Retries with backoff (attempts, last_error, run_at).

### 2. Caching / dedupe
- **`apps/api/src/utils/hash.ts`**: New file – `generationHash(originalImagePath, templateId, contextText, brandStyle, brandColor, overlayDefaultOn, logoUrl, overlayText, modelQuality)` (sha256).
- **`apps/api/src/jobs/generateQueue.ts`**: If `post.lastGeneratedHash === hash` and caption_json and (processed_image_path or no original), skip OpenAI and return cached.

### 3. Failure fallback
- Worker: if image generation throws, log and continue; post still gets caption_json and status=’ready’, processed_image_path can stay null.

---

## Phase E — Entitlements / Trial / Paywall

- **`apps/api/src/providers/subscription/mockSubscriptionProvider.ts`**: `getStatus(ownerUserId)` resolves account_id; returns `trial_active` with `trial_end_at` (14 days from bootstrap), `isEligible = now <= trial_end_at` or `status === 'active_subscription'`. Exported `checkPublishEligible(subscriptionInfo, trialEndAt)` throws `PaymentRequiredError` with payload.
- **`apps/api/src/utils/errors.ts`**: `PaymentRequiredError` accepts optional `payload: PaymentRequiredPayload` (`upgrade_required`, `reason`, `status`, `trial_end_at`, `days_left`).
- **`apps/api/src/middleware/errorHandler.ts`**: If `PaymentRequiredError` with payload, respond 402 with `err.payload`.
- **`apps/api/src/services/postsService.ts`**: `publishPost` calls `checkPublishEligible` before publishing; 402 when trial ended or subscription inactive.
- **`apps/api/src/routes/subscription.ts`**: `POST /upgrade` and `POST /restore` stub set `active_subscription`.

---

## Phase F — Publishing

- **`apps/api/src/providers/posting/IPostingProvider.ts`**: `PostPayload` extended with `imageUrl?: string | null`.
- **`apps/api/src/services/postsService.ts`**: `publishPost` accepts `idempotencyKey` (header); if key present and `post_publish_results` already exist for post, return success (idempotent). Writes `post_publish_results` per platform. Sets post `status`: `published` / `partial_failed` / `failed`.
- **`apps/api/src/jobs/scheduleProcessor.ts`**: Uses `accountId` and `owner_user_id` for entitlement; caption from `captionJson`; passes `imageUrl` to provider.

---

## Phase G — Endpoints

- **`apps/api/src/server.ts`**: Mounts routes at `/api/v1` and `/api` (backward compat).
- **`apps/api/src/routes/account.ts`**: `POST /bootstrap`, `GET /me`, `PUT /profile` (unchanged paths).
- **`apps/api/src/routes/posts.ts`**: `GET /` (filter=drafts|published|all), `GET /:id`, `POST /` (returns `{ post, uploadUrl, uploadPath }` for new shape; legacy body still supported), `POST /:id/upload-complete` (body `{ path }`), `POST /:id/generate` (202, body `premium_quality` optional), `DELETE /:id`, `POST /:id/publish` (Idempotency-Key header, body `{ platforms }`).
- **`apps/api/src/routes/generate.ts`**: `POST /caption`, `POST /image` (sync; caption returns `result.instagram.caption` for UI).
- **`apps/api/src/routes/subscription.ts`**: `GET /status`, `POST /upgrade`, `POST /restore`.
- **`apps/api/src/routes/social.ts`**: `GET /`, `POST /connect`, `DELETE /disconnect/:platform` (stub).
- **`apps/api/src/routes/templates.ts`**: Unchanged (GET by businessType); can later load from DB.

---

## Phase H — Security Hardening

- Helmet and CORS: see Phase A.
- **`apps/api/src/middleware/errorHandler.ts`**: Sanitize logged meta (no password/token/secret/key).
- **`apps/api/src/utils/logger.ts`**: Redact sensitive keys in log meta (password, token, secret, key, authorization, service_role, api_key).
- **`apps/api/src/providers/ai/openAIProvider.ts`**: `sanitizeForPrompt()` caps length and strips control characters.
- **`apps/api/src/schemas/posts.ts`**: Zod validation on all post/generate/publish bodies.
- No `dev_secret_change_in_production` or JWT_SECRET in config.

---

## Phase I — Tests and Dev UX

- **`apps/api/jest.setup.ts`**: Sets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for tests if unset.
- **`apps/api/package.json`**: Jest `setupFiles` added.
- **`apps/api/src/__tests__/entitlements.test.ts`**: PaymentRequiredError payload.
- **`apps/api/src/__tests__/regenLimits.test.ts`**: Config regen limits.
- **`apps/api/src/__tests__/hash.test.ts`**: generationHash determinism and sensitivity to context/modelQuality.
- **`apps/api/.env.example`**: SUPABASE_*, OPENAI_API_KEY, STORAGE_BUCKET, CORS_ALLOWLIST, RATE_LIMIT_*, REDIS_URL, PORT.
- **`apps/api/README.md`**: Supabase setup (migrations, bucket), env vars, run API + worker, validate end-to-end.

---

## Frontend

- **`frontend/src/services/api.ts`**: `API_PREFIX = '/api/v1'`; `BASE_URL` from `EXPO_PUBLIC_API_BASE_URL` or `EXPO_PUBLIC_BACKEND_URL`. 402 handling: parse body, throw with `payload` for paywall. All requests use `${BASE_URL}${API_PREFIX}${path}`.

---

## Removed / Unused

- Default MongoDB connection and `DB_PROVIDER=mongo`.
- Custom JWT sign/verify and `JWT_SECRET`.
- `POST /auth/register`, `POST /auth/login` (client must use Supabase Auth and send Supabase JWT).
- Base64 image storage in posts (only paths/URLs in DB).
- Dev subscription endpoint `POST /subscription/dev/set-status`.

---

## Env Vars Summary

**API (.env):**  
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `STORAGE_BUCKET`, `CORS_ALLOWLIST`, `RATE_LIMIT_*`, `REDIS_URL` (optional), `PORT`.

**Mobile:**  
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_BASE_URL` (or `EXPO_PUBLIC_BACKEND_URL`).
