# Step 3 – AI Generation Pipeline Verification

Use this doc to verify the generation pipeline (captions, images, overlay, async worker, cache, regen limits, storage).

## Prerequisites

- API running: `npm run dev`
- Worker running: `npm run worker`
- Supabase configured (`.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- Optional: `OPENAI_API_KEY` set for real OpenAI; if unset, mock provider is used (caching and regen limits still apply)

## 1. Create post with image → generate (202) → poll until ready

1. **Create post**  
   `POST /api/v1/posts` with body:
   ```json
   { "template_id": "auto", "context_text": "User A private post", "platforms": [] }
   ```
   - Expect: **201**, body has `post.id`, `uploadUrl` (or null if bucket missing), `uploadPath`.

2. **Upload image** (if uploadUrl present)  
   PUT the signed URL with your image bytes. Then:
   `POST /api/v1/posts/:id/upload-complete` with body `{ "path": "<path from create response>" }`.

3. **Trigger generation**  
   `POST /api/v1/posts/:id/generate` with body `{ "premium_quality": false }`.
   - Expect: **202** and `{ "jobId": "...", "status": "accepted" }`.

4. **Poll until ready**  
   `GET /api/v1/posts/:id` repeatedly until `status === "ready"`.
   - Expect: **200**, `status` is `"ready"`, and (if image was uploaded) `processedImageUrl` is a signed URL.

**PASS criteria:** Create returns 201; generate returns 202; polling returns 200 with `status: "ready"` and `processedImageUrl` when an image was uploaded.

---

## 2. Confirm caption_json structure

After a post is `ready`, call `GET /api/v1/posts/:id`.

- Response must include `captionJson` with shape:
  ```json
  {
    "instagram": { "caption": "string", "hashtags": ["#a", "#b", ...] },
    "facebook":  { "caption": "string", "hashtags": ["#x", "#y", ...] }
  }
  ```
- Instagram: **8–15** hashtags.
- Facebook: **3–8** hashtags.

**PASS criteria:** `captionJson` is present and satisfies the structure and hashtag counts above.

---

## 3. Confirm processed image path and signed URL

- In the same `GET /api/v1/posts/:id` response (post with image and generation done):
  - `processed_image_path` or `processedImage` should be set (e.g. `account/{accountId}/posts/{postId}/processed.jpg`).
  - `processedImageUrl` should be a signed HTTPS URL (generated on read; not stored in DB).

**PASS criteria:** `processed_image_path` (or legacy `processedImage`) is set; `processedImageUrl` is present and is an HTTPS URL.

---

## 4. Cache test (regen_count must NOT increment)

1. Create a post, upload image, call `POST /api/v1/posts/:id/generate` (first time). Poll until `status === "ready"` and note `regen_count` (e.g. 1) and `last_generated_hash` (or equivalent from response if exposed).

2. Call `POST /api/v1/posts/:id/generate` again **without changing** the post (same image, same context, same template, same quality).

3. Poll `GET /api/v1/posts/:id` until `status === "ready"` again.

**PASS criteria:** Second run is a cache hit: `regen_count` does **not** increase (e.g. stays 1). No extra OpenAI calls (observable in logs or mock).

---

## 5. Regen limit test (trial: second regenerate blocked)

1. Use an account in **trial** (no paid subscription): create a post, upload image, call `POST /api/v1/posts/:id/generate` once. Poll until `status === "ready"` (regen_count = 1).

2. Call `POST /api/v1/posts/:id/generate` again (second time for same post).

3. Worker should **not** call OpenAI; job should be marked failed with a clear error (e.g. “Regen limit per post exceeded”). Post may remain in `generating` or be updated depending on implementation; job `last_error` should be visible in logs or support tooling.

**PASS criteria:** Second generate for the same post does **not** result in a new OpenAI call; regen limit is enforced before OpenAI; error is clear (e.g. 429 or message like “Regen limit per post exceeded”).

---

## 6. Unit tests

Run:

```bash
cd apps/api && npm test
```

- **Hash + cache:** `generationHash` determinism and `isGenerationCacheHit` behavior are covered. Cache hit when hash matches and caption + (processed or no original) → regen_count is not incremented (worker uses `isGenerationCacheHit` and skips OpenAI).
- **Regen limits:** Config values for trial (1 per post) and paid (2 per post, 10 per day) are tested.

**PASS criteria:** All tests pass, including the new cache-hit and regen-limit tests.

---

## Summary checklist

| Step | Command / action | Expected |
|------|------------------|----------|
| 1 | Create post → upload-complete → generate → poll GET /posts/:id | 201 → 202 → 200 with status "ready", processedImageUrl set when image present |
| 2 | GET /posts/:id when ready | captionJson with instagram/facebook, IG 8–15 hashtags, FB 3–8 |
| 3 | GET /posts/:id | processed_image_path set; processedImageUrl signed HTTPS |
| 4 | Generate twice, same inputs | Second run cache hit; regen_count unchanged |
| 5 | Trial account: generate twice on same post | Second run blocked before OpenAI; clear error |
| 6 | npm test | All tests pass (hash, isGenerationCacheHit, regen limits) |

---

## Notes

- If `OPENAI_API_KEY` is not set, the mock provider is used; generation still runs and caching/regen limits apply.
- No scheduling features are added in Step 3.
- Storage: only paths are stored in the DB; signed URLs are generated on read for GET /posts and GET /posts/:id.
