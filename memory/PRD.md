# PostSnap - Product Requirements Document

## Original Problem Statement
Build a full-stack social media management app ("PostSnap") for local businesses.
- **Phase 1 (UI):** Mobile app with 4-tab navigation (Create, History, Home, Settings), 2-step post creation, drafts, history filtering, paywall modal.
- **Phase 2 (Backend):** Node.js/Express backend, async job processing for AI tasks, entitlement checks. All external services (Supabase, OpenAI, Meta, IAP) stubbed.
- **Phase 3 (Redesign):** Complete dark theme visual redesign based on user reference image.
- **Phase 4 (Schedule Post + Theme Lightening):** Lighter dark theme + full-stack schedule post feature.

## Architecture

```
/app
├── apps/api/           # Node.js/Express/TypeScript backend (port 4001)
│   └── src/
│       ├── controllers/
│       ├── jobs/
│       │   ├── generateQueue.ts     # Async AI generation job queue
│       │   └── scheduleProcessor.ts # NEW: polls every 30s, publishes due posts
│       ├── services/
│       │   └── postsService.ts      # Handles scheduledAt field
│       ├── schemas/posts.ts         # Includes scheduledAt + 'scheduled' status
│       └── index.ts                 # Starts both workers + scheduler
├── backend/            # Python proxy on port 8001 → forwards to 4001
├── frontend/           # React Native / Expo (Expo Router)
│   ├── app/(tabs)/
│   │   ├── create.tsx   # Step 1 + Step 2 with Schedule for Later button
│   │   ├── history.tsx  # All/Drafts/Scheduled/Published filters
│   │   ├── home.tsx
│   │   └── settings.tsx
│   ├── app/welcome.tsx  # Landing screen
│   ├── app/auth.tsx     # Login/Register
│   └── src/
│       ├── components/
│       │   └── SchedulePicker.tsx   # NEW: custom date-time picker modal
│       ├── constants/theme.ts       # UPDATED: lighter dark palette
│       ├── services/api.ts          # UPDATED: includes scheduledAt
│       └── types/index.ts           # UPDATED: 'scheduled' status + scheduledAt
└── packages/shared/    # Shared types
```

## What's Been Implemented

### Phase 1 – UI (Complete)
- 4-tab navigation with bottom tab bar
- 2-step post creation flow (Build → Preview)
- Draft saving, history filtering, paywall modal

### Phase 2 – Backend (Complete)
- Node.js/Express/TypeScript API on port 4001, Python proxy on 8001
- MongoDB via MongoAdapter
- Auth (JWT), Account/Business profile, Posts CRUD, Social accounts, Subscription
- Async job queue for AI generation (in-process, no Redis)
- All external providers stubbed (AI, Meta, IAP)
- SQL migration file for Supabase at `/app/apps/api/supabase/migrations/0000_init.sql`

### Phase 3 – Full Redesign (Complete)
- Welcome/landing screen with hero image + gradient buttons
- Auth screen with glassmorphic inputs
- Dark theme throughout all screens (pink/orange gradient brand)
- Toast, StatusChip, gradient tab bar

### Phase 4 – Lighter Theme + Schedule Post (Complete, Feb 26 2026)
- **Lighter theme**: background `#1c1e30`, paper `#262842`, subtle `#212338`
- **Schedule Post backend**: `scheduledAt` field in schema + postsService; `scheduleProcessor.ts` polls every 30s to auto-publish due posts
- **Schedule Post frontend**: `SchedulePicker` component (pure-JS, no native modules); "Schedule for Later" button in Create Step 2; `'scheduled'` status in types, STATUS_CONFIG, FILTERS, and normalized in API client
- **History tab**: 4 filters (All/Drafts/Scheduled/Published); scheduled posts show their `scheduledAt` time, indigo badge

## Data Models

### Post
```ts
{
  id, userId, template, photo?, description, caption,
  processedImage?, platforms[], 
  status: 'draft' | 'scheduled' | 'published' | 'failed',
  scheduledAt?: string,   // ISO string, set when scheduling
  createdAt, updatedAt, publishedAt?
}
```

## API Endpoints
- `POST /api/auth/register` / `POST /api/auth/login`
- `GET /api/account/me` / `POST /api/account/bootstrap` / `PUT /api/account/profile`
- `GET/POST /api/posts` / `GET/DELETE /api/posts/:id` / `POST /api/posts/:id/publish`
- `POST /api/generate/caption` / `POST /api/generate/image`
- `POST/DELETE /api/social/connect` / `/api/social/disconnect/:platform`
- `GET /api/subscription/status` / `POST /api/subscription/upgrade`

## Testing Status
- Backend: 100% (40/40 tests pass, including schedule feature)
- Frontend: 95% (all features pass after Metro restart; Metro runs CI=true which disables hot reload)
- Test credentials: schedtest@test.com / test1234
- Test report: `/app/test_reports/iteration_4.json`

## Prioritized Backlog

### P0 - Critical
- None currently

### P1 - High Priority
- Apply SQL migrations to real Supabase project (requires user action)
- Real credentials for Supabase (DB) and OpenAI (AI)

### P2 - Medium Priority
- Magic Link (passwordless) authentication
- Real Meta (Facebook/Instagram) posting integration
- Real In-App Purchase (IAP) integration

### P3 - Low Priority / Nice-to-Have
- Post analytics / insights screen
- Push notifications for scheduled post publishing confirmations
- Calendar view for scheduled posts in History tab
- Bulk scheduling / content calendar
