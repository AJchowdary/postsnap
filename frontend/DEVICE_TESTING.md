# Device testing (real device + EAS Dev Build)

Expo Go cannot test **in-app purchases (IAP)** or some native OAuth flows reliably. Use an EAS development build on a real device for full testing.

---

## Why Expo Go is limited

- **IAP:** `react-native-iap` requires native code. Expo Go does not include it; purchase/restore will show “requires a development or production build.”
- **OAuth / deep links:** Tunnel or LAN URLs can be flaky. On a real device, use a stable HTTPS API URL or your machine’s LAN IP so the callback and redirects work.
- **Stability:** Real-device dev builds avoid tunnel/port issues common with Expo Go + QR.

---

## EAS Dev Build (recommended for IAP + OAuth)

### 1. Install EAS CLI

```bash
npm install -g eas-cli
eas login
```

### 2. Build a development client

**Android (APK for local install):**

```bash
cd frontend
eas build --profile development --platform android
```

**iOS (simulator or device):**

```bash
eas build --profile development --platform ios
```

Download the build from the EAS dashboard (or use the link from the CLI). Install on device/simulator.

### 3. Run the app with the dev client

Point the app at your API (see env below), then start the dev server:

```bash
cd frontend
npx expo start --dev-client
```

Scan the QR code or open the app on the device; it will load your JS from the dev server.

### 4. Set API URL for the device

The device must reach your API. Options:

- **HTTPS API (staging/production):** Set `EXPO_PUBLIC_API_BASE_URL` (and optionally other `EXPO_PUBLIC_*` vars) in `frontend/.env` or in EAS build env, then rebuild or restart with that env.
- **LAN (same WiFi as your machine):** Run the API on your machine (e.g. `cd apps/api && npm run dev`), find your LAN IP (e.g. `192.168.1.x`), and set `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.x:4000` in `frontend/.env`. Restart `npx expo start --dev-client` so the bundle picks it up.

Ensure `META_REDIRECT_URI` (and any OAuth callback) uses a URL the device can open (e.g. your API’s public URL or a deep link like `quickpost://oauth` if you wire it).

---

## Deep links (OAuth)

The app uses the **scheme** `quickpost` (see `app.json` → `expo.scheme`). For Meta OAuth:

- In development you can redirect to the API-hosted success/error pages (API uses this when `PUBLIC_APP_URL` is localhost).
- For a custom redirect into the app, configure Meta’s Valid OAuth Redirect URIs with your API callback URL; the API then redirects to `PUBLIC_APP_URL` (or the API’s own oauth/success and oauth/error when on localhost).

---

## Checklist

- [ ] EAS CLI installed and logged in
- [ ] `eas build --profile development --platform android` (or ios) run at least once
- [ ] Dev build installed on device/simulator
- [ ] `EXPO_PUBLIC_API_BASE_URL` set in `frontend/.env` (or in EAS env) so the device can reach the API
- [ ] `npx expo start --dev-client` used so the app loads your JS
- [ ] IAP and OAuth tested on the dev build (not Expo Go)

---

## Monitoring (Sentry) – mobile

For production or staging, you can add **Sentry Expo** to the app to capture JS errors and native crashes.

1. Install: `npx expo install @sentry/react-native`
2. In your app entry (e.g. `app/_layout.tsx`), call `Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN, ... })` as early as possible.
3. Set `EXPO_PUBLIC_SENTRY_DSN` in `.env` or EAS env (never log or expose tokens/receipts in Sentry breadcrumbs or extra).
4. See [Sentry Expo docs](https://docs.sentry.io/platforms/react-native/) for source maps and release setup.

This is optional; the API and worker already use Sentry when `SENTRY_DSN` is set.
