# Phase 2 — Mobile project ready for EAS builds

Phase 2 is complete when install and config are in place. No business logic or API contracts were changed.

---

## Commands to run (human)

From repo root:

```bash
cd frontend
npm install
npm ci
```

Optional (run the app locally):

```bash
npx expo start
```

---

## Pass criteria

- [ ] **npm ci** succeeds (no "Missing: ... from lock file" or install errors).
- [ ] **frontend/app.json** is present with:
  - `ios.bundleIdentifier` (placeholder e.g. `com.yourapp.quickpost` is ok).
  - `android.package` (same placeholder ok).
  - `scheme`: `quickpost`.
  - `icon` and splash config (e.g. `plugins` with expo-splash-screen).
- [ ] **frontend/eas.json** is present with profiles: `development`, `preview`, `production`.
- [ ] **frontend/.env.example** contains env placeholders (no secrets):
  - `EXPO_PUBLIC_API_BASE_URL`
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_IOS_SUBSCRIPTION_PRODUCT_ID`
  - `EXPO_PUBLIC_ANDROID_SUBSCRIPTION_PRODUCT_ID`
  - `EXPO_PUBLIC_PRIVACY_URL`
  - `EXPO_PUBLIC_TERMS_URL`
  - `EXPO_PUBLIC_DATA_DELETION_URL`

---

## EAS build (after Phase 2)

When the criteria above pass, you can run EAS builds, e.g.:

```bash
cd frontend
eas build --profile development --platform android
eas build --profile preview --platform ios
```

See **RELEASE_BUILD.md** and **DEVICE_TESTING.md** for full EAS and device testing steps.
