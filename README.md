# PostSnap

## Development

- From repo root: `npm run dev` (starts API + frontend). See `apps/api` and `frontend` for env setup.
- **If port 4000 is in use**, set `PORT=4001` in `apps/api/.env` and update `frontend/.env` so `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_BACKEND_URL` point to `http://localhost:4001`.
