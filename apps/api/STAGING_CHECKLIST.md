# PostSnap staging verification checklist

Use this before promoting to production.

---

## Step 1: Two workers + 5 jobs + DB checks (DEV-only)

Run this to confirm the DB-backed queue and `claim_next_job` work with 2 workers and no duplicate processing.

1. **Start 2 workers** (two separate terminals):
   ```bash
   cd apps/api && npm run worker
   ```
   Leave both running. You should see `[worker] starting...` and `DB-backed job worker started` in each.

2. **Start the API** (optional for this test; needed if you use the app to create a user):
   ```bash
   cd apps/api && npm run dev
   ```
   If port 4000 is in use, set `PORT=4001` in `apps/api/.env` and update the frontend API URL.

3. **Ensure at least one Supabase Auth user exists.**  
   If none: sign up once in the app (frontend), then continue.

4. **Run the seed script** (creates 5 posts + 5 jobs; does not modify existing rows):
   ```bash
   cd apps/api
   node -r ts-node/register src/scripts/seedFivePosts.ts
   ```
   - **If you see:** `No Supabase Auth users found. Sign up once in the app...` → exit 0, no stack trace. Sign up in the app and run the script again.
   - **If success:** you should see created post IDs and job IDs printed.

5. **Wait 10–30 seconds** so both workers can claim and process the 5 jobs.

6. **Run the verification SQL in Supabase:**  
   Open **Supabase Dashboard → SQL Editor**, paste and run the contents of **`apps/api/scripts/CHECK_JOBS_AND_POSTS.sql`**.

7. **What “pass” looks like:**
   - **jobs:** Each of the 5 seed jobs has `status = 'done'`. No duplicate processing (each job row appears once, status not stuck in `pending` or `processing`).
   - **posts:** The 5 seed posts have `status = 'ready'` and `has_caption = true` (caption-only seed is OK; `has_processed_image` may be false if no image).

**Optional cleanup after verification:**  
To remove only the seed data (posts with `context_text` starting with `[seed]` and their jobs):
```bash
cd apps/api
node -r ts-node/register src/scripts/cleanupSeed.ts
```

---

## Confirmation items

### [ ] 1. Caption model is gpt-4o-mini

- **Where:** `config.ts` → `openaiCaptionModel` default `'gpt-4o-mini'`; overridable via `OPENAI_CAPTION_MODEL`.
- **Code:** `apps/api/src/config.ts`, `apps/api/src/providers/ai/openAIProvider.ts` (uses `config.openaiCaptionModel` in `generateCaption`).
- **Verify:** Set `OPENAI_CAPTION_MODEL=gpt-4o-mini` in staging `.env` (or leave unset for default). No code change needed.

### [ ] 2. Default image model is gpt-image-1-mini; premium is gpt-image-1

- **Where:** `config.ts` → `openaiImageModelDefault` / `openaiImageModelPremium`; overridable via `OPENAI_IMAGE_MODEL_DEFAULT` and `OPENAI_IMAGE_MODEL_PREMIUM`.
- **Code:** `apps/api/src/config.ts`, `apps/api/src/providers/ai/openAIProvider.ts` — `processImage()` uses `params.premiumQuality ? IMAGE_MODEL_PREMIUM : IMAGE_MODEL_DEFAULT`.
- **Verify:** Defaults are `gpt-image-1-mini` and `gpt-image-1`. Optional: set in `.env` and confirm in logs or one image generation.

### [ ] 3. Run one real caption generation in staging and validate strict JSON output

