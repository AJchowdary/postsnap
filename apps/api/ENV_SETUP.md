# Environment setup

Copy `.env.example` to `.env` and set values. This doc explains **required vs optional** and **local dev** usage.

## Required (all environments)

| Variable | Description |
|--------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key. Server only; never expose to mobile. |

## Required in production only (Step 4 – Meta OAuth)

When `NODE_ENV=production`, the API will **fail startup** if these are missing:

| Variable | Description |
|--------|-------------|
| `META_APP_ID` | Meta app ID (from Meta for Developers → App settings → Basic) |
| `META_APP_SECRET` | Meta app secret. Never expose to mobile. |
| `META_REDIRECT_URI` | Must **exactly** match Meta → Facebook Login → Valid OAuth Redirect URIs |
| `TOKEN_ENCRYPTION_KEY` | At least 32 bytes, base64 or hex. Used to encrypt stored OAuth tokens. |

In **development**, these are optional; the Meta connect flow will simply be unavailable until they are set.

## Optional (with defaults)

- `PORT` – default `4000`
- `NODE_ENV` – default `development`
- `OPENAI_API_KEY` – if unset, mock AI provider is used
- `OPENAI_CAPTION_MODEL`, `OPENAI_IMAGE_MODEL_*`, etc.
- `CORS_ALLOWLIST`, `STORAGE_BUCKET`, `RATE_LIMIT_*`, `REDIS_URL`, etc.
- **Step 4:** `META_OAUTH_SCOPES`, `META_GRAPH_VERSION`, `PUBLIC_APP_URL` – defaults exist in code (see `.env.example`).

## Local dev examples

### API on port 4000

```env
PORT=4000
META_REDIRECT_URI=http://localhost:4000/api/v1/social/meta/callback
PUBLIC_APP_URL=http://localhost:19006
```

Add `http://localhost:4000/api/v1/social/meta/callback` to Meta → Facebook Login → Valid OAuth Redirect URIs.

### API on port 4001

If 4000 is in use (e.g. another service), run the API on 4001 and point the frontend at it:

```env
PORT=4001
META_REDIRECT_URI=http://localhost:4001/api/v1/social/meta/callback
PUBLIC_APP_URL=http://localhost:19006
```

Add `http://localhost:4001/api/v1/social/meta/callback` to Meta → Valid OAuth Redirect URIs. Set the app’s API base URL to `http://localhost:4001` (e.g. `EXPO_PUBLIC_API_BASE_URL`).

## Generating `TOKEN_ENCRYPTION_KEY`

Use a 32-byte key. Two options:

**Base64 (recommended):**
```bash
openssl rand -base64 32
```
Paste the output into `.env` as `TOKEN_ENCRYPTION_KEY=...`.

**Hex (64 characters):**
```bash
openssl rand -hex 32
```

Do not commit the real key; keep it in `.env` (and in your deployment secrets).
