# Store submission checklist — App Store, Play Store, Meta

Follow this **click-by-click** in Apple, Google, and Meta portals. No code execution; portal actions only.

---

## Before you start

- [ ] **Final app identity:** In `frontend/app.json` set `ios.bundleIdentifier` and `android.package` to your final IDs (e.g. `com.yourcompany.quickpost`). Replace `com.yourapp.quickpost` before submitting.
- [ ] **Legal URLs:** Set in EAS / frontend env (and in Meta/Apple/Google where required):
  - **Privacy Policy** — `EXPO_PUBLIC_PRIVACY_URL` (used in-app in Settings).
  - **Terms of Service** — `EXPO_PUBLIC_TERMS_URL`.
  - **Data Deletion** — `EXPO_PUBLIC_DATA_DELETION_URL` (how to delete account and data; required for Meta and store review).
- [ ] **Icons:** 1024×1024 `icon.png`; Android adaptive icon; splash as in `app.json` plugins. See `frontend/RELEASE_BUILD.md`.

---

## A) Apple App Store

### A.1 App Store Connect — create app

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → **My Apps** → **+** → **New App**.
2. **Platforms:** iOS (and optionally others).
3. **Name:** Your app name (e.g. Quickpost).
4. **Primary Language:** e.g. English (U.S.).
5. **Bundle ID:** Select the bundle ID that matches `ios.bundleIdentifier` in `app.json` (create in [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) if needed).
6. **SKU:** Unique string (e.g. `quickpost-ios-1`).
7. **User Access:** Full Access (or restricted if you use testers).
8. Create.

### A.2 App information (App Store Connect)

1. **App Information** → Privacy Policy URL: your `EXPO_PUBLIC_PRIVACY_URL`.
2. **Pricing and Availability:** Set price (e.g. Free) and territories.
3. **App Privacy:** Complete the privacy nutrition labels (data collected, linked to user, etc.).

### A.3 In‑app purchase (auto‑renewable subscription)

1. **App Store Connect** → your app → **Features** → **In‑App Purchases** → **+** → **Auto‑Renewable Subscription**.
2. **Reference Name:** e.g. "Quickpost Pro Monthly".
3. **Product ID:** Must match `EXPO_PUBLIC_IOS_SUBSCRIPTION_PRODUCT_ID` and backend `APPLE_SUBSCRIPTION_PRODUCT_IDS` (e.g. `com.yourcompany.quickpost.pro.monthly`).
4. Create **Subscription Group** if first time (e.g. "Quickpost Subscriptions").
5. Add **subscription prices** and duration (e.g. 1 month).
6. In **App Store Connect** → **Users and Access** → **Sandbox** → create **Sandbox Testers** for testing purchases without real charges.

### A.4 Sandbox testing (Apple)

1. On device: **Settings** → **App Store** → **Sandbox Account** → sign in with a Sandbox Tester.
2. Run your app (EAS production or preview build); use **Subscribe** or **Restore**.
3. Confirm subscription is granted and backend `/api/v1/subscription/verify` and `/status` reflect eligibility.

### A.5 Review notes (must include for reviewer)

In **App Review Information** (and **Notes** for reviewer), include:

- **Demo account:**  
  "Sign in with: [test email] / [password]. This account has a connected Facebook Page and Instagram Professional account for testing publish."
- **How to connect Meta (Facebook/Instagram):**  
  "Settings → Social Accounts → Connect for Instagram (or Facebook). This opens Meta OAuth; use a test user that has a Page and a linked Instagram Professional account. After connecting, Create Post → Generate → Preview → Publish to test posting."
- **IAP:**  
  "Subscription can be tested via Sandbox; use the Subscribe button in Settings or when trial is expired."

---

## B) Google Play Store

### B.1 Play Console — create app

