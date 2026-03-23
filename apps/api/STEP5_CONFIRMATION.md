# Step 5 – Real Publishing Confirmation

This document confirms that **real** Meta Graph API publishing is implemented (Facebook Page photo + Instagram feed) and how to verify it.

---

## 1. Provider path and endpoints

**File:** `apps/api/src/providers/posting/metaPostingProvider.ts`

**Base URL:** `https://graph.facebook.com/{META_GRAPH_VERSION}/`  
(Version from config: `config.metaGraphVersion`, default `v20.0`.)

### Facebook Page photo post

- **Method:** `postToFacebookPage(input)`
- **Endpoint:** `POST /{page_id}/photos`
- **Full URL:** `https://graph.facebook.com/v20.0/{page_id}/photos`
- **Body (form-urlencoded):**
  - `access_token` – Page access token (decrypted server-side)
  - `url` – Publicly accessible image URL (e.g. signed Supabase URL, not stored in DB)
  - `message` – Caption (capped 2000 chars)
  - `published` – `"true"`
- **Response:** `{ id: "<photo_id>" }` → returned as `platformPostId`

### Instagram image feed post

- **Method:** `postToInstagram(input)`
- **Step 1 – Create container:** `POST /{ig_business_id}/media`
  - Body: `access_token`, `image_url`, `caption`
  - Response: `{ id: "<creation_id>" }`
- **Step 2 – Publish:** `POST /{ig_business_id}/media_publish`
  - Body: `access_token`, `creation_id`
  - Response: `{ id: "<ig_media_id>" }` → returned as `platformPostId`

---

## 2. Worker code path (publish job → provider)

**File:** `apps/api/src/jobs/generateQueue.ts`

1. **Entry:** `processJob(job)` – when `job.type === 'publish'` → `processPublishJob(job)`.
2. **processPublishJob:**
   - Loads post via `getPostForWorker(payload.postId)`.
   - Image path: `processed_image_path` else `original_image_path`; if none, writes failed `post_publish_results` for each requested platform and exits.
   - Generates signed read URL via `createSignedReadUrlWithTTL(imagePath, PUBLISH_SIGNED_URL_TTL_SEC)` (20 min TTL). Not stored in DB.
   - For each requested platform (skipping already published):
     - Validates connection: `getMetaConnectionOrThrow(payload.ownerUserId, platform)` (status, token expiry, meta_page_id / ig_business_id, scopes). On invalid: connection updated to expired/revoked, throws `ReconnectRequiredError`.
     - **Facebook:** `postToFacebookPage({ pageId: conn.metaPageId, pageAccessToken: conn.accessToken, message: caption, imageUrlOrPath: imageUrl })`.
     - **Instagram:** `postToInstagram({ igBusinessId: conn.igBusinessId, pageAccessToken: conn.accessToken, caption, imageUrlOrPath: imageUrl })`.
   - Writes `post_publish_results` per platform (`platform_post_id`, `status`, `error_message`, `published_at`).
   - Updates `post.status` to `published` | `partial_failed` | `failed`.
   - Retry: only when at least one failure was **transient** (see error classification below).

---

## 3. Error classification (retries)

**File:** `apps/api/src/providers/posting/metaPostingProvider.ts`  
**Function:** `isTransientPublishError(status?, body?)`

- **Transient (retry):**
  - `status === undefined` (e.g. network timeout)
  - `status === 429` (rate limit)
  - `status >= 500 && status < 600` (server error)
- **Permanent (no retry):**
  - Meta error `code === 190` (access token expired/revoked)
  - Meta error `code === 10` (permission denied)
  - Any HTTP 4xx (400, 403, etc.)

The provider attaches `transient` and `data` to thrown errors; the worker uses `err?.transient` and `isTransientPublishError(err?.status, err?.data)` and only retries when at least one failed platform had `transient === true`. Max 3 attempts with exponential backoff.

---

## 4. What to check in Supabase

| Table | What to check |
|-------|----------------|
| **post_publish_results** | Per (post_id, platform): `platform_post_id` (non-null when success), `status` (`published` / `failed`), `error_message`, `published_at`. |
| **jobs** | `type = 'publish'`: `status` (`pending` → `processing` → `done`), `attempts`, `last_error`, `payload` (postId, platforms, idempotencyKey). |
| **posts** | `status` after publish: `published`, `partial_failed`, or `failed`; `publish_targets` array. |

---

## 5. Proving real posts exist

After a successful publish:

- **Facebook:** Use `platform_post_id` from `post_publish_results` (photo id). Page post URL pattern: `https://www.facebook.com/{page_id}/posts/{post_id}` or open the Page and find the post by time.
- **Instagram:** Use `platform_post_id` (IG media id). You can confirm in Meta Business Suite or Instagram app; direct link format varies by Meta’s current URL scheme (e.g. Business Suite → Content → Instagram feed).

See **STEP5_VERIFICATION.md** for full manual verification steps, including how to confirm real posts via these IDs.
