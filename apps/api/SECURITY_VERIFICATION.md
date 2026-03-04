# Security verification — Step 2 baseline

Manual tests to confirm JWT verification, ownership enforcement, CORS, rate limits, and log redaction.

**Prerequisites:** API running (`npm run dev`), Supabase project with schema applied, two test users (User A and User B) created via your app or Supabase Auth.

---

## Routes and middleware (reference)

| Route / group | Middleware | Notes |
|---------------|------------|--------|
| GET/POST `/auth/*` | authRateLimiter (5/min per IP), authenticate | JWT required for /me |
| POST `/account/bootstrap`, GET `/account/me`, PUT `/account/profile` | authenticate | Account scoped by req.userId |
| All `/posts/*` | authenticate, postsRateLimiter (60/min per userId) | Ownership via requireAccountForUser |
| POST `/generate/caption`, POST `/generate/image` | authenticate | No optionalAuth; JWT required |
| All `/social/*` | authenticate | Scoped by req.userId |
| All `/subscription/*` | authenticate, subscriptionRateLimiter (10/min per userId) | Authenticate before limiter |
| GET `/templates/*` | authenticate | Catalog read requires JWT |
| GET `/api/health`, GET `/api/` | none | Public health only |

All protected routes verify Supabase JWT via `Authorization: Bearer <token>`. Account and post access use `requireAccountForUser(req.userId)`; client-supplied `account_id` is never trusted.

---

## Dev-only: npm verification scripts

From `apps/api` you can run ownership and rate-limit checks without manual curl. **Do not commit secrets;** set env vars in your shell only.

### Env vars required

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL (e.g. `https://xxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | Supabase anon/public key (not service_role) |
| `USER_A_EMAIL` | User A email (must exist in Supabase Auth) |
| `USER_A_PASSWORD` | User A password |
| `USER_B_EMAIL` | User B email |
| `USER_B_PASSWORD` | User B password |
| `API_BASE_URL` | Optional; default `http://localhost:4000` |

### Set env vars (PowerShell)

```powershell
cd apps/api
$env:USER_A_EMAIL = "a@test.com"
$env:USER_A_PASSWORD = "Password123!"
$env:USER_B_EMAIL = "b@test.com"
$env:USER_B_PASSWORD = "Password123!"
$env:SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_ANON_KEY = "YOUR_ANON_KEY"
# optional if API is on another host/port:
# $env:API_BASE_URL = "http://localhost:4000"
```

### Set env vars (CMD)

```cmd
cd apps\api
set USER_A_EMAIL=a@test.com
set USER_A_PASSWORD=Password123!
set USER_B_EMAIL=b@test.com
set USER_B_PASSWORD=Password123!
set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
set SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

### npm scripts

| Script | Description |
|--------|-------------|
| `npm run token:a` | Print access token for User A (uses `USER_A_EMAIL`, `USER_A_PASSWORD`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`) |
| `npm run token:b` | Print access token for User B |
| `npm run verify:ownership` | Log in as A and B, create one post as A, GET that post as B; **PASS** if status 403/404 (B blocked), **FAIL** otherwise. Exit code 0 on PASS, 1 on FAIL. |
| `npm run verify:ratelimit` | Call `/api/v1/auth/me` 6 times with User A token; **PASS** if any response is 429. Exit code 0 on PASS, 1 on FAIL. |

### Example: run ownership verification

1. Start the API in another terminal: `cd apps/api && npm run dev`.
2. Ensure User A and User B exist in Supabase Auth (sign up once in the app or create in Dashboard).
3. Set env vars (PowerShell or CMD) as above.
4. Run:

```powershell
cd apps/api
npm run verify:ownership
```

**Expected output:** `PASS: B blocked (403/404)` and exit code 0.

### Example: run rate-limit verification

1. API running; set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `USER_A_EMAIL`, `USER_A_PASSWORD` (and optionally `API_BASE_URL`).
2. Run:

```powershell
npm run verify:ratelimit
```

**Expected output:** `PASS: 429 received` (after 6 requests within the auth rate-limit window). Exit code 0. If the limit window was recently reset, you may see `FAIL: no 429 after 6 requests`; wait ~1 minute and run again.

---

## 1. Create two Supabase Auth users

- **User A:** Sign up in the app (e.g. `user-a@example.com`) or create via Supabase Dashboard → Authentication → Add user.
- **User B:** Sign up with a different email (e.g. `user-b@example.com`).
- Note or obtain a valid JWT for each (e.g. sign in via app and copy `session.access_token` from Supabase client, or use Supabase Auth REST API to sign in and get `access_token`).

**Get tokens (example with Supabase REST):**

```bash
# User A token (replace SUPABASE_URL and credentials)
curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"user-a@example.com","password":"YourPassword"}' | jq -r '.access_token'

# User B token
curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"user-b@example.com","password":"YourPassword"}' | jq -r '.access_token'
```

