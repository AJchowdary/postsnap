# PostSnap / Quickpost — Full Project Analysis Report

**Generated:** 2025-02-27  
**Scope:** Entire repo (frontend, API, backend, packages, config, tests, build, store readiness)

---

## 1. What is this project?

- **Product name:** Quickpost (Expo app name) / PostSnap (repo and API name).
- **What it does:** Mobile-first app for **small businesses** (restaurants, salons, retail, gyms, cafés) to create and publish social media posts. Users pick a photo, add context, get AI-generated captions and image edits, then publish to **Instagram** and **Facebook** (Meta) or save drafts. Supports scheduling, templates by business type, and in-app subscription (IAP) with trial.
- **Who it’s for:** Business owners or staff who want quick, branded social content without design skills.
- **Problem it solves:** Reduces the effort to produce consistent, on-brand posts and publish to Meta from one place (captions, hashtags, image styling, optional before/after, scheduling).

---

## 2. Tech stack & architecture

| Layer | Technology |
|-------|------------|
| **Frontend** | Expo SDK 54, React 19, React Native 0.81, expo-router (file-based), TypeScript, Zustand |
| **Backend API** | Node.js, Express 4, TypeScript, Supabase (Postgres + Auth + Storage), no MongoDB in use |
| **Database** | Supabase (Postgres). Tables: accounts, business_profiles, social_connections, subscriptions, templates, posts, post_publish_results, jobs |
| **Auth** | Supabase Auth (JWT). API validates token via `getSupabase().auth.getUser(token)`; no custom JWT |
| **AI** | OpenAI (optional): captions (e.g. gpt-5-mini), image edit (gpt-image-1-mini / gpt-image-1). Mock provider when no key |
| **Social / IAP** | Meta Graph API (OAuth, pages/Instagram), Apple IAP, Google Play IAP; server-side token encryption and IAP verification |
| **Queue / jobs** | DB-backed job queue (Supabase `jobs` table); optional Redis for BullMQ; worker and scheduler can run in-process or as separate Render worker |
| **Build / deploy** | EAS Build (Expo Application Services) for iOS/Android; Render for API + worker; `.easignore` used so EAS archives include `frontend/` |
| **Other** | Sentry (API/worker), react-native-iap, react-native-dotenv, winston, zod, helmet, express-rate-limit |

**Third-party / APIs:** Supabase, OpenAI, Meta (Facebook/Instagram), Apple App Store (IAP), Google Play (IAP), Sentry (optional).

---

## 3. Project structure

