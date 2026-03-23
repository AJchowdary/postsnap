-- ============================================================
-- PostSnap Supabase SQL Migrations
-- Run these in order in your Supabase SQL Editor.
-- File: 001_initial_schema.sql
-- ============================================================

-- ----------------------------------------------------------------
-- EXTENSIONS
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------
-- USERS TABLE (managed by Supabase Auth, but here for reference)
-- Note: auth.users is created automatically by Supabase Auth.
-- We only create application-level tables here.
-- ----------------------------------------------------------------

-- ----------------------------------------------------------------
-- ACCOUNTS (one per user, holds business profile)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
    id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name          TEXT NOT NULL DEFAULT '',
    type          TEXT NOT NULL DEFAULT 'restaurant'
                    CHECK (type IN ('restaurant', 'salon', 'retail', 'gym', 'cafe')),
    city          TEXT,
    logo          TEXT,          -- base64 or storage URL
    brand_color   TEXT,
    brand_style   TEXT NOT NULL DEFAULT 'clean'
                    CHECK (brand_style IN ('clean', 'bold', 'minimal')),
    use_logo_overlay BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id)
);

-- ----------------------------------------------------------------
-- SOCIAL CONNECTIONS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_connections (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform       TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook')),
    handle         TEXT NOT NULL,
    connected      BOOLEAN NOT NULL DEFAULT TRUE,
    connected_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, platform)
);

-- ----------------------------------------------------------------
-- SUBSCRIPTIONS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
    id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'trial'
                   CHECK (status IN ('trial', 'subscribed', 'expired')),
    trial_end_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    upgraded_at  TIMESTAMPTZ,
    posts_used   INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id)
);

-- ----------------------------------------------------------------
-- POSTS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
    id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    template          TEXT NOT NULL DEFAULT 'auto',
    photo             TEXT,           -- base64 original image
    description       TEXT NOT NULL DEFAULT '',
    caption           TEXT NOT NULL DEFAULT '',
    processed_image   TEXT,           -- base64 AI-enhanced image
    platforms         TEXT[] NOT NULL DEFAULT '{}',
    status            TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'failed')),
    job_id            UUID,
    job_status        TEXT CHECK (job_status IN ('pending', 'processing', 'done', 'error')),
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    published_at      TIMESTAMPTZ
);

-- Index for listing posts by user, ordered by newest
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC);

-- ----------------------------------------------------------------
-- ASYNC JOBS (for AI generation queue)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
    id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    type       TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'processing', 'done', 'error')),
    payload    JSONB NOT NULL DEFAULT '{}',
    result     JSONB,
    error      TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- UPDATED_AT TRIGGER (auto-maintains updated_at on all tables)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
