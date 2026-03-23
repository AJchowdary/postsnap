/**
 * DEV-ONLY: Remove posts and jobs created by seedFivePosts.ts.
 * Deletes only rows with context_text starting with "[seed]" (posts) and jobs for those posts.
 * Does not touch any other data.
 * Usage: from apps/api: node -r ts-node/register src/scripts/cleanupSeed.ts
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { getSupabase } from '../db/supabaseClient';

const SEED_PREFIX = '[seed]';

async function main(): Promise<void> {
  const supabase = getSupabase();

  const { data: seedPosts, error: listErr } = await supabase
    .from('posts')
    .select('id')
    .like('context_text', `${SEED_PREFIX}%`);
  if (listErr) {
    console.error('[cleanup] Failed to list seed posts:', listErr.message);
    process.exit(1);
  }
  const postIds = (seedPosts ?? []).map((p) => p.id);
  if (postIds.length === 0) {
    console.log('[cleanup] No seed posts found (context_text like "[seed]%"). Nothing to delete.');
    process.exit(0);
  }

  const { error: jobsErr } = await supabase.from('jobs').delete().in('post_id', postIds);
  if (jobsErr) {
    console.error('[cleanup] Failed to delete jobs:', jobsErr.message);
    process.exit(1);
  }
  const { error: postsErr } = await supabase.from('posts').delete().in('id', postIds);
  if (postsErr) {
    console.error('[cleanup] Failed to delete posts:', postsErr.message);
    process.exit(1);
  }
  console.log('[cleanup] Deleted', postIds.length, 'seed posts and their jobs.');
}

main().catch((e) => {
  console.error('[cleanup] Unexpected error:', e instanceof Error ? e.message : e);
  process.exit(1);
});
