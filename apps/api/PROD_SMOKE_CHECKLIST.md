# Production smoke checklist (repo-side)

Run these checks before or after deploying to confirm the API and worker are production-ready.

---

## 1. Build passes

```bash
cd apps/api
npm ci
npm run build
```

- **Pass:** No TypeScript or build errors; `dist/` contains `index.js` and `jobs/workerProcess.js`.

---

## 2. API start passes

```bash
cd apps/api
npm run start
```

- **Pass:** Process starts and logs e.g. `Quickpost Node API running on port ...` and `In-process worker disabled (default); run separate worker(s).`
- **Fail:** If NODE_ENV=production and required env (e.g. CORS_ALLOWLIST, TOKEN_ENCRYPTION_KEY, Meta vars) are missing, startup throws a clear error and exits.

---

## 3. Health endpoint returns 200

With API running (or after deploy):

```bash
curl -s http://localhost:4000/api/health
```

- **Pass:** HTTP 200 and JSON like `{"status":"ok","service":"api","version":"1.0.0","time":"..."}`.
- Health must **not** require auth.

---

## 4. Worker start passes

```bash
cd apps/api
npm run start:worker
```

- **Pass:** Process starts and logs e.g. `[worker] starting...` and `DB-backed job worker started`; no immediate crash.
- Run in a separate terminal from the API.

---

## 5. Supabase: `claim_next_job` exists

In Supabase SQL Editor (production or staging DB):

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'claim_next_job';
```

- **Pass:** One row returned. Optional: `SELECT * FROM claim_next_job();` returns no row when queue is empty (no error).

---

## 6. Worker polls jobs

- With API running, create a post and trigger generation (or enqueue a job via your app).
- With worker running (`npm run start:worker`), within a few seconds the job should move to `processing` then `done` (or `error`).
- Check `jobs` table in Supabase: `status` and `updated_at` change as expected.

---

## 7. Publish kill switch (if implemented)

- Set `PUBLISH_ENABLED=false` in env and restart API (and worker if applicable).
- Trigger a publish (e.g. POST to publish endpoint).
- **Pass:** API returns **503** and message indicates publishing is disabled; worker marks publish jobs as **error** with a clear message.
- Set `PUBLISH_ENABLED=true` again for normal operation.

---

## 8. CORS (production)

- With `NODE_ENV=production`, omit or leave empty `CORS_ALLOWLIST`.
- **Pass:** API fails to start with a clear error (e.g. `CORS_ALLOWLIST (comma-separated origins; required in production)`).
- Set `CORS_ALLOWLIST` to a valid list and restart; startup should succeed.

---

## Quick command reference

| Action              | Command (from `apps/api`)     |
|---------------------|-------------------------------|
| Build               | `npm run build`               |
| Start API           | `npm run start`               |
| Start worker        | `npm run start:worker`        |
| Health check        | `curl -s http://localhost:4000/api/health` |
