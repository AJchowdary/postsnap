-- Read-only. Run in Supabase SQL Editor after Step 1 verification (2 workers + seed script).
-- Use to confirm jobs are processed exactly once and posts get caption_json.

-- Jobs (latest 20): id, post_id, status, attempts, run_at, last_error preview
SELECT id, post_id, type, status, attempts, run_at, left(coalesce(last_error, '')::text, 80) AS last_error
FROM jobs
ORDER BY created_at DESC
LIMIT 20;

-- Posts (latest 20): id, status, regen_count, has_caption, has_processed_image
SELECT id, account_id, status, regen_count,
       (caption_json IS NOT NULL) AS has_caption,
       (processed_image_path IS NOT NULL) AS has_processed_image
FROM posts
ORDER BY created_at DESC
LIMIT 20;
