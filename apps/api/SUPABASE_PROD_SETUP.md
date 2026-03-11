# Supabase production setup

Run **migrations first**, then deploy API and worker. Order: **DB → API → Worker**.

---

## 1. Run migrations in Supabase SQL Editor

In your Supabase project: **SQL Editor** → New query. Run each migration file in order (copy/paste contents).

| Order | File | Purpose |
|-------|------|---------|
| 1 | `supabase/migrations/001_initial_schema.sql` | Tables: accounts, business_profiles, social_connections, subscriptions, templates, posts, post_publish_results, jobs. RLS and policies. |
| 2 | `supabase/migrations/002_seed_templates.sql` | Seed template rows. |
| 3 | `supabase/migrations/003_claim_next_job.sql` | RPC `claim_next_job()` for atomic job claiming. |
| 4 | `supabase/migrations/004_social_connections_meta.sql` | Meta OAuth columns on `social_connections`. |
| 5 | `supabase/migrations/005_subscriptions_provider_transaction_id.sql` | IAP provider transaction id on `subscriptions`. |

**Tip:** You can concatenate all files in order and run as one script, or run one by one. If a migration is already applied (e.g. "relation already exists"), you can skip or use `IF NOT EXISTS` (already used in migrations).

---

## 2. Verify `claim_next_job` exists

In SQL Editor:

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'claim_next_job';
```

Expected: one row with `claim_next_job`.

Test call (returns no row if no pending job):

```sql
SELECT * FROM claim_next_job();
```

---

## 3. Verify RLS and policies

RLS is enabled on: `accounts`, `business_profiles`, `social_connections`, `subscriptions`, `templates`, `posts`, `post_publish_results`, `jobs`.

In SQL Editor:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('accounts', 'posts', 'jobs', 'social_connections', 'subscriptions');
```

Expected: `rowsecurity = true` for each.

Policies:

```sql
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
```

You should see policies such as `accounts_owner`, `posts_owner`, `jobs_owner`, etc.

**Note:** The API uses **service role** key, so it bypasses RLS. RLS protects direct Supabase client access (e.g. from frontend with anon key). Ensure the API never exposes the service role key.

---

## 4. Storage bucket (post-images)

The app expects a storage bucket named **post-images** (or the value of `STORAGE_BUCKET` env var).

1. In Supabase: **Storage** → **New bucket**.
2. Name: `post-images`.
3. Set **Public** or **Private** as required by your app (signed URLs are used for upload/read; if private, ensure RLS/policies allow service role access).
4. Create the bucket.

If the bucket is private, ensure your storage service uses the service role key to generate signed URLs (as in `storageService`).

---

## 5. Migration checklist (before deploy)

- [ ] All five migrations run in order in the **production** Supabase project.
- [ ] `claim_next_job()` exists and returns no error when called.
- [ ] RLS enabled on all app tables; policies present.
- [ ] Bucket `post-images` (or `STORAGE_BUCKET`) exists and is configured (public/private + policies if needed).
- [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for this project are set in Render (and never committed).

After this, proceed with **API** and **Worker** deployment (see DEPLOYMENT_RUNBOOK.md and DEPLOY_RENDER.md).
