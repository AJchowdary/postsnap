-- Campaigns: multi-creative briefs; posts link via campaign_id (SET NULL if campaign removed).

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  product_url TEXT,
  product_name TEXT,
  product_description TEXT,
  product_image_url TEXT,
  aspect_ratio TEXT NOT NULL DEFAULT 'square',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campaigns_account_active
  ON campaigns (account_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_campaign_created
  ON posts (campaign_id, created_at DESC)
  WHERE campaign_id IS NOT NULL;

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaigns_owner ON campaigns FOR ALL USING (
  account_id IN (SELECT id FROM accounts WHERE owner_user_id = auth.uid())
);
