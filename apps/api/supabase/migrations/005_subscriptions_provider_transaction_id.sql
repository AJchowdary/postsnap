-- Optional: store provider transaction id for idempotency/audit (IAP Step 6)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT;

COMMENT ON COLUMN subscriptions.provider_transaction_id IS 'Apple transaction_id or Google orderId from IAP verification';
