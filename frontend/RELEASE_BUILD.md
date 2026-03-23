# Release build (EAS) — Store and internal testing

Use EAS Build to produce **preview** (internal) and **production** (store) builds. Replace `com.yourapp.quickpost` in `app.json` with your final **iOS bundle identifier** and **Android package** before submitting.

---

## Prerequisites

- EAS CLI: `npm install -g eas-cli` and `eas login`
- In `app.json`: set `ios.bundleIdentifier` and `android.package` to your final IDs (e.g. `com.yourcompany.quickpost`)
- Icons: 1024×1024 `icon.png`; Android adaptive icon `adaptive-icon.png`; splash as in `app.json` plugins
- Deep linking: scheme `quickpost` is set in `app.json` for OAuth return; backend redirects to `PUBLIC_APP_URL` or API-hosted success/error pages.

---

## Build commands

**Preview (internal testing — APK / IPA for testers)**

```bash
cd frontend
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

- Android: produces APK (or AAB if you change `buildType` in `eas.json`).
- iOS: produces IPA for internal distribution (no store upload).

**Production (store)**

```bash
cd frontend
eas build --profile production --platform android
eas build --profile production --platform ios
```

- `production` in `eas.json` has `autoIncrement: true` (build number / versionCode bumped automatically).
- Set env vars in EAS Dashboard → Project → Environment (e.g. `EXPO_PUBLIC_API_BASE_URL` for production API).

---

## Submit to stores (optional guidance)

After a **production** build completes:

**Apple**

```bash
eas submit --platform ios --latest
```

- Or upload the IPA from the EAS build page to App Store Connect (Transporter or Xcode).
- In App Store Connect: create app (if needed), attach build to a version, submit for review.

**Google**

```bash
eas submit --platform android --latest
```

- Or download the AAB from EAS and upload in Play Console → Release → Production (or internal testing).
- Ensure the first release is from an AAB produced with the same `package` as in `app.json`.

---

## Profiles summary

| Profile       | Use case           | iOS              | Android   |
|--------------|--------------------|-------------------|-----------|
| development  | Dev client (IAP/OAuth) | Simulator     | APK       |
| preview      | Internal testers   | Device IPA       | APK       |
| production   | App Store / Play   | Store build      | Store AAB |

Set `EXPO_PUBLIC_API_BASE_URL` (and other `EXPO_PUBLIC_*` vars) per profile in EAS → Environment or in `eas.json` → `env` for each build profile.
