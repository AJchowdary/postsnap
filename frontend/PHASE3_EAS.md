# Phase 3 — EAS builds (dev + production)

Prep for EAS development builds and production (store-ready) builds. No app logic or UI changes; config and docs only.

---

## App config (validated)

- **frontend/app.json**
  - **ios.bundleIdentifier:** `com.yourapp.quickpost` (placeholder). **Set your real one** in `app.json` before App Store submit (e.g. `com.yourcompany.quickpost`). Also create the identifier in [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list).
  - **android.package:** `com.yourapp.quickpost` (placeholder). **Set your real one** in `app.json` before Play Store submit. Must match the applicationId in your Play Console app.
  - **scheme:** `quickpost` (for OAuth/deep links).
  - **icon:** `./assets/images/icon.png` (use 1024×1024 for store).
  - **splash:** Configured via `expo-splash-screen` plugin.
  - **Permissions:** Camera and photo library strings present in `ios.infoPlist` and `android.permissions` / `expo-image-picker` plugin.

---

## EAS profiles (validated)

- **development:** `developmentClient: true`, internal distribution, iOS simulator. Use for dev client (IAP/OAuth on device).
- **preview:** Internal distribution, APK for Android, IPA for iOS (no store). Use for testers.
- **production:** `autoIncrement: true`. **Store-ready:** Android → AAB, iOS → IPA. Use for App Store / Play Store submit.

---

## Prerequisites

1. **EAS CLI:** `npm install -g eas-cli` (or use `npx eas`).
2. **Expo account:** Sign up at [expo.dev](https://expo.dev) if needed.
3. **Apple Developer:** Paid membership for iOS builds and store submit. Create an App ID (bundle identifier) and optionally Distribution certificate + Provisioning profile (EAS can manage these).
4. **Google Play Console:** Account and app created for Android. EAS can build the AAB; you upload to Play Console.

---

## Environment variables (no secrets in git)

Set in **EAS Dashboard** (Project → Environment) or in **frontend/.env** (do not commit `.env`). Referenced by the app at build/runtime:

- `EXPO_PUBLIC_API_BASE_URL` — Backend API URL (e.g. your Render API).
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key.
- Optional: `EXPO_PUBLIC_IOS_SUBSCRIPTION_PRODUCT_ID`, `EXPO_PUBLIC_ANDROID_SUBSCRIPTION_PRODUCT_ID`, `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_DATA_DELETION_URL`.

Use **frontend/.env.example** as a template; never commit real keys.

---

## Exact commands to run (copy/paste)

From repo root:

```bash
cd frontend
```

**1. Log in to EAS (once):**

```bash
npm run eas:login
```

- Browser opens; log in or create Expo account.

**2. Development build (dev client for IAP / OAuth on device):**

```bash
npm run build:android:dev
# or
npm run build:ios:dev
```

**3. Production build (store-ready AAB / IPA):**

```bash
npm run build:android:prod
# or
npm run build:ios:prod
```

**4. Run app with dev client (after installing the dev build on device/simulator):**

```bash
npm run start:dev-client
```

---

## What to select when prompted

- **Create or link project:** Choose **Link to existing project** if the app is already on Expo; otherwise **Create new project**.
- **Credentials (iOS):** Prefer **Let EAS manage** (recommended) so EAS creates/distributes the Distribution certificate and Provisioning profile. Otherwise upload your own.
- **Credentials (Android):** EAS can generate a keystore or use an existing one. For production, ensure the keystore is saved; EAS stores it for you when you allow it.

---

## Success criteria

**Dev build:**

- [ ] `npm run build:android:dev` or `build:ios:dev` completes without errors.
- [ ] EAS dashboard shows the build; you can download the APK (Android) or install on simulator/device (iOS).
- [ ] After installing the dev build, `npm run start:dev-client` loads the app and it can reach your API (set `EXPO_PUBLIC_API_BASE_URL`).

**Production build:**

- [ ] `npm run build:android:prod` produces an **AAB** (Android App Bundle) suitable for Play Console upload.
- [ ] `npm run build:ios:prod` produces an **IPA** suitable for App Store Connect (Transporter or Xcode).
- [ ] Before submit: replace `com.yourapp.quickpost` in **app.json** with your real **ios.bundleIdentifier** and **android.package**.

---

## Quick reference

| Script | Command | Use |
|--------|---------|-----|
| eas:login | `eas login` | Log in to Expo |
| build:android:dev | `eas build --platform android --profile development` | Dev client (APK) |
| build:ios:dev | `eas build --platform ios --profile development` | Dev client (simulator/device) |
| build:android:prod | `eas build --platform android --profile production` | Store AAB |
| build:ios:prod | `eas build --platform ios --profile production` | Store IPA |
| start:dev-client | `expo start --dev-client` | Run with dev client |

See **RELEASE_BUILD.md** and **DEVICE_TESTING.md** for more detail on EAS and device testing.

---

## Build complete hook fix (CI-safe)

EAS Build runs a **"Build complete hook"** phase at the end of the build. The phase runs the npm lifecycle script **`eas-build-on-complete`** (i.e. `npm run eas-build-on-complete` or `yarn run eas-build-on-complete`). If that phase fails with "Unknown error. See logs of the Build complete hook build phase", common causes are:

1. **Hook script failed** — The command for `eas-build-on-complete` threw or exited non-zero (e.g. inline `node -e "process.exit(0)"` can fail on the EAS runner due to shell/quoting).
2. **Version handling** — With default (local) app version source, EAS may read/write version in app config or native files during or after the build; that step can error and be reported under the same phase.

**Fix applied:**

1. **eas.json — `cli.appVersionSource: "remote"`**  
   Version is managed on EAS servers instead of local files. This avoids local file read/write during the build and is the recommended setup for EAS CLI 12+. It can prevent "Build complete hook" failures that are actually version-related.

2. **No-op hook script**  
   - **frontend/scripts/eas-build-on-complete.js** — A small Node script that only runs `process.exit(0)`.  
   - **package.json** — `eas-build-on-complete`, `eas-build-on-success`, and `eas-build-on-error` all point to `node scripts/eas-build-on-complete.js`.  
   Using a script file instead of an inline `node -e "..."` avoids quoting/shell differences on the EAS runner and ensures the hook always exits 0.

**Why it works:** The phase always has a valid script to run (the .js file exists in the repo and is run with `node`). Remote app version source removes local version updates from the build, so the hook phase is less likely to hit version-related errors. No app runtime logic or UI was changed.
