-- PostSnap MVP schema for Supabase (Postgres)
-- Run in Supabase SQL Editor or via migration tool.

-- accounts: one per user (owner = Supabase Auth uid)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_type TEXT NOT NULL DEFAULT 'restaurant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- business_profiles: 1:1 with account
CREATE TABLE IF NOT EXISTS business_profiles (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  city TEXT,
  logo_url TEXT,
  brand_color TEXT,
  brand_style TEXT NOT NULL DEFAULT 'clean',
  overlay_default_on BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- social_connections: one per platform per account
CREATE TABLE IF NOT EXISTS social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  handle_or_page TEXT NOT NULL DEFAULT '',
  access_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, platform)
);
CREATE INDEX IF NOT EXISTS idx_social_connections_account_platform ON social_connections(account_id, platform);

-- subscriptions: 1:1 with account
CREATE TABLE IF NOT EXISTS subscriptions (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'trial_active',
  trial_type TEXT,
  trial_end_at TIMESTAMPTZ,
  trial_posts_limit INT DEFAULT 0,
  trial_posts_used INT NOT NULL DEFAULT 0,
  provider TEXT,
  current_period_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- templates: seed data (id + business_type = unique)
CREATE TABLE IF NOT EXISTS templates (
  id TEXT NOT NULL,
  business_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  default_overlay_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, business_type)
);

-- posts: no base64; only storage paths and metadata
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft',
  template_id TEXT NOT NULL DEFAULT 'auto',
  context_text TEXT NOT NULL DEFAULT '',
  original_image_path TEXT,
  processed_image_path TEXT,
  caption_json JSONB,
  publish_targets JSONB DEFAULT '[]',
  regen_count INT NOT NULL DEFAULT 0,
  last_generated_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_account_created ON posts(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);

-- post_publish_results: one per platform per publish
CREATE TABLE IF NOT EXISTS post_publish_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_post_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_post_publish_results_post ON post_publish_results(post_id);

-- jobs: DB-backed queue (for when Redis unavailable)
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'generate',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  payload JSONB,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_run ON jobs(status, run_at) WHERE status = 'pending';

-- RLS: enable on all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_publish_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Policies: user can only access their account and related data
CREATE POLICY accounts_owner ON accounts FOR ALL USING (auth.uid() = owner_user_id);
CREATE POLICY business_profiles_owner ON business_profiles FOR ALL USING (
  account_id IN (SELECT id FROM accounts WHERE owner_user_id = auth.uid())
);
CREATE POLICY social_connections_owner ON social_connections FOR ALL USING (
  account_id IN (SELECT id FROM accounts WHERE owner_user_id = auth.uid())
);
CREATE POLICY subscriptions_owner ON subscriptions FOR ALL USING (
  account_id IN (SELECT id FROM accounts WHERE owner_user_id = auth.uid())
);
CREATE POLICY posts_owner ON posts FOR ALL USING (
  account_id IN (SELECT id FROM accounts WHERE owner_user_id = auth.uid())
);
CREATE POLICY post_publish_results_owner ON post_publish_results FOR ALL USING (
  post_id IN (SELECT id FROM posts WHERE account_id IN (SELECT id FROM accounts WHERE owner_user_id = auth.uid()))
);
CREATE POLICY jobs_owner ON jobs FOR ALL USING (
  post_id IN (SELECT id FROM posts WHERE account_id IN (SELECT id FROM accounts WHERE owner_user_id = auth.uid()))
);

-- templates: read-only for all authenticated
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY templates_read ON templates FOR SELECT TO authenticated USING (true);
