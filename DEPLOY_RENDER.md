# Deploy API and Worker on Render

Backend (Node/Express API) and worker run as **separate Render services**. No secrets in git; set all values in Render Environment.

**Order:** Supabase migrations first (see `apps/api/SUPABASE_PROD_SETUP.md`) → then API → then Worker.

---

## A) Create Render Web Service (API)

1. **Dashboard:** New → **Web Service**.
2. **Connect repo** (GitHub/GitLab); select this repository.
3. **Settings:**
   - **Name:** e.g. `postsnap-api`
   - **Region:** Choose closest to your users.
   - **Root Directory:** `apps/api`
   - **Runtime:** Node
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm run start`
   - **Health Check Path:** `/api/health`
   - **Instance type:** Free or paid per your needs.

4. **Environment variables** (see “Required env vars” below). Include Supabase, CORS, Meta, `TOKEN_ENCRYPTION_KEY`, `PUBLIC_APP_URL`. By default the API **does not** run the worker or scheduler in-process (no need to set `RUN_WORKER_IN_PROCESS`; it defaults to false).

5. **Deploy.** After deploy, note the service URL (e.g. `https://postsnap-api.onrender.com`).

---

## B) Create Render Background Worker (Worker)

1. **Dashboard:** New → **Background Worker**.
2. **Connect the same repo**; same branch.
3. **Settings:**
   - **Name:** e.g. `postsnap-worker`
   - **Root Directory:** `apps/api`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm run start:worker`
   - **Scale:** **2** instances (recommended so jobs are processed while another claims the next).

4. **Environment variables:** Same as API where relevant (Supabase, Meta, OpenAI, IAP, etc.). Do **not** set `RUN_WORKER_IN_PROCESS` (worker entrypoint is `start:worker`). Set:
   - **`PUBLISH_ENABLED=true`** (or `false` to disable publish as a kill switch).

5. **Deploy.**

---

## C) Publish kill switch

- **Env var:** `PUBLISH_ENABLED`
  - `true` (default): Publish jobs run normally.
  - `false`: Publish jobs are rejected; API returns **503** for new publish requests; worker marks publish jobs as **error** with message “Publishing is temporarily disabled (PUBLISH_ENABLED=false).”
- Set in both **API** and **Worker** when using the kill switch so behavior is consistent.
- No code deploy required; change env in Render and redeploy (or use “Clear build cache & deploy” so env is picked up).

---

## Required env vars (Render API + Worker)

Set these in Render → Service → Environment. Never commit real values.

| Variable | Required | Notes |
|----------|----------|--------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | Render sets automatically (e.g. 10000); app reads it |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key |
| `STORAGE_BUCKET` | Optional | Default `post-images` |
| `CORS_ALLOWLIST` | Yes | e.g. `https://your-app.vercel.app,https://your-custom-domain.com` |
| `TOKEN_ENCRYPTION_KEY` | Yes | 32+ bytes (base64 or hex) |
| `META_APP_ID` | Yes | Meta app ID |
| `META_APP_SECRET` | Yes | Meta app secret |
| `META_REDIRECT_URI` | Yes | e.g. `https://YOUR_RENDER_API_DOMAIN/api/v1/social/meta/callback` |
| `META_OAUTH_SCOPES` | Optional | Default in code |
| `META_GRAPH_VERSION` | Optional | e.g. `v20.0` |
| `PUBLIC_APP_URL` | Yes | Frontend origin, e.g. `https://your-app.vercel.app` |
| `OPENAI_API_KEY` | Optional | For real captions/images |
| `APPLE_SHARED_SECRET` | If iOS IAP | When `APPLE_SUBSCRIPTION_PRODUCT_IDS` set |
| `APPLE_SUBSCRIPTION_PRODUCT_IDS` | Optional | Comma-separated |
| `GOOGLE_PLAY_PACKAGE_NAME` | Optional | Android |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` or `GOOGLE_SERVICE_ACCOUNT_JSON` | Optional | Android verify |
| `GOOGLE_SUBSCRIPTION_PRODUCT_IDS` | Optional | Comma-separated |
| `SENTRY_DSN` | Optional | Sentry DSN for API/worker |
| `PUBLISH_ENABLED` | Optional | `true` (default) or `false` (kill switch) |
| **API only** | | |
| `RUN_WORKER_IN_PROCESS` | Yes (API) | Set to `false` when using separate worker service |

---

## Exact Render service settings summary

**API (Web Service)**  
- Root directory: `apps/api`  
- Build: `npm ci && npm run build`  
- Start: `npm run start`  
- Health check path: `/api/health`  
- Env: All required vars (worker/scheduler off by default; do not run on API)  

**Worker (Background Worker)**  
- Root directory: `apps/api`  
- Build: `npm ci && npm run build`  
- Start: `npm run start:worker`  
- Scale: 2 instances  
- Env: Same as API (no `RUN_WORKER_IN_PROCESS` needed)

---

## Optional: render.yaml

You can define both services in a single `render.yaml` (no secrets; reference env var keys only). Example at repo root:

```yaml
# render.yaml — no secrets; set env in Render Dashboard
services:
  - type: web
    name: postsnap-api
    runtime: node
    rootDir: apps/api
    buildCommand: npm ci && npm run build
    startCommand: npm run start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: RUN_WORKER_IN_PROCESS
        value: "false"
      # Add others in Dashboard or sync from env group
  - type: worker
    name: postsnap-worker
    runtime: node
    rootDir: apps/api
    buildCommand: npm ci && npm run build
    startCommand: npm run start:worker
    numInstances: 2
```

Create the services from the Dashboard first and attach env vars there; or use Render’s Blueprint to import `render.yaml` and then add secret env vars in the UI.
