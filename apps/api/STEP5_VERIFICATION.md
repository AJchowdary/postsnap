# Step 5 – Real Publishing (IG + FB) + Idempotency Verification

Use this doc to manually verify real Meta publishing, async job flow, idempotency, and connection validation.

## Prerequisites

- API running: `npm run dev`
- Worker running: `npm run worker`
- Supabase configured (`.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY`)
- Meta OAuth (Step 4) configured: `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`
- **Meta connection shows connected** for both Facebook and Instagram:
  - `GET /api/v1/social/connections` returns `facebook.status: "connected"` and `instagram.status: "connected"`
  - For expired/revoked connections, response includes `reconnectRequired: true` so the UI can show “Reconnect required”
- A **post exists** with:
  - `caption_json` populated (e.g. after generation)
  - An image in storage (`processed_image_path` or `original_image_path`)

---

## 1. Publish with Idempotency-Key and both platforms (expect 202)

1. Call **publish** with both platforms and an idempotency key:
   ```http
   POST /api/v1/posts/:postId/publish
   Authorization: Bearer <user_jwt>
   Idempotency-Key: step5-test-<uuid-or-unique-string>
   Content-Type: application/json

   { "platforms": ["facebook", "instagram"] }
   ```
2. **Expect:** **202 Accepted** and body:
   ```json
   { "jobId": "<uuid>", "status": "accepted" }
   ```
3. Post status should move to `publishing` (you can confirm with `GET /api/v1/posts/:postId`).

**PASS criteria:** Response is 202 with `jobId` and `status: "accepted"`; post status becomes `publishing`.

---

## 2. Poll GET /posts/:id until final status

1. Poll **GET /api/v1/posts/:postId** (with same auth) until `status` is no longer `publishing`.
2. **Expect:** Status transitions to one of:
   - `published` – all requested platforms succeeded
   - `partial_failed` – some succeeded, some failed
   - `failed` – all failed

**PASS criteria:** Status moves from `publishing` to `published` / `partial_failed` / `failed`; no infinite “publishing” state.

---

## 3. Idempotency: retry with same Idempotency-Key

1. Call **publish** again with the **same** `Idempotency-Key` and same `platforms` as in step 1.
2. **Expect:** **200 OK** with existing result (e.g. `success: true`, `postedTo: ["facebook", "instagram"]`, `message: "Already published (idempotent)"`), and **no** new job enqueued.
3. In the database, **post_publish_results** for this post should still have only one row per platform (no duplicate rows for the same platform from the retry).

**PASS criteria:** Second request returns 200 with “Already published” semantics; no duplicate `post_publish_results` rows.

---

## 4. Duplicate job prevention (no Idempotency-Key)

1. For a **different** post (or a post that has not been published yet), call publish **without** `Idempotency-Key` and get 202 + `jobId`.
2. Before the worker finishes, call publish again for the **same** post (no idempotency key).
3. **Expect:** Second request returns **202** with the **same** `jobId` (or the existing in-progress job), and no second publish job is enqueued.

**PASS criteria:** Only one publish job per post in pending/processing at a time; duplicate request returns 202 with existing job.

---

## 5. Failure simulation: reconnect required

1. **Disconnect or revoke** the Meta token (e.g. revoke in Meta Developer Console, or set connection status to `revoked`/`expired` in DB for testing).
2. Call **POST /api/v1/posts/:postId/publish** (with valid post and platforms).
3. **Expect:** Publish fails with a **403** and error code **`RECONNECT_REQUIRED`** (or the worker marks the connection expired/revoked and the result for that platform is failed with a “Reconnect required” message).
4. **GET /api/v1/social/connections** should show the affected platform with `reconnectRequired: true` when status is `expired` or `revoked`.

**PASS criteria:** No retries for permission/revoked errors; user sees “Reconnect required” and connections endpoint exposes `reconnectRequired`.

---

## 6. Where to check (DB)

- **post_publish_results**
  - One row per (post_id, platform) per publish attempt.
  - Columns: `post_id`, `platform`, `platform_post_id`, `status` (`published` | `failed`), `error_message`, `published_at`, `created_at`.
  - Idempotency: same Idempotency-Key should not create duplicate rows for the same platform with status `published`.
- **jobs**
  - Rows with `type = 'publish'` for publish jobs.
  - Check `status` (`pending` → `processing` → `done` or `error`), `attempts`, `last_error`, `payload` (postId, platforms, idempotencyKey).

---

## 6b. Confirming real posts exist (platform_post_id)

After a successful publish, confirm posts actually appear on the platforms:

1. **post_publish_results:** For each platform with `status = 'published'`, note `platform_post_id`.
2. **Facebook:** The `platform_post_id` is the photo id. In Meta Business Suite or the Page’s feed, find the post by time/caption. Page post URLs follow the form `https://www.facebook.com/{page_id}/posts/{post_id}` (exact format may vary).
3. **Instagram:** The `platform_post_id` is the IG media id. In Meta Business Suite (Content → Instagram) or the Instagram app, confirm the feed post appears with the same image and caption.
4. **STEP5_CONFIRMATION.md** lists the exact Graph API endpoints used and the worker code path that calls them.

---

## 7. Safety checks

- **No tokens in logs** – Ensure logger redacts `token`, `access_token`, etc. (already in place via `utils/logger`).
- **No signed URLs stored** – Publish uses a short-lived signed URL for Meta to fetch the image; it must not be written to the posts table or any persistent store.
- **Caption length** – Caption sent to Meta is capped at 2,000 characters.

---

## Notes

- If Meta OAuth is not fully verified in your environment, publish calls may fail at runtime; the implementation should still behave correctly (202 → job → failed result with clear error, reconnect required when appropriate).
- Single-image **feed** posts only (Facebook Page photo post, Instagram image feed via container → publish). Reels, carousels, and stories are out of scope.
