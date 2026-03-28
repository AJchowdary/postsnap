-- Generic caption detection / quality pipeline audit trail

CREATE TABLE IF NOT EXISTS detection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  outcome TEXT NOT NULL,
  is_generic BOOLEAN NOT NULL DEFAULT false,
  score DOUBLE PRECISION,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  soft_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_detection_logs_account_created
  ON detection_logs(account_id, created_at DESC);

COMMENT ON TABLE detection_logs IS 'Caption generic-detector runs (pass, retry, deliver-after-fail)';
