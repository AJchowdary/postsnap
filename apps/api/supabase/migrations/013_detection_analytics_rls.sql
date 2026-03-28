-- Lock down internal tables for PostgREST: API uses service role only.
-- Service role bypasses RLS; anon/authenticated have no policies → no direct table access.

ALTER TABLE IF EXISTS detection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS analytics_events ENABLE ROW LEVEL SECURITY;
