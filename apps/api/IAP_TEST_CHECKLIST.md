# IAP Testing Checklist (Step 6)

Use this checklist to verify in-app subscription purchase, restore, and entitlement behavior. **Never unlock without server verification.**

---

## iOS Sandbox

- [ ] **Purchase success**
  - Sign in with Sandbox Apple ID on device.
  - In app: Start subscription → complete purchase in sandbox.
  - Backend receives verify call; subscriptions table shows `status = active_subscription`, `provider = apple`, `current_period_end` set.
  - Publish is allowed (no 402).

- [ ] **Cancel purchase**
  - In Sandbox: cancel subscription (or use Settings → Subscriptions).
  - Next verify or status check should reflect inactive/expired when period ends.
  - Publish returns 402 after period end until renewed or restored.

- [ ] **Restore**
  - On a device that previously purchased (or same sandbox account): tap Restore purchases.
  - App sends receipt/token to POST /subscription/restore (or /verify).
  - Backend updates subscription; status returns to active; publish allowed.

- [ ] **Renewal (accelerated sandbox)**
  - Sandbox renews monthly subs every 5 minutes. Wait for renewal; confirm `current_period_end` updates after verify/status.

- [ ] **Cancel renewal → entitlement changes**
  - Cancel in sandbox; let period expire (or use accelerated expiry).
  - Confirm GET /subscription/status returns `isEligible: false` and publish returns 402 with payload.

---

## Android License Testing

- [ ] **Purchase success**
  - Add test account in Play Console → License testing.
  - In app: Start subscription → complete test purchase.
  - Backend verify with `purchaseToken`; subscriptions table updated; publish allowed.

- [ ] **Cancel/refund → entitlement changes**
  - Refund or cancel in Play Console (or let test subscription expire).
  - Verify or status shows inactive; publish returns 402.

- [ ] **Restore**
  - Reinstall app or tap Restore; send purchase token to backend restore/verify.
  - Subscription restored; publish allowed.

- [ ] **Subscription expired → blocked**
  - After expiry, GET /subscription/status returns not eligible; POST /posts/:id/publish returns 402.

---

## Backend checks

- **POST /api/v1/subscription/verify**
  - Body: `platform`, `productId`, and either `receipt` (iOS) or `purchaseToken` (+ optional `packageName`) (Android).
  - Response: `status`, `currentPeriodEnd`, `isEligible`, `provider`.
  - Subscriptions table: `status`, `current_period_end`, `provider`, `provider_transaction_id`, `updated_at` updated.

- **GET /api/v1/subscription/status**
  - Returns: `status`, `isEligible`, `trial_end_at`, `days_left`, `current_period_end`, plus `daysLeft`, `postsLeft`, `planName`, `price` for UI.

- **402 on publish**
  - When not eligible: POST /posts/:id/publish returns 402 with body `upgrade_required`, `reason`, `trial_end_at`, `days_left`. App shows paywall; after purchase + verify, retry publish succeeds.

---

## Security

- No receipt/token in logs (redacted).
- No unlocking on client without server verify.
- Product IDs validated server-side (allowlist from env).
