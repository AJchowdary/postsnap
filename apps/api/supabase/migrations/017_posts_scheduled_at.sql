-- Scheduled posts: when status = 'scheduled', scheduled_at is the publish time (UTC).
ALTER TABLE posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_posts_scheduled_due
  ON posts (scheduled_at)
  WHERE status = 'scheduled';
