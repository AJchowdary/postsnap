# Quickpost — Complete Launch Checklist

Everything required to go from current state → live on App Store + Google Play.
Work through each phase in order. Items marked ⚠️ will cause store rejection if skipped.

---

## PHASE 1 — Developer Accounts (do first, some take days to activate)

### 1.1 Apple Developer Program
- [ ] Enroll at https://developer.apple.com — $99/year USD
- [ ] Wait for approval (instant with personal account, 1–3 days for company)
- [ ] In Xcode / App Store Connect, register the bundle ID `com.quickpost.app`
- [ ] Accept all agreements in App Store Connect → Agreements, Tax, and Banking

### 1.2 Google Play Developer Account
- [ ] Enroll at https://play.google.com/console — $25 one-time
- [ ] Complete identity verification (takes up to 48 hours)
- [ ] Accept the Developer Distribution Agreement
- [ ] Fill in payment profile (required even for free apps)

### 1.3 Meta (Facebook / Instagram) Developer Account
- [ ] Create account at https://developers.facebook.com — free
- [ ] Create an App → type: **Business**
- [ ] Add products: **Instagram Graph API** and **Facebook Login**
- [ ] Set App Mode to **Development** initially (production after review)

---

## PHASE 2 — Backend Environment Variables (Render.com)

Set all of these in **Render → quickpost-api → Environment**.

### 2.1 Required for the app to start
| Variable | Value | Where to get it |
|----------|-------|-----------------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase → Settings → API → service_role |
| `NODE_ENV` | `production` | hardcode |
| `CORS_ALLOWLIST` | your Render API URL | e.g. `https://quickpost-tl4u.onrender.com` |
| `TOKEN_ENCRYPTION_KEY` | 32+ random bytes | `openssl rand -base64 32` |

### 2.2 AI / Content generation
| Variable | Value | Where to get it |
|----------|-------|-----------------|
| `OPENAI_API_KEY` | `sk-...` | platform.openai.com → API keys |
| `AI_PROVIDER` | `openai` | hardcode |
| `OPENAI_CAPTION_MODEL` | `gpt-4o-mini` | default is fine |
| `OPENAI_IMAGE_MODEL_DEFAULT` | `gpt-image-1-mini` | default is fine |

### 2.3 Apple IAP ⚠️
| Variable | Value | Where to get it |
|----------|-------|-----------------|
| `APPLE_SHARED_SECRET` | 32-char hex string | App Store Connect → Your App → Subscriptions → App-Specific Shared Secret → Generate |
| `APPLE_SUBSCRIPTION_PRODUCT_IDS` | `com.quickpost.app.premium.monthly` | must match what you create in App Store Connect |

### 2.4 Google IAP ⚠️
| Variable | Value | Where to get it |
|----------|-------|-----------------|
| `GOOGLE_PLAY_PACKAGE_NAME` | `com.quickpost.app` | hardcode |
| `GOOGLE_SUBSCRIPTION_PRODUCT_IDS` | `com.quickpost.app.premium.monthly` | must match Play Console |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | `/etc/secrets/google-sa.json` | see 2.4a below |

**2.4a — Google service account setup:**
1. Play Console → Setup → API access → Link to a Google Cloud project (create one if needed)
2. Google Cloud Console → IAM & Admin → Service Accounts → Create service account
3. Grant role: **Android Publisher**
4. Create JSON key → download the file
5. In Render: go to **Secret Files** → upload the JSON as `google-sa.json`
6. Set `GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/etc/secrets/google-sa.json`
7. In your API, install the Google library: `cd apps/api && npm install googleapis`

### 2.5 Meta OAuth ⚠️
| Variable | Value | Where to get it |
|----------|-------|-----------------|
| `META_APP_ID` | numeric ID | developers.facebook.com → Your App → Settings → Basic |
| `META_APP_SECRET` | hex string | same page — click "Show" |
| `META_REDIRECT_URI` | `https://quickpost-tl4u.onrender.com/api/v1/social/meta/callback` | must match exactly what you add in Facebook Login settings |
| `META_GRAPH_VERSION` | `v20.0` | default fine |

