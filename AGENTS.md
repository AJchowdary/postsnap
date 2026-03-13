# AGENTS.md

## Cursor Cloud specific instructions

### Overview

PostSnap (aka Quickpost) is a full-stack social media management app for local businesses. The monorepo contains:

| Directory | Description | Port |
|---|---|---|
| `apps/api` | Node.js Express TypeScript API | 4000 |
| `frontend` | React Native / Expo mobile + web app | 8081 |
| `packages/shared` | Shared Zod schemas/types | — |
| `backend` | Python FastAPI dev-only proxy (optional) | 8001 |

### Running services

- **Start everything**: `npm run dev` from repo root (API + frontend via concurrently)
- **API only**: `npm run dev:api` from root
- **Frontend web only**: `npm run dev:web` from root
- **With worker**: `npm run dev:full` from root

### Key commands

| Task | Command | Directory |
|---|---|---|
| API tests | `npm test` | `apps/api` |
| API typecheck | `npx tsc --noEmit` | `apps/api` |
| API build | `npm run build` | `apps/api` |
| Frontend lint | `npx expo lint` | `frontend` |
| Frontend web | `npx expo start --web` | `frontend` |

### Environment variables

The API requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `apps/api/.env`. Without a real Supabase instance, auth/DB operations will fail but the server starts and responds on `/api/health` and `/api/`. See `apps/api/ENV_SETUP.md` for full variable documentation.

The jest test suite (`apps/api`) stubs Supabase env vars automatically via `jest.setup.ts`, so tests run without a `.env` file.

### Gotchas

- The frontend `package.json` declares `packageManager: yarn@1.22.22` but has a `package-lock.json`; use `npm install` (not yarn) to match the lockfile.
- The Expo web frontend serves on port **8081** (Metro Bundler default), not 19006 as some docs suggest. The app auto-redirects from `/` to `/welcome`.
- `AI_PROVIDER` defaults to `mock` in development — no OpenAI key needed for the API to start.
- The `punycode` deprecation warning on API startup is a Node.js v22 cosmetic warning and can be ignored.
- TypeScript peer dependency warnings during `npm install` in the frontend are harmless (eslint-config-expo vs TS 5.9).
