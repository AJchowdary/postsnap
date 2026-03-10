# Final acceptance test — iOS + Android (manual)

Run this script on **real devices** (or simulators where applicable) using a **production or preview build** (EAS). IAP steps require a **development or production build**, not Expo Go.

---

## Prerequisites

- [ ] Backend (API + workers) running in staging or production; health check passes: `GET /api/health` → 200.
- [ ] Supabase migrations applied; at least one test user (Supabase Auth) and one account with business profile.
- [ ] Meta OAuth configured and (for publish) app review approved or using test users in Development mode.
- [ ] App installed from EAS build (preview or production). For IAP: use Sandbox (iOS) or License testers (Android).

---

## 1. Login

- [ ] Open app → **Welcome** (or login screen).
- [ ] Sign in with test account (email/password or your auth method).
- [ ] Expect: navigates to main app (e.g. Home or Create).
- [ ] If 401 or network error: check `EXPO_PUBLIC_API_BASE_URL` and backend CORS / auth.

---

## 2. Connect Instagram / Facebook (OAuth)

- [ ] Go to **Settings** → **Social Accounts**.
- [ ] Tap **Connect** for **Instagram** (or Facebook).
- [ ] If prompted, enter handle (or skip if OAuth-only).
- [ ] Browser or in-app webview opens Meta OAuth.
- [ ] Log in with a test user that has a **Facebook Page** and **linked Instagram Professional** account.
- [ ] Grant requested permissions.
- [ ] Redirect back to app (or API success/error page); app shows **Instagram** (and/or **Facebook**) as **connected** with handle/page name.
- [ ] If error page: note reason/code; fix redirect URI, scopes, or test account (see **apps/api/META_REVIEW_CHECKLIST.md** and diagnostics `GET /api/v1/social/meta/diagnostics`).

---

## 3. Create → Generate → Preview

- [ ] From **Home** or **Create**, start a new post.
- [ ] Add **photo** (camera or library) and **context text** (e.g. "Today's special: pasta").
- [ ] Tap **Generate** (or equivalent).
- [ ] Expect: loading then **caption(s)** and **processed image** (or placeholder if image gen disabled). Post status becomes **ready** (or equivalent).
- [ ] Open **Preview** (or post detail) and confirm caption and image look correct for Instagram/Facebook.

---

## 4. Publish to Instagram + Facebook and verify

- [ ] From the same post, tap **Publish** (or **Publish to Instagram / Facebook**).
- [ ] Select **Instagram** and **Facebook** (or both).
- [ ] Expect: 202 Accepted and a job id (or immediate success); UI shows publishing state.
- [ ] Wait for completion (poll or refresh): status becomes **published** or **partial_failed** / **failed** with clear message.
- [ ] **Verify on Meta:** Check the connected Instagram and Facebook Page; the post appears with correct image and caption.
- [ ] If 503: backend may have **PUBLISH_ENABLED=false** (kill switch). If 402: subscription not eligible (see step 6).

---

## 5. Idempotency (publish again same post)

- [ ] With the **same post** already published, tap **Publish** again with same platforms.
- [ ] Send same **Idempotency-Key** (if your client sends it) or use default behavior.
- [ ] Expect: 200 and message like "Already published" or no duplicate publish; no second post on Instagram/Facebook.
- [ ] In DB (optional): `post_publish_results` has one row per platform; no duplicate platform_post_id.

---

## 6. Trial expired → 402 → paywall → subscribe → unlock

- [ ] Use an account whose **trial is expired** (or force trial end in DB for testing).
- [ ] Attempt an action that requires subscription (e.g. **Publish** or **Generate** beyond trial limit).
- [ ] Expect: **402 Payment Required** from API; app shows **paywall** or upgrade prompt.
- [ ] In app: tap **Subscribe** (or **Start subscription**).
- [ ] **iOS:** Complete Sandbox purchase (use Sandbox Tester). **Android:** Complete test purchase (License Tester).
- [ ] Expect: backend **verify** succeeds; app refreshes subscription status and **unlocks** (paywall dismisses, publish/generate allowed).
- [ ] **Restore:** On a device that already purchased, tap **Restore purchases**; expect same unlock without charging again.
- [ ] If in **Expo Go:** expect clear message that IAP requires a development or production build; use EAS dev/production build for this step.

---

## 7. History and results

- [ ] Open **History** (or list of posts).
- [ ] Confirm previously created and published posts appear with correct status (**published**, **partial_failed**, **failed**, **ready**, **draft**).
- [ ] Open a published post: confirm platform result (e.g. Instagram post id, Facebook post id) if shown; no tokens or raw receipts.

---

## 8. Logout and legal links (store review)

- [ ] **Settings** → **Privacy Policy** → opens in-app browser or system browser to `EXPO_PUBLIC_PRIVACY_URL`. No crash; URL loads.
- [ ] **Terms of Service** → opens `EXPO_PUBLIC_TERMS_URL`.
- [ ] **Data Deletion** → opens `EXPO_PUBLIC_DATA_DELETION_URL` (instructions to delete account/data).
- [ ] **Log Out** → confirms and returns to Welcome/login; no crash.

---

## Sign-off

| Step | iOS | Android |
|------|-----|---------|
| 1. Login | ☐ | ☐ |
| 2. Connect IG/FB OAuth | ☐ | ☐ |
| 3. Create → Generate → Preview | ☐ | ☐ |
| 4. Publish IG+FB and verify on Meta | ☐ | ☐ |
| 5. Idempotency (no duplicate publish) | ☐ | ☐ |
| 6. Trial → 402 → paywall → subscribe → unlock (+ restore) | ☐ | ☐ |
| 7. History results | ☐ | ☐ |
| 8. Legal links + Logout | ☐ | ☐ |

**Notes:** Run once per platform (iOS, Android) before store submission. For IAP, use Sandbox (Apple) and License testers (Google); ensure backend has correct product IDs and (for production) shared secret / service account configured.
