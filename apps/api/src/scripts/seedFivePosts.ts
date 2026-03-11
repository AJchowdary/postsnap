/**
 * DEV-ONLY: Seed 1 account (from first auth user), 5 posts, 5 jobs for worker verification.
 * Does not modify any existing rows. Uses context_text prefix "[seed]" for safe cleanup.
 * Usage: from apps/api: node -r ts-node/register src/scripts/seedFivePosts.ts
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { getSupabase } from '../db/supabaseClient';

const SEED_PREFIX = '[seed]';

async function main(): Promise<void> {
  const supabase = getSupabase();

  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1 });
  if (authErr || !authData?.users?.length) {
    console.log('No Supabase Auth users found.');
    console.log('Sign up once in the app (frontend), then run this script again.');
    process.exit(0);
  }
  const ownerUserId = authData.users[0].id;
  console.log('[seed] Using auth user:', ownerUserId);

  const { data: existingAccount } = await supabase
    .from('accounts')
    .select('id')
    .eq('owner_user_id', ownerUserId)
    .maybeSingle();

  let accountId: string;
  if (existingAccount?.id) {
    accountId = existingAccount.id;
    console.log('[seed] Existing account:', accountId);
  } else {
    const { data: newAccount, error: accErr } = await supabase
      .from('accounts')
      .insert({ owner_user_id: ownerUserId, business_type: 'restaurant' })
      .select('id')
      .single();
    if (accErr) {
      console.error('[seed] Failed to create account:', accErr.message);
      process.exit(1);
    }
    accountId = newAccount!.id;
    const now = new Date().toISOString();
    await supabase.from('business_profiles').insert({
      account_id: accountId,
      name: 'Seed Test Business',
      brand_style: 'clean',
      overlay_default_on: false,
      updated_at: now,
    });
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('subscriptions').insert({
      account_id: accountId,
      status: 'trial_active',
      trial_type: 'time',
      trial_end_at: trialEnd,
      trial_posts_used: 0,
      updated_at: now,
    });
    console.log('[seed] Created account:', accountId);
  }

  const now = new Date().toISOString();
  const postIds: string[] = [];
  const jobIds: string[] = [];

  for (let n = 1; n <= 5; n++) {
    const { data: post, error: postErr } = await supabase
      .from('posts')
      .insert({
        account_id: accountId,
        status: 'draft',
        template_id: 'auto',
        context_text: `${SEED_PREFIX} Seed test post #${n}`,
        original_image_path: null,
        processed_image_path: null,
        caption_json: null,
        publish_targets: [],
        regen_count: 0,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();
    if (postErr) {
      console.error('[seed] Failed to create post:', postErr.message);
      process.exit(1);
    }
    postIds.push(post!.id);
  }
  console.log('[seed] Created 5 posts:', postIds.join(', '));

  for (const postId of postIds) {
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .insert({
        post_id: postId,
        type: 'generate',
        status: 'pending',
        attempts: 0,
        run_at: now,
        payload: { userId: ownerUserId, postId, accountId },
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();
    if (jobErr) {
      console.error('[seed] Failed to enqueue job:', jobErr.message);
      process.exit(1);
    }
    jobIds.push(job!.id);
  }
  console.log('[seed] Enqueued 5 jobs:', jobIds.join(', '));
  console.log('[seed] Done. Run workers and use CHECK_JOBS_AND_POSTS.sql to verify.');
}

main().catch((e) => {
  console.error('[seed] Unexpected error:', e instanceof Error ? e.message : e);
  process.exit(1);
});
