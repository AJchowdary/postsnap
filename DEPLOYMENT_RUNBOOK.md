# Deployment runbook — PostSnap API + Worker

Deploy the API and worker as **separate services** so the worker can scale independently and failures are isolated.

**Go-live order:** Supabase migrations → API (Web Service) → Worker (Background Worker, 2 instances) → Frontend.

---

## 0. Migration checklist (do first)

Before deploying API or worker:

1. **Supabase:** Run all migrations in order in the production Supabase project (see `apps/api/SUPABASE_PROD_SETUP.md`).
2. **Verify:** `claim_next_job` RPC exists; RLS enabled; storage bucket `post-images` (or `STORAGE_BUCKET`) created.
3. Then deploy API and worker (Render: see `DEPLOY_RENDER.md`); frontend (Vercel: see `DEPLOY_VERCEL.md`).

---

## 1. Required environment variables

Set these in your host (e.g. Railway, Render, Fly.io, or your own server). **Never commit real values.**

| Variable | Required | Notes |
|----------|----------|--------|
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | Yes | API port (e.g. 4000) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server only) |
| `CORS_ALLOWLIST` | Yes | Comma-separated origins only (no `*` in prod). Example: `https://your-app.vercel.app,https://your-custom-domain.com` |
| `TOKEN_ENCRYPTION_KEY` | Yes | 32+ bytes (base64 or hex) for Meta token encryption |
| `META_APP_ID` | Yes | Meta app ID |
| `META_APP_SECRET` | Yes | Meta app secret |
| `META_REDIRECT_URI` | Yes | Exact callback URL (e.g. `https://api.yourapp.com/api/v1/social/meta/callback`) |
| `PUBLIC_APP_URL` | Yes | Frontend origin (e.g. `https://yourapp.com`) for OAuth redirects |
| `OPENAI_API_KEY` | Optional | For real captions/images; omit for mock |
| `APPLE_SHARED_SECRET` | If iOS IAP | Required if `APPLE_SUBSCRIPTION_PRODUCT_IDS` is set |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | If Android IAP | Path to JSON key for Play API |
| `STORAGE_BUCKET` | Optional | Supabase bucket name (default `post-images`) |
| `PUBLISH_ENABLED` | Optional | Set to `false` to disable publishing (kill switch); default `true` |
| `RUN_WORKER_IN_PROCESS` | Optional | Set to `true` only if running worker inside API (e.g. single-box dev); **default `false`**. On Render API service leave false; run separate worker(s). |
| `RUN_SCHEDULER_IN_PROCESS` | Optional | Set to `true` only if running scheduler inside API; **default `false`**. Do not run scheduler on production API. |
| `SENTRY_DSN` | Optional | Sentry DSN for error monitoring (API + worker) |

At startup, the API runs **production env validation** and exits with a clear error if any of the above required vars are missing.

---

## 2. Deploy API and worker separately

- **API:** Runs HTTP server + starts one in-process worker (see `index.ts`). For a single instance this is fine.
- **Worker:** For scale, run **worker-only** processes (no HTTP). Use a separate entry that only runs the job loop (e.g. `node dist/jobs/workerProcess.js` or a script that calls `startWorker()` and `startScheduler()` without `app.listen()`).

**Recommended for production:**

1. **Service 1 — API:**  
   - Start command: `node dist/index.js` (or `npm start`).  
   - Set **`RUN_WORKER_IN_PROCESS=false`** (default). Do **not** set `RUN_SCHEDULER_IN_PROCESS`; scheduler is disabled on API.  
   - Expose `PORT` over HTTPS (reverse proxy / load balancer).  
   - Health check: `GET /api/health` → 200.

2. **Service 2 — Workers:**  
   - Start command: `node dist/jobs/workerProcess.js` (or `npm run start:worker` from `apps/api`).  
   - Run **at least 2 worker instances**. No HTTP port needed.

By default the API does **not** run the worker or scheduler in-process; run a separate worker service (e.g. on Render).

---

## 3. Health checks

- **API:** `GET /api/health` → 200 with `{ "status": "ok", "service": "api", "version": "...", "time": "..." }`. No auth. Use for Render health check path `/api/health`.
- **Worker:** No HTTP. Rely on process liveness; if the process exits, restart it.

---

## 4. Scaling starting point

- **API:** 1 instance behind a load balancer is enough to start. Add more if CPU or latency grows.
- **Workers:** Start with **2** instances (e.g. 2 containers or 2 processes). Increase if the jobs queue backs up (check `jobs` table: count of `status = 'pending'`).

---

## 5. Rollback plan and safe operations

**Rollback**

1. **Revert deployment:** In Render, redeploy the previous release for the API and Worker services (Dashboard → Service → Deployments → roll back).
2. **DB:** No schema changes needed for a code-only rollback. If you added a new migration, roll back that migration first if the reverted code depends on it.
3. **Env:** Keep env vars unchanged; only code/image is reverted.

**Disable publish quickly (kill switch)**

- Set **`PUBLISH_ENABLED=false`** in the API and Worker env (Render → Environment).
- Redeploy or use “Clear build cache & deploy” so the new env is picked up.
- Effect: New publish requests return **503** (Service Unavailable); existing publish jobs are marked **error** with message “Publishing is temporarily disabled (PUBLISH_ENABLED=false).”
- To re-enable: set `PUBLISH_ENABLED=true` and redeploy.

**Inspect failures**

- **Jobs:** Query `jobs` table (e.g. `type = 'publish'`, `status = 'error'`); check `last_error`.
- **Results:** Query `post_publish_results` for `status = 'failed'` and `error_message`.
- **Worker logs:** Render Dashboard → Worker service → Logs.

**Spike protection**

- Rate limits (auth, posts, subscription) are already in place.
- Regen limits (per post / per day) are enforced.
- Publish retries only for transient errors (backoff); permanent failures are marked error and not retried indefinitely.

---

## 6. HTTPS and OAuth

- Put the API behind HTTPS (reverse proxy or cloud LB). Meta OAuth requires a valid HTTPS redirect URI (or localhost for dev).
- Set `META_REDIRECT_URI` to your production callback URL (e.g. `https://api.yourapp.com/api/v1/social/meta/callback`).
- Set `PUBLIC_APP_URL` to your frontend origin so OAuth success/error redirects go to the right place.

---

## 7. Render and Vercel

- **API + Worker on Render:** See **DEPLOY_RENDER.md** for step-by-step Web Service and Background Worker setup, env vars, and optional `render.yaml`.
- **Frontend on Vercel:** See **DEPLOY_VERCEL.md** for root directory, build, and env vars. Set `CORS_ALLOWLIST` on the API to include your Vercel domain.