Set in shell: `TOKEN_A="<paste>"`, `TOKEN_B="<paste>"`, `API_BASE="http://localhost:4000/api/v1"`.

---

## 2. Bootstrap accounts (if needed)

Each user needs an account. Call bootstrap once per user (idempotent).

```bash
curl -s -X POST "$API_BASE/account/bootstrap" -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" | jq .
curl -s -X POST "$API_BASE/account/bootstrap" -H "Authorization: Bearer $TOKEN_B" -H "Content-Type: application/json" | jq .
```

**Expected:** `200 OK`, JSON with account/profile data.

---

## 3. User A creates one post

```bash
curl -s -X POST "$API_BASE/posts" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"template_id":"auto","context_text":"Post by User A","platforms":[]}' | jq .
```

**Expected:** `201 Created`, JSON with `post.id` and `uploadUrl`. **Note the post ID** (e.g. `POST_ID_A`).

```bash
export POST_ID_A="<post-id-from-response>"
```

---

## 4. User B must not access User A’s post

All of the following must **fail** with **404** or **403** (never 200 with User A’s data).

**4a) GET User A’s post as User B**

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X GET "$API_BASE/posts/$POST_ID_A" -H "Authorization: Bearer $TOKEN_B"
```

**Expected:** `404` (Post not found / resource not found). Body must not contain User A’s post data.

**4b) DELETE User A’s post as User B**

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X DELETE "$API_BASE/posts/$POST_ID_A" -H "Authorization: Bearer $TOKEN_B"
```

**Expected:** `404` (or `403`). Post must not be deleted.

**4c) POST generate on User A’s post as User B**

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$API_BASE/posts/$POST_ID_A/generate" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:** `404` (or `403`). No job must be enqueued for User B acting on A’s post.

**4d) POST publish on User A’s post as User B**

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$API_BASE/posts/$POST_ID_A/publish" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H "Content-Type: application/json" \
  -d '{"platforms":["instagram"]}'
```

**Expected:** `404` (or `403`). Publish must not succeed for User B on A’s post.

---

## 5. User A can access own post

```bash
curl -s -X GET "$API_BASE/posts/$POST_ID_A" -H "Authorization: Bearer $TOKEN_A" | jq .
```

**Expected:** `200 OK`, JSON with the post (same `id` as `POST_ID_A`).

---

## 6. Confirm in Supabase that posts belong to correct account

- **Supabase Dashboard → Table Editor → `posts`**
- Find the row with `id = POST_ID_A`.
- **Check:** `account_id` must match User A’s account (from `accounts` where `owner_user_id` = User A’s auth uid).
- **Check:** There must be no post with that same `id` and a different `account_id` (ownership is enforced by app, not by a second row).

---

## 7. Unauthenticated requests to protected routes

```bash
# No token
curl -s -o /dev/null -w "%{http_code}" -X GET "$API_BASE/posts"
# Invalid token
curl -s -o /dev/null -w "%{http_code}" -X GET "$API_BASE/posts" -H "Authorization: Bearer invalid"
```

**Expected:** `401` for both (no token / invalid token).

---

## 8. Rate limiting (auth)

Hit auth/me more than 5 times in one minute from same IP:

```bash
for i in {1..6}; do curl -s -o /dev/null -w "%{http_code}\n" -X GET "$API_BASE/auth/me" -H "Authorization: Bearer $TOKEN_A"; done
```

**Expected:** First 5 return `200`, 6th returns `429` with message like "Too many auth attempts". Response should include `Retry-After` header (e.g. 60).

---

## 9. CORS (production)

In production, ensure `CORS_ALLOWLIST` is set (comma-separated origins). If it is empty, the API must **fail to start** with an error like: `CORS_ALLOWLIST must be set in production`. No wildcard `*` is used.

---

## 10. Logs never contain secrets

- Trigger a request that logs an error or meta (e.g. invalid body, or a 429).
- **Check:** Server logs must never contain raw `Authorization`, `access_token`, `refresh_token`, `api_key`, `password`, or `SUPABASE_SERVICE_ROLE_KEY` / `OPENAI_API_KEY`. Redacted values may appear as `[REDACTED]`.

---

## Summary: expected status codes

| Action | Expected |
|--------|----------|
| User B GET /posts/:id (A’s post) | 404 |
| User B DELETE /posts/:id (A’s post) | 404 or 403 |
| User B POST .../generate (A’s post) | 404 or 403 |
| User B POST .../publish (A’s post) | 404 or 403 |
| User A GET /posts/:id (own post) | 200 |
| No token on protected route | 401 |
| Invalid token on protected route | 401 |
| Rate limit exceeded (auth) | 429 + Retry-After |