1. Go to [Google Play Console](https://play.google.com/console) → **Create app**.
2. **App name:** e.g. Quickpost.
3. **Default language:** e.g. English (United States).
4. **App or game:** App.
5. **Free or paid:** Free (with in‑app purchases).
6. Accept declarations and create.

### B.2 App setup (Play Console)

1. **Dashboard** → complete **App content** (Privacy policy, Ads declaration if applicable, etc.).
2. **Policy** → **App content** → **Privacy policy:** set URL to your `EXPO_PUBLIC_PRIVACY_URL`.
3. **Data safety:** Complete the form (what data you collect, how it’s used, whether it’s shared). Align with your privacy policy and in‑app behavior.

### B.3 Subscription (Play Console)

1. **Monetize** → **Subscriptions** (or **Products** → **Subscriptions**).
2. **Create subscription** → **Base plan** (e.g. monthly).
3. **Product ID:** Must match `EXPO_PUBLIC_ANDROID_SUBSCRIPTION_PRODUCT_ID` and backend `GOOGLE_SUBSCRIPTION_PRODUCT_IDS` (e.g. `quickpost_pro_monthly`).
4. Set price and billing period.
5. **Testing:** Add **License testers** (Google account emails) so they can make test purchases without being charged.

### B.4 Internal testing / release

1. **Testing** → **Internal testing** (or **Closed** / **Open**) → create release.
2. Upload AAB from EAS: `eas build --profile production --platform android` then **eas submit** or upload the AAB from EAS build page to Play Console.
3. Add testers (for internal track) and run through purchase/restore and publish flow.

---

## C) Meta (Facebook / Instagram) — app review prerequisites

Required so your app can request Meta permissions (e.g. for Connect Facebook/Instagram and publish). See also **apps/api/META_REVIEW_CHECKLIST.md**.

### C.1 App Dashboard — basics

1. [Meta for Developers](https://developers.facebook.com) → **My Apps** → your app (or create one).
2. **App settings** → **Basic:**
   - **App Icon:** Upload (e.g. 1024×1024).
   - **Privacy Policy URL:** Your `EXPO_PUBLIC_PRIVACY_URL`.
   - **Terms of Service URL:** Your `EXPO_PUBLIC_TERMS_URL`.
   - **Category:** Select the category that fits your app (e.g. "Business and productivity").
3. **App settings** → **Basic** or **Use cases** (depending on layout): add **Data Deletion Instructions** URL (e.g. your `EXPO_PUBLIC_DATA_DELETION_URL` or a page that explains how users delete their account and data).

### C.2 Facebook Login — redirect URI

1. **Facebook Login** → **Settings** (or **Facebook Login** → **Settings**).
2. **Valid OAuth Redirect URIs:** Add **exactly** your backend callback URL (e.g. `https://api.yourdomain.com/api/v1/social/meta/callback`). Must match `META_REDIRECT_URI` in API env.
3. Enable **Web OAuth Login** if required for your flow.

### C.3 Permissions + screencast (App Review)

1. **App Review** → **Permissions and Features** → request the permissions your app uses (e.g. `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`).
2. For each permission:
   - **Use case:** e.g. "We use this so the user can connect their Facebook Page and Instagram Business account and publish posts from our app."
   - **Screencast:** Upload or link a short video showing: Connect → OAuth → success → (optional) one publish. No tokens or secrets in the video.
   - **Test credentials:** Provide a test user that has a **Facebook Page** and a **linked Instagram Professional** account (Instagram Settings → Linked accounts → Facebook Page).

### C.4 Reviewer test account steps (put in App Review notes)

- "Use the provided test account. In the app: Settings → Social Accounts → Connect Instagram (or Facebook). Complete Meta login with the test account; ensure the Page and IG Professional are linked. Then: Create Post → add photo/context → Generate → Preview → Publish to Instagram and/or Facebook to verify posting."

---

## D) Production readiness (ops)

These are required or recommended for production; document for your team and in deployment runbooks.

### D.1 CORS (production only)

- **Requirement:** In production, `CORS_ALLOWLIST` must be set explicitly (comma‑separated origins). No wildcard `*`.
- **Example:** `https://your-app.vercel.app,https://your-custom-domain.com`
- See **DEPLOYMENT_RUNBOOK.md** and **DEPLOY_RENDER.md**.

### D.2 Publish kill switch

- **Env var:** `PUBLISH_ENABLED` (Render / API + Worker).
- **`true`** (default): Publish jobs run normally.
- **`false`:** New publish requests get **503**; existing publish jobs are marked **error** with a clear message. Use to quickly disable publishing (e.g. during an incident).
- See **DEPLOYMENT_RUNBOOK.md** §5 and **DEPLOY_RENDER.md**.

### D.3 Monitoring (Sentry)

- **API / Worker:** Set `SENTRY_DSN` in backend env (e.g. Render). API and worker init Sentry when DSN is set; tokens/receipts are redacted.
- **Mobile:** Optional. Use Sentry Expo (`@sentry/react-native`); set `EXPO_PUBLIC_SENTRY_DSN` in EAS env. See **frontend/DEVICE_TESTING.md** for a short guidance. Never send tokens or receipts in Sentry events.

---

## E) Deep linking (OAuth return)

- **Scheme:** `quickpost` (set in `frontend/app.json` → `expo.scheme`).
- OAuth callback goes to your backend; backend redirects to `PUBLIC_APP_URL` or to API-hosted success/error pages when `PUBLIC_APP_URL` is localhost. For a custom in-app return, configure your frontend to handle the scheme (e.g. `quickpost://oauth`) if you use it. Document in **Review notes** if reviewers need to return to the app after OAuth.

---

## Quick reference

| Document | Purpose |
|----------|---------|
| **frontend/RELEASE_BUILD.md** | EAS build commands (preview, production), submit guidance |
| **frontend/DEVICE_TESTING.md** | Why Expo Go can’t test IAP; EAS dev build; Sentry mobile note |
| **apps/api/META_REVIEW_CHECKLIST.md** | Detailed Meta app setup, screencast, env vars |
| **DEPLOYMENT_RUNBOOK.md** | Env vars, rollback, kill switch, CORS, Sentry |
| **DEPLOY_RENDER.md** | Render API + Worker env and steps |
| **FINAL_ACCEPTANCE_TEST.md** | Manual end-to-end test script before release |
