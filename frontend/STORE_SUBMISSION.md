# Store Submission Checklist

## App Info
- **App Name:** Quickpost
- **Subtitle/Short Description:** AI-powered social posts for small businesses
- **Bundle ID (iOS):** com.quickpost.app
- **Package (Android):** com.quickpost.app
- **Version:** 1.0.0
- **Category:** Business

## Before You Build
- [ ] Replace EXPO_PUBLIC_API_BASE_URL in eas.json production env with real API URL
- [ ] Set EXPO_PUBLIC_PRIVACY_URL, TERMS_URL, DATA_DELETION_URL to live URLs
- [ ] Create IAP products in App Store Connect and Play Console matching product IDs above
- [ ] Set APPLE_SHARED_SECRET and GOOGLE_* in API production env
- [ ] Configure Meta app with production redirect URI
- [ ] Replace ios.bundleIdentifier and android.package if changed from com.quickpost.app
- [ ] Confirm icon.png is 1024x1024, no transparency, no rounded corners (Apple requirement)
- [ ] Confirm adaptive-icon.png exists and has correct dimensions
- [ ] Confirm splash image exists (app.json uses ./assets/images/splash-image.png)

## EAS Production Build Commands
```
cd frontend
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```

## EAS Submit Commands (after build)
```
npx eas submit --platform ios
npx eas submit --platform android
```

## App Store Connect (iOS)
- [ ] Create app in App Store Connect
- [ ] Upload screenshots (6.9" iPhone, 6.5" iPhone, iPad if needed)
- [ ] Fill in description, keywords, support URL
- [ ] Set age rating (likely 4+)
- [ ] Add privacy policy URL
- [ ] Answer data collection questionnaire

## Google Play Console (Android)
- [ ] Create app in Play Console
- [ ] Upload screenshots (phone required, tablet optional)
- [ ] Fill in store listing
- [ ] Complete data safety section
- [ ] Set content rating
- [ ] Add privacy policy URL
- [ ] Create internal test track first, then promote to production

## Final Checks
- [ ] Test auth (register + login) on real device with production build
- [ ] Test post creation and generation
- [ ] Test IAP purchase and restore
- [ ] Test Meta connect (if submitting with social feature enabled)
- [ ] Test legal links open correctly