```
postsnap-main/
├── package.json                 # Root: concurrently scripts (dev, dev:api, dev:web, dev:worker, dev:full)
├── .easignore                    # EAS archive: ignore all except frontend/, packages/, root package.json
├── README.md                     # Dev setup, port 4000 note, proxy warning
├── DEPLOY_RENDER.md              # Render: API + Worker setup, env vars
├── CHANGES.md                    # Changelog (Supabase migration, auth removal, etc.)
├── PROJECT_ANALYSIS_REPORT.md    # This file
│
├── frontend/                     # Expo (React Native) app — EAS build root
│   ├── app.json                  # Expo config: name Quickpost, slug quickpost, bundleId com.yourapp.quickpost (placeholder)
│   ├── eas.json                  # EAS profiles (development, preview, production), env, appVersionSource: remote
│   ├── package.json              # main: expo-router/entry; scripts: start, build:android:dev, eas-build-on-*
│   ├── App entry                 # expo-router → app/_layout.tsx → app/index.tsx (auth check + redirect)
│   ├── app/                      # Routes (expo-router)
│   │   ├── _layout.tsx            # Root layout, Stack (index, welcome, auth, onboarding, (tabs))
│   │   ├── index.tsx             # Bootstrap: loadToken → authMe → bootstrapAccount → redirect
│   │   ├── welcome.tsx            # Landing; Sign Up / Log in → auth
│   │   ├── auth.tsx               # Email/password form → authRegister/authLogin (API) → redirect
│   │   ├── onboarding.tsx        # Business type, name, city → updateBusinessProfile
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx       # Tab navigator
│   │   │   ├── home.tsx          # Home tab
│   │   │   ├── create.tsx        # Create post: photo, template, caption, generate, publish/schedule
│   │   │   ├── history.tsx       # Post history
│   │   │   └── settings.tsx      # Profile, social connect, IAP, legal links
│   │   └── +html.tsx             # Web HTML shell
│   ├── src/
│   │   ├── components/           # PaywallModal, Toast, StatusChip, SchedulePicker, PrimaryButton, etc.
│   │   ├── constants/theme.ts    # Colors, typography, spacing
│   │   ├── services/api.ts       # API client (authRegister, authLogin, authMe, bootstrapAccount, posts, generate, social, subscription)
│   │   ├── services/iapService.ts # purchaseSubscription, restorePurchases, refreshSubscriptionFromBackend
│   │   ├── store/appStore.ts     # Zustand: auth, businessProfile, posts, subscription, socialAccounts, toast, paywall
│   │   └── types/index.ts       # Post, Platform, BusinessType, etc.
│   ├── scripts/
│   │   ├── eas-build-on-complete.js  # No-op for EAS build-complete hook (exit 0)
│   │   └── reset-project.js      # Expo reset script
│   ├── assets/images/           # icon.png, adaptive-icon.png, splash-icon.png, favicon.png (referenced in app.json)
│   ├── .env.example             # EXPO_PUBLIC_* (API, Supabase, IAP, legal URLs) — no secrets
│   ├── PHASE3_EAS.md            # EAS build instructions, build-complete hook fix
│   └── RELEASE_BUILD.md         # Store submit, bundle ID reminder
│
├── apps/api/                    # Node.js Express API
│   ├── package.json             # main: dist/index.js; scripts: dev, build, start, start:worker, test, migrate
│   ├── src/
│   │   ├── index.ts             # initSentry, getDb(), createApp(), listen; optionally startWorker/startScheduler
│   │   ├── server.ts            # Express app: CORS, helmet, /api/health, /api/, /api/v1 + /api routes, 404, errorHandler
│   │   ├── config.ts            # Env (Supabase, OpenAI, Meta, IAP, rate limit, worker/scheduler flags)
│   │   ├── routes/
│   │   │   ├── index.ts         # Mounts auth, account, posts, generate, social, subscription, templates
│   │   │   ├── auth.ts          # GET /auth/me only (authenticate middleware)
│   │   │   ├── account.ts       # bootstrap, me, profile
│   │   │   ├── posts.ts         # CRUD posts
│   │   │   ├── generate.ts      # caption/image generation, enqueue job
│   │   │   ├── social.ts        # Meta OAuth (login-url, callback, disconnect)
│   │   │   ├── subscription.ts  # verify, status, restore
│   │   │   └── templates.ts     # list templates
│   │   ├── middleware/          # auth (Supabase JWT), rateLimit, errorHandler, validate
│   │   ├── services/            # accountService, postsService, subscriptionService, storageService, metaOAuthService, iapVerificationService, socialService
│   │   ├── db/                  # getDb(), SupabaseAdapter, supabaseClient, IDatabase (no MongoDB in use)
│   │   ├── jobs/                # generateQueue, scheduleProcessor, workerProcess
│   │   ├── providers/           # ai (openAI, mock), posting (meta), subscription (mock)
│   │   ├── schemas/             # auth, account, posts, subscription (zod)
│   │   ├── utils/               # logger, errors, asyncHandler, hash, sentry, crypto, templates
│   │   └── __tests__/           # hash, loggerRedact, regenLimits, entitlements
│   ├── supabase/migrations/     # 001–005 (schema, templates, jobs, social_connections, subscriptions)
│   ├── .env.example            # ⚠️ CONTAINS REAL SECRETS (see Security section)
│   ├── jest.setup.ts
│   └── scripts/                 # get-token.js, verify-ownership.js, verify-ratelimit.js
│
├── backend/                     # Dev-only Python proxy (DO NOT DEPLOY)
│   ├── server.py                # FastAPI proxy to Node API (wildcard CORS)
│   └── tests/                   # test_postsnap_v2.py, test_schedule_feature.py (hit /api/auth/register, /api/auth/login — Node API no longer has these)
│
├── packages/shared/             # Shared types (BusinessType, Post, Account, etc.)
│   └── src/types.ts, index.ts
│
├── memory/, test_reports/       # PRD, test reports (legacy/context)
└── (other docs)
```