- **Flow:** POST `/api/v1/posts` (create post) → upload image (signed URL) → POST `/api/v1/posts/:id/upload-complete` → POST `/api/v1/posts/:id/generate` (enqueue) → worker runs → GET `/api/v1/posts/:id` returns `caption_json`.
- **Strict JSON:** `openAIProvider.generateCaption()` uses `response_format: { type: 'json_object' }`. Response is parsed with `parseCaptionJson()` in `parseCaptionResponse.ts`, which enforces shape `{ instagram: { caption, hashtags }, facebook: { caption, hashtags } }` and returns `null` on invalid/malformed JSON (then mock fallback).
- **Verify:** In staging, trigger one caption generation (with `OPENAI_API_KEY` and `AI_PROVIDER=openai`). Inspect stored `caption_json` and API response: must be valid JSON with `instagram` and `facebook` and string/array types. No raw markdown or extra text.

### [ ] 4. claim_next_job is applied in Supabase and works with 2 workers

- **Where:** Supabase SQL: `apps/api/supabase/RUN_IN_SUPABASE.sql` (section 3) and `apps/api/supabase/migrations/003_claim_next_job.sql`.
- **Behavior:** Function uses `SELECT ... FOR UPDATE SKIP LOCKED` then `UPDATE ... RETURNING` in one RPC. Only one worker can claim a given row; the other gets the next row or nothing.
- **Code:** `apps/api/src/jobs/generateQueue.ts` → `claimNextPendingJob()` calls `supabase.rpc('claim_next_job')`.
- **Verify:** Run the migration in Supabase if not already (execute `RUN_IN_SUPABASE.sql` or `003_claim_next_job.sql`). Start two API instances (or two worker processes) and enqueue several jobs; confirm each job is processed exactly once and no duplicate processing (check `jobs.status` and post updates).

### [ ] 5. API returns signed READ URLs on demand (do not store signed URLs in DB)

- **Storage:** DB stores only paths: `original_image_path`, `processed_image_path` (e.g. `account/{id}/posts/{id}/original.jpg`). No signed URL is stored.
- **On demand:** `createSignedReadUrl(storagePath)` in `storageService.ts` (READ_EXPIRY_SEC = 1 hour). Used when returning post data.
- **Endpoints:** `GET /api/v1/posts` and `GET /api/v1/posts/:id` now attach `photoUrl` and `processedImageUrl` (signed URLs) per post via `withSignedUrls()` in `postsService.ts`. Generated at response time only.
- **Verify:** In staging, GET a post that has image paths; response must include `photoUrl` and/or `processedImageUrl` (valid URLs that load in browser). DB must contain only path strings, not full URLs.

---

## Precaution: job claim must be atomic

- **Risk:** If job claim is not atomic, two workers can process the same job.
- **Current:** `claim_next_job()` in Supabase is atomic (FOR UPDATE SKIP LOCKED + single UPDATE RETURNING). No change needed if migration is applied.
- **Action:** Confirm migration is applied and run the 2-worker check in item 4.

---

## Precaution: signed URL expiry and regeneration

- **Risk:** If signed URLs expire quickly, clients may get 403 when loading images.
- **Current:** Read URLs expire in 1 hour (`storageService.ts` → `READ_EXPIRY_SEC = 60 * 60`). They are regenerated on every `GET /posts` and `GET /posts/:id` (new signed URL each time).
- **Action:** No change required. If you need longer expiry, increase `READ_EXPIRY_SEC` in `storageService.ts` (Supabase allows up to 1 year for signed URLs).

---

## Quick reference

| Item              | Config / location                          | Status |
|-------------------|--------------------------------------------|--------|
| Caption model     | `OPENAI_CAPTION_MODEL` → gpt-4o-mini       | [ ]    |
| Image default     | `OPENAI_IMAGE_MODEL_DEFAULT` → gpt-image-1-mini | [ ]    |
| Image premium     | `OPENAI_IMAGE_MODEL_PREMIUM` → gpt-image-1 | [ ]    |
| Caption JSON      | `parseCaptionJson` + `response_format: json_object` | [ ]    |
| claim_next_job    | Supabase migration + `generateQueue.claimNextPendingJob()` | [ ]    |
| Signed URLs       | `withSignedUrls()` in listPosts/getPost; not stored in DB | [ ]    |
