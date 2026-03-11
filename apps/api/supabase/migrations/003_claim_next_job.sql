-- Atomic job claim: one row locked (FOR UPDATE SKIP LOCKED), updated to processing, and returned.
-- Safe for multiple workers; only one worker gets each job.
CREATE OR REPLACE FUNCTION claim_next_job()
RETURNS SETOF jobs
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH sel AS (
    SELECT id FROM jobs
    WHERE status = 'pending' AND run_at <= now()
    ORDER BY run_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE jobs j
  SET status = 'processing', updated_at = now()
  FROM sel
  WHERE j.id = sel.id
  RETURNING j.*;
END;
$$;
