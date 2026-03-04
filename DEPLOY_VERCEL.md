# Deploy frontend on Vercel

The Expo/React Native frontend can be deployed as a **web** build on Vercel. Mobile builds (EAS) are separate; this doc covers the Vercel web deployment and env vars used by the app.

---

## 1. Import repo

1. Go to [Vercel](https://vercel.com) → Add New → Project.
2. Import your Git repository (GitHub/GitLab).
3. **Root Directory:** Set to **`frontend`** (not the repo root).
4. Framework Preset: **Expo** (or Other; Vercel often auto-detects Expo).

---

## 2. Build and output

- **Build Command:** Leave default (e.g. `npm run build` or `npx expo export -p web` if you use Expo web export). If your `frontend/package.json` has no `build` script, add one, e.g. `expo export -p web`.
- **Output Directory:** Often `dist` or `.expo/web` depending on Expo version; check Expo docs or use default suggested by Vercel.
- **Install Command:** `npm install` or `yarn` (match your lockfile).

---

## 3. Environment variables

Set in Vercel → Project → Settings → Environment Variables. These are exposed to the client as `EXPO_PUBLIC_*` (or your app’s public env).

| Variable | Required | Notes |
|----------|----------|--------|
| `EXPO_PUBLIC_API_BASE_URL` | Yes | Your Render API URL, e.g. `https://postsnap-api.onrender.com` |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `EXPO_PUBLIC_IOS_SUBSCRIPTION_PRODUCT_ID` | Optional | iOS IAP product ID |
| `EXPO_PUBLIC_ANDROID_SUBSCRIPTION_PRODUCT_ID` | Optional | Android IAP product ID |

**CORS:** Add your Vercel deployment URL to the **API’s** `CORS_ALLOWLIST` on Render. Example:

- `https://your-project.vercel.app`
- If you use a custom domain: `https://your-custom-domain.com`

So in Render (API service) set:

`CORS_ALLOWLIST=https://your-project.vercel.app,https://your-custom-domain.com`

---

## 4. Deploy

Click Deploy. After deploy, note the Vercel URL (e.g. `https://your-project.vercel.app`).

---

## 5. Connect API and frontend

1. **API (Render):** Set `PUBLIC_APP_URL` to your Vercel URL (e.g. `https://your-project.vercel.app`) so OAuth redirects go to the right place.
2. **API (Render):** Set `META_REDIRECT_URI` to your Render API callback (e.g. `https://postsnap-api.onrender.com/api/v1/social/meta/callback`).
3. **Frontend (Vercel):** Set `EXPO_PUBLIC_API_BASE_URL` to your Render API URL (no trailing slash).

---

## Exact Vercel settings summary

- **Root Directory:** `frontend`
- **Build Command:** default or `npx expo export -p web` (if applicable)
- **Output:** per Expo web output (e.g. `dist` or `.expo/web`)
- **Env vars:**  
  `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,  
  `EXPO_PUBLIC_IOS_SUBSCRIPTION_PRODUCT_ID`, `EXPO_PUBLIC_ANDROID_SUBSCRIPTION_PRODUCT_ID`

Ensure the API’s CORS allowlist includes this Vercel domain (and any custom domain).