**Entry points:**  
- **Frontend:** `expo-router` → `app/_layout.tsx` → `app/index.tsx`.  
- **API:** `apps/api/src/index.ts` → `createApp()` from `server.ts`, listen on `config.port`.  
- **Config:** Frontend: `frontend/app.json`, `frontend/eas.json`, `frontend/.env`. API: `apps/api/.env`, `apps/api/src/config.ts`.

---

## 4. Current state & completion %

### Working (implemented and wired)

- **API:** Health check, auth/me (Supabase JWT), account bootstrap, business profile, posts CRUD, generate (enqueue job), templates, subscription verify/status/restore, social Meta login-url/callback/disconnect. DB-backed job queue, worker, optional scheduler. Rate limiting, CORS allowlist, production env validation.
- **Frontend:** Welcome → Auth screen → Onboarding or Create. Create flow: pick photo, template, description, generate caption/image, save draft, publish or schedule. History, settings (profile, social connect, IAP, legal links). Paywall and subscription state. EAS no-op hook script; `appVersionSource: remote` in eas.json.
- **EAS:** Development/preview/production profiles; `.easignore` so `frontend/` is included in archive.

### Partially done / inconsistent

- **Auth:** Backend was refactored to “Supabase Auth only”; `POST /auth/register` and `POST /auth/login` were **removed** from the Node API. The frontend still calls `authRegister` and `authLogin` in `api.ts` (POST `/auth/register`, `/auth/login`). Those endpoints do **not** exist → **404**. So the current app cannot register or log in users through the Node API. CHANGES.md states the client must use Supabase Auth (e.g. `signUp` / `signInWithPassword`) and send the Supabase JWT; the frontend was never updated to do that. **Result: auth flow is broken for normal use.**
- **Meta / social:** Backend has Meta OAuth and posting providers; frontend has connect/disconnect. Real publish depends on Meta app credentials and token encryption; may work when env is set.
- **IAP:** Frontend has purchase/restore; API has verify and subscription status. Works with dev/production builds when products and backend secrets are configured.

### Not started / missing

- **Frontend auth fix:** No Supabase client auth (no `@supabase/supabase-js` in frontend, no `signUp`/`signInWithPassword`). No API routes that proxy Supabase Auth (e.g. POST /auth/register that calls Supabase signUp and returns session).
- **Frontend tests:** No Jest/Vitest (or similar) in `frontend/package.json`; no unit or E2E tests for the app.
- **Store assets:** `app.json` references `./assets/images/icon.png` etc.; ensure 1024×1024 icon and store-ready assets exist and are used.

### Production readiness (estimate): **~45%**

- Backend and EAS build path are largely in place, but **auth is broken** (blocker). Bundle IDs are placeholders, legal URLs and IAP products must be set, and store review requirements (privacy, data deletion, etc.) need to be verified. With auth fixed and store checklist done, a rough path to submission exists.

---

## 5. Test report

### API (apps/api)

- **Framework:** Jest (ts-jest), `testMatch: **/__tests__/**/*.test.ts`, `roots: ["<rootDir>/src"]`.
- **Files:** `hash.test.ts`, `loggerRedact.test.ts`, `regenLimits.test.ts`, `entitlements.test.ts`.
- **Result:** All 4 suites, 14 tests **pass** (run: `npm test` in `apps/api`). Jest reports “Force exiting” / open handles; not failing but worth cleaning up later.

### Frontend

- **Unit / integration / E2E:** **None.** No test script in `frontend/package.json`, no test runner, no coverage.

### Backend (Python)

- `backend/tests/` target the Node API’s `/api/auth/register` and `/api/auth/login`. Those routes no longer exist on the Node API, so these tests would **fail** (404) if run against the current API.

### Summary

| Area | Exists | Passing | Failing | No coverage |
|------|--------|---------|---------|-------------|
| API unit | Yes | 14 tests | 0 | Routes, services, middleware (except covered units) |
| Frontend | No | — | — | Entire app |
| E2E | No | — | — | Full flows |
| Python tests | Yes | — | Register/login 404 | — |

---

## 6. Build & deployment status

### EAS (Expo)