**Meta OAuth callback setup:**
- developers.facebook.com → Facebook Login → Settings → Valid OAuth Redirect URIs
- Add: `https://quickpost-tl4u.onrender.com/api/v1/social/meta/callback`
- Also add your production domain when you get one

### 2.6 Push Notifications
| Variable | Value | Where to get it |
|----------|-------|-----------------|
| `EXPO_ACCESS_TOKEN` | `expo_...` | expo.dev → Account Settings → Access Tokens |

### 2.7 Operations
| Variable | Value |
|----------|-------|
| `ADMIN_METRICS_KEY` | any strong random string (`openssl rand -hex 24`) |
| `SCHEDULING_ENABLED` | `true` |
| `PUBLISH_ENABLED` | `true` |
| `REDIS_URL` | your Redis instance URL (Render Redis add-on or Upstash) |
| `SENTRY_DSN` | optional — from sentry.io for error tracking |

---

## PHASE 3 — EAS / Frontend Secrets

### 3.1 Add Supabase keys as EAS secrets ⚠️
These are never in code — set them as secrets in the EAS dashboard so every build gets them.

```
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxxx.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..."
```

Or go to: expo.dev → your project → Secrets → Create

### 3.2 Configure eas.json submit section ⚠️
Open `frontend/eas.json` and fill in:
```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your@appleid.com",
      "ascAppId": "1234567890",
      "appleTeamId": "ABCD1234EF"
    },
    "android": {
      "serviceAccountKeyPath": "./google-play-sa.json",
      "track": "internal"
    }
  }
}
```
- `ascAppId`: App Store Connect → Your App → App Information → Apple ID (the 10-digit number)
- `appleTeamId`: developer.apple.com → Account → Membership → Team ID

---

## PHASE 4 — App Store Connect Setup (Apple)

### 4.1 Create the app record
- App Store Connect → My Apps → + → New App
  - Platform: iOS
  - Name: Quickpost
  - Primary Language: English
  - Bundle ID: `com.quickpost.app`
  - SKU: `quickpost-2024` (any unique string)

### 4.2 Create subscription product ⚠️
- Your App → Subscriptions → + (create subscription group if needed)
- Reference Name: `Quickpost Pro Monthly`
- Product ID: `com.quickpost.app.premium.monthly`
- Duration: 1 Month
- Price: choose a tier (Tier 12 = $12.99, Tier 11 = $11.99 — Apple rounds)
- Add localization: Display Name + Description in English
- Status: must be **Ready to Submit** before app review

### 4.3 Generate App-Specific Shared Secret ⚠️
- Your App → Subscriptions → App-Specific Shared Secret → Generate
- Copy the 32-character hex string → set as `APPLE_SHARED_SECRET` on Render

### 4.4 App Store listing content
All required before first submission:
- [ ] App name: Quickpost
- [ ] Subtitle (30 chars): e.g. "AI Social Posts in 30 Seconds"
- [ ] Description (4000 chars max)
- [ ] Keywords (100 chars max, comma-separated)
- [ ] Support URL: must be a real working page, not mailto: ⚠️
  - Create `https://quickpost.app/support` or use a real URL
- [ ] Privacy Policy URL: `https://quickpost.app/privacy` — must be live ⚠️
- [ ] Category: Business (primary), Social Networking (secondary)
- [ ] Age rating: complete the questionnaire (likely 4+)
- [ ] Copyright: `© 2024 Your Company Name`

### 4.5 Screenshots ⚠️
Required sizes (all must be provided):
- iPhone 6.9" (1320 × 2868) — at least 3, up to 10
- iPhone 6.5" (1242 × 2688) — can reuse 6.9" if you add "iPad" variant
- iPad 12.9" (2048 × 2732) — required if `supportsTablet: true` (currently false, skip)

