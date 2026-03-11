# In-App Purchase (IAP) Setup — PostSnap

This document describes how to configure App Store and Google Play subscription products and where to set product IDs in the app. **Do not unlock subscription client-side; backend verification is required.**

---

## 1. Apple App Store Connect

### 1.1 Create subscription product (auto-renewable)

1. In [App Store Connect](https://appstoreconnect.apple.com), open your app → **Subscriptions** (or create a subscription group first).
2. Create a **Subscription Group** (e.g. "PostSnap Pro").
3. Inside the group, create a **Subscription**:
   - **Reference name:** e.g. "PostSnap Pro Monthly"
   - **Product ID:** choose a unique ID (e.g. `com.yourapp.postsnap.pro.monthly`). This becomes **IOS_SUBSCRIPTION_PRODUCT_ID** in app config.
4. Add a **Subscription Price** (e.g. $12/month).
5. **Optional (annual):** Create a second subscription in the same group (e.g. `com.yourapp.postsnap.pro.annual`) and set a discounted price; mark as "Recommended" if desired.

### 1.2 Localization, tax, banking

- Add **Localizations** (display name, description) for each territory.
- Complete **Tax** and **Banking** in Agreements, Tax, and Banking.
- **Paid Apps** agreement must be active.

### 1.3 Sandbox testers

- **Users and Access** → **Sandbox** → **Testers**: create sandbox Apple IDs.
- On device: **Settings → App Store → Sandbox Account** and sign in with a sandbox tester to test purchases without being charged.

### 1.4 Record product ID

- **IOS_SUBSCRIPTION_PRODUCT_ID** = the Product ID you created (e.g. `com.yourapp.postsnap.pro.monthly`).
- This value must match the ID used in the app (e.g. `EXPO_PUBLIC_IOS_SUBSCRIPTION_PRODUCT_ID` or app config) and the backend allowlist.

---

## 2. Google Play Console

### 2.1 Create subscription product

1. In [Google Play Console](https://play.google.com/console), open your app → **Monetize** → **Subscriptions**.
2. **Create subscription**:
   - **Product ID:** e.g. `postsnap_pro_monthly` (this becomes **ANDROID_SUBSCRIPTION_PRODUCT_ID**).
   - **Name** and **Description** for the store listing.

### 2.2 Base plan and offers

1. Add a **Base plan** (e.g. monthly recurring).
2. Set **Price** and **Billing period**.
3. (Optional) Add **Offers** (e.g. free trial, introductory price).

### 2.3 License testers

- **Setup** → **License testing**: add test Gmail accounts.
- These accounts can complete test purchases without being charged.

### 2.4 Record product ID

- **ANDROID_SUBSCRIPTION_PRODUCT_ID** = the subscription Product ID (e.g. `postsnap_pro_monthly`).
- **Package name** = your app’s package name (e.g. `com.yourapp.postsnap`). Required for server-side verification.

---

## 3. App config

- The mobile app must use the **same product IDs** as configured in the stores.
- Set in environment or app config, for example:
  - `EXPO_PUBLIC_IOS_SUBSCRIPTION_PRODUCT_ID`
  - `EXPO_PUBLIC_ANDROID_SUBSCRIPTION_PRODUCT_ID`
- Backend must allow only these product IDs when verifying receipts/tokens (see API verify endpoint).

---

## 4. Known blockers (from earlier steps)

1. **Step 4 — Meta OAuth not fully verified**  
   Login / “content not available” / test user creation issues. Publishing (Step 5) depends on this.

2. **Mobile device testing**  
   Expo QR / tunnel can have network issues. OAuth deep links and IAP should be tested on a **real device** (Dev Build or production build).

3. **Meta app review prerequisites**  
   Icon, privacy policy, data deletion, category still incomplete — required before permissions submission.

4. **Production deployment**  
   API and workers need a stable host and HTTPS for real OAuth redirect URIs and store builds.

5. **OpenAI keys**  
   Real keys not added in some envs; captions/images may use mocks. Cost controls exist but need staging validation.
