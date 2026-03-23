# PostSnap staging checklist (consolidated)

Use this before promoting to production. Combines queue, security, generation, OAuth, publish, and IAP checks.

---

## Step 1: Queue + DB (two workers)

- [ ] Start 2 workers: `cd apps/api && npm run worker` in two terminals.
- [ ] Start API: `cd apps/api && npm run dev`.
- [ ] Run seed: `node -r ts-node/register src/scripts/seedFivePosts.ts` (after at least one Supabase Auth user exists).
- [ ] Wait 10–30s; run `apps/api/scripts/CHECK_JOBS_AND_POSTS.sql` in Supabase.
- [ ] Pass: all 5 jobs `status = 'done'`; 5 posts `status = 'ready'`; no duplicate processing.

See **apps/api/STAGING_CHECKLIST.md** for full Step 1 detail.

---

## Step 2: Security

- [ ] Signed URLs: GET `/api/v1/posts` and `/posts/:id` return `photoUrl` / `processedImageUrl`; DB stores only paths (no full URLs).
- [ ] Tokens: Never returned to client; logger redacts token/receipt/secret keys.
- [ ] Auth: Protected routes require valid Supabase JWT; 401 on missing/invalid.

---

## Step 3: Generation

- [ ] Caption model: `OPENAI_CAPTION_MODEL` (default gpt-5-mini); strict JSON output.
- [ ] Image models: default gpt-image-1-mini, premium gpt-image-1.
- [ ] One real caption generation in staging; validate `caption_json` shape (instagram/facebook, caption, hashtags).

---

## Step 4: OAuth (Meta) + diagnostics

- [ ] **Diagnostics:** `GET /api/v1/social/meta/diagnostics` (with auth) returns `metaRedirectUri`, `connections`, `envPresent`, `warnings`. No secrets.
- [ ] **Local fallback:** When `PUBLIC_APP_URL` is localhost or unset, Meta callback redirects to API-hosted `/api/v1/social/oauth/success` and `/api/v1/social/oauth/error`. Open error page and confirm “Next steps” and reason/code are shown.
- [ ] **Connect flow:** From app, start Facebook/Instagram connect → complete OAuth → success or error page shows platform and status. Fix any misconfig using diagnostics and error-page hints.

---

## Step 5: Publish (once OAuth works)

- [ ] POST `/api/v1/posts/:id/publish` with `Idempotency-Key` and both platforms → 202 and `jobId`.
- [ ] Poll GET `/api/v1/posts/:id` until status is `published` / `partial_failed` / `failed`.
- [ ] Retry same publish with same Idempotency-Key → 200, no duplicate `post_publish_results`.
- [ ] Check `post_publish_results` and `jobs` in Supabase for correct platform_post_id and job status.

See **apps/api/STEP5_VERIFICATION.md** for full steps.

---

## Step 6: IAP (requires dev build)

- [ ] IAP is not testable in Expo Go; use EAS dev build (see **frontend/DEVICE_TESTING.md**).
- [ ] Backend: POST `/api/v1/subscription/verify` with valid receipt/token updates `subscriptions` and returns `isEligible`.
- [ ] GET `/api/v1/subscription/status` returns `status`, `isEligible`, `current_period_end`, `days_left`.
- [ ] Publish returns 402 when not eligible; after verify, publish succeeds without app restart.

See **apps/api/IAP_TEST_CHECKLIST.md** and **frontend/IAP_SETUP.md**.

---

## Known external portal tasks (no code execution)

These require actions in external portals; link or describe only.

| Task | Where | What to do |
|------|--------|------------|
| Meta app: redirect URI | [Meta for Developers](https://developers.facebook.com) → App → Facebook Login → Settings | Add exact `META_REDIRECT_URI` to Valid OAuth Redirect URIs |
| Meta: Web OAuth Login | Same → Facebook Login → Settings | Enable “Web OAuth Login” |
| Meta: app icon / privacy / category | App Dashboard / App Review | Add icon, privacy policy URL, data deletion instructions, category (required for permissions submission) |
| Meta: test users / app mode | App Dashboard | Add test users or set app to Live when ready |
| Apple: subscription product | App Store Connect | Create subscription product and set IOS_SUBSCRIPTION_PRODUCT_ID |
| Google: subscription product | Play Console | Create subscription and set ANDROID_SUBSCRIPTION_PRODUCT_ID |
| OpenAI key | Staging / production env | Add OPENAI_API_KEY for real captions/images (optional; mock works without) |
| Production host + HTTPS | Your provider | Deploy API + workers; expose API over HTTPS; set CORS and META_REDIRECT_URI to production URLs |

---

## Quick reference

| Step | Focus | Doc |
|------|--------|-----|
| 1 | Queue, 2 workers, seed, claim_next_job | apps/api/STAGING_CHECKLIST.md |
| 2 | Security, signed URLs, redaction | (this doc) |
| 3 | Generation, caption/image models | apps/api/STEP3_VERIFICATION.md |
| 4 | OAuth, diagnostics, local success/error pages | GET /api/v1/social/meta/diagnostics |
| 5 | Publish, idempotency, post_publish_results | apps/api/STEP5_VERIFICATION.md |
| 6 | IAP, verify, dev build | apps/api/IAP_TEST_CHECKLIST.md, frontend/DEVICE_TESTING.md |