Use a tool like [ScreenshotCreator](https://www.screenshotcreator.com) or Figma to make marketing screenshots.

### 4.6 App icon ⚠️
- `frontend/assets/images/icon.png` must be exactly **1024 × 1024 PNG with no alpha channel**
- The current file is likely the Expo template placeholder — replace it
- Delete Expo template files: `partial-react-logo.png`, `react-logo.png`, `react-logo@2x.png`, `react-logo@3x.png`

---

## PHASE 5 — Google Play Console Setup

### 5.1 Create the app
- Play Console → Create app
  - App name: Quickpost
  - Default language: English
  - App or Game: App
  - Free or Paid: Free (IAP inside)
  - Declarations: check both boxes

### 5.2 Create subscription product ⚠️
- Monetize → Subscriptions → Create subscription
  - Product ID: `com.quickpost.app.premium.monthly`
  - Name: Quickpost Pro
  - Description: Unlimited AI-powered social posts
  - Billing period: Monthly
  - Price: $12.00
  - Free trial: 14 days (optional but recommended, matches your trial logic)
  - Grace period: 3 days (recommended)
  - Status: must be **Active** before submission

### 5.3 Store listing content
- [ ] Short description (80 chars)
- [ ] Full description (4000 chars)
- [ ] App icon: 512 × 512 PNG
- [ ] Feature graphic: 1024 × 500 PNG (shown at top of listing)
- [ ] Screenshots: at least 2 for phone (1080 × 1920 or 1080 × 2340 recommended)
- [ ] Privacy Policy URL: `https://quickpost.app/privacy` ⚠️
- [ ] Category: Business

### 5.4 Data Safety form ⚠️
Play Console → Your App → Policy → App content → Data Safety.
Based on your codebase, declare:

| Data type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Email address | Yes | No | Account management |
| User ID | Yes | No | App functionality |
| Photos/videos | Yes (optional) | No | App functionality |
| Purchase history | Yes | No | App functionality |
| Crash logs | Yes (Sentry) | Yes (Sentry) | Analytics |

### 5.5 Android notification icon ⚠️
The current `app.json` passes the full-colour app icon to `expo-notifications`. Android requires a **white-on-transparent silhouette PNG**.

Steps:
1. Create a white silhouette version of your icon (96×96px PNG, white shape on transparent background)
2. Save as `frontend/assets/images/notification-icon.png`
3. Update `app.json`:
```json
["expo-notifications", {
  "icon": "./assets/images/notification-icon.png",
  "color": "#4f46e5"
}]
```

### 5.6 Target API level
- Ensure `targetSdkVersion` is at least **API 34** (Android 14) — Expo SDK 54 handles this automatically

---

## PHASE 6 — Legal Pages (must be live before submission)

All three URLs must return real HTML pages — App Review will click them. ⚠️

### 6.1 Privacy Policy — `https://quickpost.app/privacy`
Must cover:
- What data is collected (email, photos, posts, purchase info, device info)
- How it's used (account, content generation, billing)
- Third parties (Supabase, OpenAI, Meta, Apple/Google IAP, Expo/Sentry)
- User rights (access, deletion, portability)
- Data retention periods
- Contact information

Free generator: https://www.privacypolicygenerator.info

### 6.2 Terms of Service — `https://quickpost.app/terms`
Must cover:
- Subscription terms and billing (auto-renewal, cancellation)
- Acceptable use policy
- Content ownership
- Liability limitations
- Governing law

### 6.3 Data Deletion — `https://quickpost.app/data-deletion` ⚠️
Required by Meta for any app using Facebook Login.
The page must either:
- Link to in-app "Delete Account" (which you now have), OR
- Provide a form or email address

Also used as the Apple fallback (`EXPO_PUBLIC_DATA_DELETION_URL` in eas.json ✓ already set).

### 6.4 Support page — `https://quickpost.app/support`
Required by Apple — `mailto:` links are not accepted as a Support URL.
Can be a simple page with your email address and FAQ.

---

## PHASE 7 — Code Changes Still Required

These are in-code fixes that were not applied in the previous session because they require significant work or assets.

### 7.1 ⚠️ CRITICAL — Apple IAP: Migrate from verifyReceipt to StoreKit 2

**File:** `apps/api/src/services/iapVerificationService.ts`

The current code calls `https://buy.itunes.apple.com/verifyReceipt` which Apple deprecated in June 2023. Apps built with Xcode 15+ / iOS 17+ SDK will have IAP verification fail silently.

Migration path:
1. Use the **App Store Server API** instead:
   - Endpoint: `https://api.storekit.itunes.apple.com/inApps/v1/subscriptions/{transactionId}`
   - Auth: JWT signed with your private key (from App Store Connect)
2. In App Store Connect → Users and Access → Integrations → App Store Connect API:
   - Generate a key → download the `.p8` file
   - Note the Key ID and Issuer ID
3. Set env vars:
   - `APPLE_STORE_API_KEY_ID` — the 10-char key ID
   - `APPLE_STORE_API_ISSUER_ID` — UUID from App Store Connect
   - `APPLE_STORE_API_PRIVATE_KEY` — contents of the `.p8` file (base64-encoded or raw)
4. Replace `verifyAppleReceipt()` in `iapVerificationService.ts` with a JWT-authenticated call to the App Store Server API

Reference: https://developer.apple.com/documentation/appstoreserverapi

### 7.2 ⚠️ CRITICAL — Meta posting provider is a stub

**File:** `apps/api/src/providers/posting/metaProvider.ts`

The file contains a `TODO` comment and the posting flow is not implemented. Instagram and Facebook posting will fail for all users until this is built.

What to implement:
- Exchange short-lived token for long-lived token on OAuth connect
- `POST /api/v1/social/meta/callback` must save the page access token per connected account
- For Instagram posts: use Graph API `/{ig-user-id}/media` then `/{ig-user-id}/media_publish`
- For Facebook page posts: use Graph API `/{page-id}/feed`
- Handle token refresh and expiry

### 7.3 ⚠️ Load Manrope + Inter fonts

**File:** `frontend/app/_layout.tsx`

Every screen uses `fontFamily: 'Manrope'` and `fontFamily: 'Inter'` but these fonts are never loaded. The UI silently falls back to system fonts.

Steps:
```bash
cd frontend
npx expo install @expo-google-fonts/manrope @expo-google-fonts/inter
```

Then in `_layout.tsx`, add font loading with splash screen guard:
```typescript
import { useFonts, Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

// Inside RootLayout:
const [fontsLoaded] = useFonts({ Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
useEffect(() => { if (fontsLoaded) SplashScreen.hideAsync(); }, [fontsLoaded]);
if (!fontsLoaded) return null;
```

### 7.4 ⚠️ PrivacyInfo.xcprivacy manifest (iOS 17+)

Apple requires a privacy manifest for apps using certain APIs. AsyncStorage uses `UserDefaults`, which triggers the requirement.

Create `frontend/ios/PrivacyInfo.xcprivacy`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
    <key>NSPrivacyAccessedAPIType</key>
    <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
    <key>NSPrivacyAccessedAPITypeReasons</key>
    <array>
      <string>C617.1</string>
    </array>
  </array>
  <key>NSPrivacyCollectedDataTypes</key>
  <array/>
  <key>NSPrivacyTracking</key>
  <false/>
</dict>
</plist>
```

Note: You may need to run `npx expo prebuild` first to generate the `ios/` folder.

### 7.5 Replace app icons and splash ⚠️
Currently the Expo template placeholder images are in use. Replace:

| File | Required size | Notes |
|------|--------------|-------|
| `frontend/assets/images/icon.png` | 1024 × 1024 PNG | No alpha channel for iOS |
| `frontend/assets/images/adaptive-icon.png` | 1024 × 1024 PNG | Android adaptive foreground |
| `frontend/assets/images/splash-image.png` | 1284 × 2778 PNG | Centred logo on `#4f46e5` bg |
| `frontend/assets/images/notification-icon.png` | 96 × 96 PNG | White silhouette on transparent |

Delete unused template files:
- `frontend/assets/images/partial-react-logo.png`
- `frontend/assets/images/react-logo.png`
- `frontend/assets/images/react-logo@2x.png`
- `frontend/assets/images/react-logo@3x.png`
- `frontend/assets/images/app-image.png` (unreferenced)

### 7.6 Fetch price from StoreKit at runtime

**File:** `frontend/src/components/PaywallModal.tsx` and `frontend/app/(tabs)/settings.tsx`

The price `$12/month` is hardcoded. Apple requires the displayed price to come from the StoreKit product at runtime (for correct localisation in non-USD countries).

Steps:
```typescript
import { getSubscriptions } from 'react-native-iap';

// In PaywallModal or settings, before showing the price:
const [localizedPrice, setLocalizedPrice] = useState('$12/month');
useEffect(() => {
  getSubscriptions({ skus: [IOS_PRODUCT_ID] })
    .then(products => {
      const p = products[0];
      if (p?.localizedPrice) setLocalizedPrice(`${p.localizedPrice}/month`);
    })
    .catch(() => {}); // fall back to hardcoded
}, []);
```

### 7.7 Show trial terms during onboarding

**File:** `frontend/app/onboarding.tsx`

The 14-day free trial is never mentioned to the user during onboarding. Apple reviewers sometimes flag this. Add text such as:
> "Start your 14-day free trial. After the trial, $12.99/month. Cancel anytime."

### 7.8 app.json — update version before first submission

**File:** `frontend/app.json`

```json
"version": "1.0.0"   // ← increment this on every TestFlight/Play build
```

---

## PHASE 8 — Meta App Review (for Instagram/Facebook posting)

Without this, only users you manually add as Testers can connect their accounts.

1. Make sure your app is fully working end-to-end (Phase 7.2 must be done first)
2. developers.facebook.com → App Review → Permissions and Features → Request:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
3. For each permission, provide:
   - A screencast showing the exact user flow that uses it
   - Written explanation of why it's needed
4. Set App Mode to **Live** after approval
5. Timeline: 3–10 business days

---

## PHASE 9 — Testing

### 9.1 Apple sandbox testing
- App Store Connect → Users and Access → Sandbox Testers → Create a sandbox Apple ID
- On device: Settings → App Store → Sandbox Account → sign in with sandbox ID
- Run a dev client build: `eas build --profile development --platform ios`
- Go through the full purchase flow — make sure `/subscription/verify` is called and subscription activates
- Test restore purchases

### 9.2 Google test purchases
- Play Console → Monetize → Testing → License Testing → add your Gmail address
- Install the internal test APK on a real Android device
- Go through purchase flow

### 9.3 TestFlight (Apple internal test)
- `eas build --profile production --platform ios`
- `eas submit --platform ios` (after configuring eas.json submit section)
- App Store Connect → TestFlight → add internal testers (your Apple ID)
- Wait for processing (~30 min)
- Test on real iPhone — check: fonts load, IAP works, account deletion works, social connect works

### 9.4 Google internal test track
- `eas build --profile production --platform android`
- `eas submit --platform android`
- Play Console → Testing → Internal Testing → add tester emails
- Download the app from Play Store (internal link) on a real Android device

### 9.5 Test checklist before submitting to review
- [ ] Sign up with email
- [ ] Sign up with Apple Sign-In (iOS)
- [ ] Onboarding flow completes, account is created
- [ ] Create a post: caption generates, image generates
- [ ] Connect Instagram account via Meta OAuth
- [ ] Post to Instagram (real post, not a mock)
- [ ] IAP: purchase subscription → status updates to Pro
- [ ] IAP: restore purchases works
- [ ] Account deletion: all data gone from Supabase after confirm
- [ ] Settings → Manage Subscription opens correct system page
- [ ] Privacy Policy and Terms links open live pages
- [ ] Push notifications received after enabling them
- [ ] App works offline (shows cached data, not a crash)
- [ ] No crashes in any main flow

---

## PHASE 10 — App Store Submission (Apple)

1. Ensure all PHASE 1–9 items are complete
2. `eas build --profile production --platform ios`
3. `eas submit --platform ios`
4. In App Store Connect:
   - Select the uploaded build
   - Fill in "What's New in This Version" (first release: "Initial release")
   - Answer Export Compliance: No encryption beyond HTTPS → select "No"
   - Answer Content Rights: if you use AI-generated images, select "Yes, I have rights"
   - Answer Advertising Identifier: No (if you don't use IDFA)
5. Submit for Review
6. Timeline: 1–3 business days (can be faster with Expedited Review)

**Common rejection reasons to avoid:**
- Placeholder content in screenshots
- Privacy Policy URL returns 404
- IAP price shown doesn't match StoreKit product
- Auto-renewal disclosure text missing (✓ fixed)
- Account deletion not working (✓ fixed)
- App crashes during review

---

## PHASE 11 — Play Store Submission (Google)

1. Ensure all PHASE 1–9 items are complete
2. `eas build --profile production --platform android`
3. `eas submit --platform android`
4. In Play Console:
   - Complete all store listing sections (green checkmarks required)
   - Complete Data Safety form (PHASE 5.4)
   - Set Content Rating: complete the questionnaire
   - Set Target Audience: 18+
   - App Access: select "All functionality is available without special access"
5. Go to Publishing → Countries and regions → add all countries
6. Submit to Internal Testing first → promote to Production after passing
7. Timeline: 3–7 days for first submission (subsequent updates: hours to 2 days)

---

## Summary — Ordered Action List

```
Week 1:
  ✅ Already done — code fixes from previous session
  [ ] Sign up for Apple Developer + Google Play accounts
  [ ] Create Meta developer app
  [ ] Design and export app icons (1024x1024 PNG, no alpha)
  [ ] Write/generate Privacy Policy, Terms, Data Deletion, Support pages
  [ ] Host legal pages at quickpost.app (use any static host)

Week 2:
  [ ] Set all Render environment variables (Phase 2)
  [ ] Set EAS secrets for Supabase keys (Phase 3)
  [ ] Create subscription products in both stores (Phase 4.2, 5.2)
  [ ] Implement Meta posting provider (Phase 7.2) — biggest engineering task
  [ ] Load Manrope + Inter fonts in _layout.tsx (Phase 7.3)
  [ ] Replace all app icon / splash assets (Phase 7.5)
  [ ] Create notification-icon.png (white silhouette)
  [ ] Migrate Apple IAP to StoreKit 2 API (Phase 7.1)

Week 3:
  [ ] Create PrivacyInfo.xcprivacy (Phase 7.4)
  [ ] Add trial terms to onboarding (Phase 7.7)
  [ ] Fetch price from StoreKit at runtime (Phase 7.6)
  [ ] Set up App Store Connect listing + screenshots (Phase 4.4, 4.5)
  [ ] Set up Play Console listing + screenshots (Phase 5.3)
  [ ] Complete Play Data Safety form (Phase 5.4)
  [ ] Submit to Meta App Review (Phase 8)

Week 4:
  [ ] Build production iOS + Android
  [ ] Run through full sandbox test checklist (Phase 9)
  [ ] TestFlight internal test
  [ ] Google internal test track
  [ ] Fix any issues found in testing
  [ ] Submit to App Store Review
  [ ] Submit to Google Play Review
```

---

*Generated 2026-04-04. Code fixes already applied: account deletion, paywall disclosure, subscription management link, security hardening, IAP allowlist, trust proxy, error boundary, font connection, 401 handler, rate limiting. See git log for details.*
