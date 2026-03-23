# Meta App Review Checklist – Facebook + Instagram Connect (Step 4)

Use this checklist to set up your Meta app and submit for permissions review so your app can connect Facebook Pages and Instagram Business accounts.

---

## 1. Meta app setup (step-by-step)

### 1.1 Create the app
1. Go to [Meta for Developers](https://developers.facebook.com/) → **My Apps** → **Create App**.
2. Choose **Other** → **Consumer** (or **Business** if you need Business Suite). Name the app (e.g. “PostSnap”) and create.

### 1.2 Add products
1. In the app dashboard, go to **App settings** → **Basic**. Note **App ID** and **App Secret** (use for `META_APP_ID` and `META_APP_SECRET`).
2. In the left sidebar, click **Add Products**.
3. Add **Facebook Login** (for OAuth).
4. Add **Instagram** (for Instagram Graph API / Business account).
5. Add **Pages** if you need Page API (we use Page token for posting).

### 1.3 Configure Facebook Login
1. **Facebook Login** → **Settings**.
2. **Valid OAuth Redirect URIs**: add your backend callback URL, e.g.  
   `https://api.yourdomain.com/api/v1/social/meta/callback`  
   For local dev: `http://localhost:4000/api/v1/social/meta/callback` (and add localhost to App Domains if required).
3. Save.

### 1.4 App Domains
1. **App settings** → **Basic** → **App Domains**: add your API domain (e.g. `api.yourdomain.com`) and your app/site domain (e.g. `yourapp.com`).
2. **Privacy Policy URL** and **Terms of Service URL**: required for going Live; add your URLs.

### 1.5 Put app in Live mode (when ready for review)
1. Top of the dashboard: switch from **Development** to **Live**.
2. You can only request certain permissions in Live mode; for development you can use test users and Development mode.

---

## 2. Required test account setup

- **Instagram**: Must be an **Instagram Professional** (Creator or Business) account, not a personal account.
- **Facebook Page**: Create a Facebook Page and **link** the Instagram Professional account to this Page (Instagram Settings → Account → Linked accounts → Facebook Page).
- **Test user**: Add test users in Meta app **Roles** → **Test Users** (or use your own account that has a Page + linked IG Professional account).

---

## 3. How to record the screencast (for App Review)

Meta expects a short video showing the permission in use.

1. **Prepare**
   - Backend running with Meta env vars set (`META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`, `PUBLIC_APP_URL`).
   - Mobile app or web app open on the “Connect social” / “Connect Instagram” screen.

2. **Record**
   - Show the **Connect** (or “Connect Instagram” / “Connect Facebook”) button.
   - Tap/click it → browser (or in-app webview) opens Meta OAuth.
   - Log in with the test account that has a Page + linked IG Professional account.
   - Grant the requested permissions.
   - After redirect, show the app again with **connected** status (e.g. “Instagram connected”, “Facebook connected”) and, if your UI shows it, the page name or IG username.
   - Do **not** show or say any access tokens or secrets.

3. **Export**
   - Save as MP4 or a link (e.g. Loom, Google Drive with “anyone with link can view”). You will paste this link in App Review.

---

## 4. Submit review immediately (steps)

1. In the Meta app dashboard, go to **App Review** → **Permissions and Features**.
2. Request the permissions your app uses, for example:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `instagram_basic`
   - `instagram_content_publish`
3. For each permission, complete the requested fields:
   - **Use case**: e.g. “We use this to let the user connect their Facebook Page and Instagram Business account so they can publish posts from our app.”
   - **Screencast**: paste the link to the video from section 3.
   - **Test credentials**: provide a test user login (and password, if Meta asks) that has a Page + linked IG Professional account.
4. Submit for review. Meta may take a few days and may ask for more details or a new screencast.

---

## 5. Common rejection reasons and how to avoid them

| Reason | How to avoid |
|--------|-----------------------------|
| Instagram not Professional / not linked to Page | Use an IG **Professional** account linked to a **Facebook Page**. Show this in the screencast (e.g. connect with that account and show success). |
| Permission use case unclear | In App Review, describe exactly how you use each permission (e.g. “We use `instagram_content_publish` to publish the image and caption the user created in our app to their connected Instagram account.”). |
| No screencast or broken link | Upload a short, working video; test the link in an incognito window before submitting. |
| Redirect URI mismatch | Ensure `META_REDIRECT_URI` in your backend exactly matches one of the **Valid OAuth Redirect URIs** in Facebook Login settings (including `http` vs `https`, port, path). |
| App in Development with no test instructions | Either switch to Live and submit, or provide clear test user steps and ensure the screencast uses a test account that has Page + IG linked. |

---

## 6. Env vars to set (recap)

Set these in your backend (e.g. `apps/api/.env`) and never in the mobile app:

- `META_APP_ID` – from App settings → Basic.
- `META_APP_SECRET` – from App settings → Basic.
- `META_REDIRECT_URI` – your callback URL (e.g. `https://api.yourdomain.com/api/v1/social/meta/callback`).
- `META_OAUTH_SCOPES` – comma-separated (defaults include `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`).
- `META_GRAPH_VERSION` – e.g. `v20.0`.
- `PUBLIC_APP_URL` – where to redirect after OAuth (e.g. `https://yourapp.com` or your deep link scheme).
- `TOKEN_ENCRYPTION_KEY` – 32-byte key (e.g. `openssl rand -base64 32`). Required in production.

In **production**, the API will fail to start if `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, or `TOKEN_ENCRYPTION_KEY` are missing.

---

## 7. Exact env vars list

```env
# Meta OAuth (required in production)
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_REDIRECT_URI=https://api.yourdomain.com/api/v1/social/meta/callback
META_OAUTH_SCOPES=pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish
META_GRAPH_VERSION=v20.0
PUBLIC_APP_URL=https://yourapp.com
TOKEN_ENCRYPTION_KEY=your_32_byte_base64_key
```

Generate a key: `openssl rand -base64 32`

---

## 8. Example URLs (local dev)

- **Login URL** (from API):  
  `GET /api/v1/social/meta/login-url?platform=instagram`  
  Returns `{ "url": "https://www.facebook.com/v20.0/dialog/oauth?client_id=...&redirect_uri=...&state=...&scope=...&response_type=code" }`.  
  Open `url` in the browser to start OAuth.

- **Callback** (Meta redirects here):  
  `https://api.yourdomain.com/api/v1/social/meta/callback`  
  Local: `http://localhost:4000/api/v1/social/meta/callback`  
  Must be added to **Valid OAuth Redirect URIs** in Facebook Login settings.

- **Connections** (after OAuth, app calls this to refresh status):  
  `GET /api/v1/social/connections`  
  Returns `{ facebook: { status, pageName, pageId, expiresAt }, instagram: { status, username, igBusinessId, expiresAt } }`. No tokens.

---

## 9. Steps to test locally and record screencast

1. **Run migration**  
   In Supabase SQL Editor, run `supabase/migrations/004_social_connections_meta.sql` (or the Step 4 block in `RUN_IN_SUPABASE.sql`).

2. **Set env** (e.g. `apps/api/.env`):  
   `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` (e.g. `http://localhost:4000/api/v1/social/meta/callback`), `PUBLIC_APP_URL` (e.g. `http://localhost:19006` or your app deep link), `TOKEN_ENCRYPTION_KEY` (e.g. output of `openssl rand -base64 32`).

3. **Add callback in Meta app**  
   Facebook Login → Valid OAuth Redirect URIs → add `http://localhost:4000/api/v1/social/meta/callback`.

4. **Start API**  
   `npm run dev` (from `apps/api`).

5. **Get login URL**  
   With a valid Supabase Auth JWT:  
   `curl -H "Authorization: Bearer YOUR_JWT" "http://localhost:4000/api/v1/social/meta/login-url?platform=instagram"`  
   Copy the `url` from the response.

6. **Open in browser**  
   Paste the URL → log in with a test user that has a Facebook Page and a linked Instagram Professional account → grant permissions.

7. **Redirect**  
   You are redirected to `PUBLIC_APP_URL/oauth/success?platform=instagram` (or error URL with `?reason=...`).

8. **Refresh connections**  
   `GET /api/v1/social/connections` with the same JWT → you should see `facebook` and `instagram` with `status: "connected"`, and page name / IG username.

9. **Record**  
   Record the flow (Connect → browser OAuth → success → app shows connected). Use that video as the screencast link in App Review.
