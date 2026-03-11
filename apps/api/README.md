# PostSnap API (QuickPost)

Node.js + Express + TypeScript API. Supabase (Postgres + Auth + Storage) only; no MongoDB.

## Setup

### 1. Supabase

- Create a project at [supabase.com](https://supabase.com).
- Run SQL migrations in the SQL Editor (in order):
  - `supabase/migrations/001_initial_schema.sql`
  - `supabase/migrations/002_seed_templates.sql`
- Create a **private** storage bucket named `post-images` (or set `STORAGE_BUCKET`).
- In Authentication > URL Configuration, add your app URL(s) to Redirect URLs if needed.

### 2. Environment

Copy `.env.example` to `.env` and set:

- `SUPABASE_URL` – project URL
- `SUPABASE_SERVICE_ROLE_KEY` – service role key (server only; never expose to mobile)
- `OPENAI_API_KEY` – for captions and image editing (optional; mock used if missing)
- `CORS_ALLOWLIST` – comma-separated origins (e.g. Expo dev + production scheme)

For **Step 4 (Meta OAuth)** and detailed env notes (required vs optional, local dev ports 4000/4001, generating `TOKEN_ENCRYPTION_KEY`), see **[ENV_SETUP.md](./ENV_SETUP.md)**.

### 3. Run API and worker

```bash
npm install
npm run dev
```

The same process runs the HTTP server and the in-process job worker (DB-backed queue). For a separate worker process, run the same entrypoint and ensure only one process runs the worker loop, or add a `worker` script that only runs the job loop.

### 4. Validate end-to-end

1. Use Supabase Auth (client) to sign up/sign in and get a JWT.
2. Call `POST /api/v1/account/bootstrap` with `Authorization: Bearer <jwt>`.
3. Call `POST /api/v1/posts` with body `{ "context_text": "Test", "template_id": "auto" }` → get `{ post, uploadUrl, uploadPath }`.
4. Upload the image to `uploadUrl` (PUT), then `POST /api/v1/posts/:id/upload-complete` with `{ "path": "<uploadPath>" }`.
5. Call `POST /api/v1/posts/:id/generate` → 202 with `jobId`; poll or wait, then `GET /api/v1/posts/:id` for caption and processed image path.
6. Call `POST /api/v1/posts/:id/publish` with `{ "platforms": ["instagram"] }` (gated by trial/subscription).

## Environment variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only) |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_CAPTION_MODEL` | Caption model (default: `gpt-4o-mini`) |
| `STORAGE_BUCKET` | Storage bucket name (default: `post-images`) |
| `CORS_ALLOWLIST` | Comma-separated allowed origins |
| `PORT` | Server port (default: 4000) |
| `REDIS_URL` | Optional; if set, can be used for BullMQ and (TODO) Redis rate limit store |
| `RATE_LIMIT_STORE` | `memory` (default), `redis`, or `supabase`. Memory = single-instance only. |
| `RATE_LIMIT_*` | Optional rate limit tuning |
| **Step 4 Meta OAuth** | See [ENV_SETUP.md](./ENV_SETUP.md). Required in production: `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`. Optional: `META_OAUTH_SCOPES`, `META_GRAPH_VERSION`, `PUBLIC_APP_URL`. |

**Rate limiting:** Default is in-memory (MemoryStore). At ~100 businesses you can run a single instance with this; it’s a known limitation. For multiple instances or higher scale, set `RATE_LIMIT_STORE=redis` (recommended; use with `REDIS_URL`) or implement a Supabase table-backed store for key endpoints (TODO in code).

## Mobile (Expo)

Use in the app:

- `EXPO_PUBLIC_SUPABASE_URL` – same as `SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` – anon key (not service role)
- `EXPO_PUBLIC_API_BASE_URL` – e.g. `http://localhost:4000` (API base; paths use `/api` or `/api/v1`)

Auth: sign in with Supabase Auth on the client and send the session access token as `Authorization: Bearer <token>` to the API.