- **Config:** `frontend/eas.json` — development (simulator/APK, dev client), preview (internal), production (autoIncrement). `cli.appVersionSource: "remote"`. Env per profile (e.g. `EXPO_PUBLIC_API_BASE_URL`).
- **Hook:** `eas-build-on-complete` (and success/error) point to `node scripts/eas-build-on-complete.js` (no-op exit 0). Intended to avoid “Build complete hook” failures.
- **Archive:** `.easignore` unignores `frontend/`, `packages/`, root `package.json` so the EAS archive includes the Expo app.
- **Status:** EAS build and hook have been fixed in recent commits; Android dev build should be able to pass. Not re-run in this analysis.

### API (Render)

- **Docs:** `DEPLOY_RENDER.md` — Web Service (API) and Background Worker, env vars, health check `/api/health`, worker `start:worker`.
- **Build:** `npm ci && npm run build` (TypeScript); start: `npm run start` (API) or `npm run start:worker` (worker).

### Known issues

- **API:** `express-rate-limit` high severity (IPv4-mapped IPv6 bypass). Run `npm audit fix` in `apps/api`.
- **Frontend:** Multiple npm audit issues (e.g. @eslint/plugin-kit, ajv, js-yaml, minimatch, tar, undici). Many in dev/Expo tooling; run `npm audit` / `npm audit fix` in `frontend` and triage.

---

## 7. Blockers for App Store & Play Store submission

| Blocker | Severity | Description |
|---------|----------|-------------|
| **Auth broken** | **CRITICAL** | Frontend calls POST /auth/register and /auth/login; API only has GET /auth/me. New users cannot sign up; no one can log in via current UI. Must implement either (a) frontend Supabase Auth (signUp/signInWithPassword) and use Supabase JWT for API, or (b) re-add register/login on API that call Supabase Auth and return session/token. |
| **Bundle ID / package** | **CRITICAL** | `app.json` uses `com.yourapp.quickpost`. Must be replaced with real iOS bundle identifier and Android package for your app in Apple Developer / Play Console. |
| **Real secrets in .env.example** | **CRITICAL** | `apps/api/.env.example` contains real Supabase URL, Supabase service role key, and what appears to be an OpenAI API key. This file is likely in git. Rotate all those keys immediately and replace with placeholders only. |
| **Legal URLs** | **MAJOR** | Store review requires in-app links for Privacy Policy, Terms, and (where applicable) Data Deletion. Frontend `.env.example` has EXPO_PUBLIC_PRIVACY_URL, TERMS_URL, DATA_DELETION_URL. These must be set and working in production builds. |
| **IAP products** | **MAJOR** | For paid features: create and configure products in App Store Connect and Play Console; set EXPO_PUBLIC_IOS_SUBSCRIPTION_PRODUCT_ID and EXPO_PUBLIC_ANDROID_SUBSCRIPTION_PRODUCT_ID; configure backend APPLE_SHARED_SECRET, GOOGLE_* for server-side verification. |
| **Meta OAuth in production** | **MAJOR** | Social connect requires META_APP_ID, META_APP_SECRET, META_REDIRECT_URI (and TOKEN_ENCRYPTION_KEY) in production. Redirect URI must match Meta app settings; PUBLIC_APP_URL must match app deep link / web URL. |
| **Icons & assets** | **MAJOR** | App icon 1024×1024, adaptive icon, splash, favicon must exist under `frontend/assets/images/` and match app.json. Required for store. |
| **Rate limit vulnerability** | **MINOR** | API: express-rate-limit high severity; fix with `npm audit fix` before production. |
| **Frontend audit** | **MINOR** | Multiple frontend npm audit findings; triage and fix where possible, especially for production build. |

---

## 8. Dependencies & versions

- **API:** `mongodb` and `@types/mongodb` are still in package.json; code uses Supabase only. Safe to remove to avoid confusion and reduce surface.
- **API:** One high severity: `express-rate-limit` (IPv4-mapped IPv6 bypass). Fix available via `npm audit fix`.
- **Frontend:** Six vulnerabilities reported (e.g. @eslint/plugin-kit, ajv, js-yaml, minimatch, tar, undici); mix of dev and transitive. Run `npm audit` and `npm audit fix`; some may require dependency upgrades or waiting for upstream fixes.
- **Config:** API uses `OPENAI_CAPTION_MODEL=gpt-5-mini` in .env.example; confirm model name with current OpenAI API (e.g. gpt-4o-mini vs gpt-5-mini).

