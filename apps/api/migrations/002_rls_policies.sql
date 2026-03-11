-- ============================================================
-- PostSnap Supabase RLS Policies
-- Run AFTER 001_initial_schema.sql
-- File: 002_rls_policies.sql
-- ============================================================

-- ----------------------------------------------------------------
-- Enable Row Level Security on all tables
-- ----------------------------------------------------------------
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- ACCOUNTS RLS
-- ----------------------------------------------------------------
CREATE POLICY "Users can view own account"
    ON accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own account"
    ON accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own account"
    ON accounts FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- SOCIAL CONNECTIONS RLS
-- ----------------------------------------------------------------
CREATE POLICY "Users can view own social connections"
    ON social_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own social connections"
    ON social_connections FOR ALL
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- SUBSCRIPTIONS RLS
-- ----------------------------------------------------------------
CREATE POLICY "Users can view own subscription"
    ON subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Service role (backend) can manage subscriptions
CREATE POLICY "Service role can manage subscriptions"
    ON subscriptions FOR ALL
    USING (auth.role() = 'service_role');

-- ----------------------------------------------------------------
-- POSTS RLS
-- ----------------------------------------------------------------
CREATE POLICY "Users can view own posts"
    ON posts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own posts"
    ON posts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
    ON posts FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
    ON posts FOR DELETE
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- JOBS RLS (service role only)
-- ----------------------------------------------------------------
CREATE POLICY "Service role can manage jobs"
    ON jobs FOR ALL
    USING (auth.role() = 'service_role');