---

## 9. Code quality issues

- **Hardcoded / secrets:** `apps/api/.env.example` contains real Supabase and OpenAI credentials (see above). No other hardcoded secrets spotted in app code.
- **Console.log:** Present in scripts and dev-only code: `apps/api/src/scripts/seedFivePosts.ts`, `cleanupSeed.ts`, `workerProcess.ts`, `scripts/verify-ownership.js`, `verify-ratelimit.js`, `get-token.js`, `frontend/scripts/reset-project.js`. Acceptable for scripts; consider removing or gating the single `console.log` in `workerProcess.ts` for production logs (or use logger).
- **TODOs:** `apps/api/src/middleware/rateLimit.ts` — Redis and Supabase store not implemented (memory only). `apps/api/src/providers/posting/metaProvider.ts` — TODO to replace with real Graph API when Meta credentials available.
- **Error handling:** Frontend auth and API calls often use generic catch and toast; some paths could give clearer errors (e.g. network vs 402 vs 500). API uses asyncHandler and errorHandler; coverage is reasonable.
- **TypeScript:** Frontend uses `(result as any)` and similar in a few places (e.g. IAP payload); could be tightened with proper types.

---

## 10. What needs to be done to submit — priority order

1. **Fix auth (CRITICAL)**  
   - Either: Add Supabase Auth to the frontend (`@supabase/supabase-js`): signUp/signInWithPassword, store session, send `access_token` as Bearer to API; remove or repurpose `authRegister`/`authLogin` that POST to non-existent API routes.  
   - Or: Re-add POST /auth/register and POST /auth/login on the API that call Supabase Auth (signUp/signInWithPassword) and return `{ user, token }` so the current frontend keeps working.  
   - Ensure bootstrap and /auth/me work with the chosen flow.

2. **Remove real secrets from .env.example (CRITICAL)**  
   - In `apps/api/.env.example`, replace Supabase URL, service role key, and any API key with placeholders (e.g. `YOUR_SUPABASE_URL`). Rotate the exposed Supabase and OpenAI keys immediately.

3. **Set bundle identifier and package (CRITICAL)**  
   - In `frontend/app.json`, set `ios.bundleIdentifier` and `android.package` to your real App ID and applicationId. Create matching identifiers in Apple Developer and Play Console.

4. **Legal and store URLs (MAJOR)**  
   - Publish Privacy Policy, Terms, and Data Deletion (if required) and set EXPO_PUBLIC_PRIVACY_URL, EXPO_PUBLIC_TERMS_URL, EXPO_PUBLIC_DATA_DELETION_URL in EAS env / .env for production builds. Ensure Settings opens these links.

5. **IAP and backend verification (MAJOR)**  
   - Create subscription products in App Store Connect and Play Console; set frontend env product IDs and backend Apple/Google secrets. Verify purchase and restore flows on real builds.

6. **Meta OAuth for production (MAJOR)**  
   - Configure Meta app with production redirect URI; set META_* and TOKEN_ENCRYPTION_KEY and PUBLIC_APP_URL in API/worker env. Test connect and publish.

7. **Assets (MAJOR)**  
   - Provide 1024×1024 icon, adaptive icon, splash, favicon under `frontend/assets/images/` per app.json.

8. **API security (MINOR)**  
   - In `apps/api`: run `npm audit fix` (express-rate-limit). Triage and fix frontend `npm audit` where feasible.

9. **EAS production build (MAJOR)**  
   - Run a production EAS build for Android and iOS; confirm no “Build complete hook” or archive errors; verify app launches and can auth, create post, and hit production API.

10. **Store listing and submit (MAJOR)**  
    - Prepare store listing (description, screenshots, etc.); use EAS Submit or upload AAB/IPA from EAS; submit for review after all critical and major items above are done.

---

**End of report.** For store submission, addressing the auth flow and secrets in .env.example is non-negotiable; then bundle IDs, legal URLs, IAP/Meta, and assets.
