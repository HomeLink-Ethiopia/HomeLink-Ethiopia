# HomeLink Ethiopia — Team Handoff

Full-stack rental platform organized into clean, dedicated folders:
- **`frontend/`**: Next.js 14 App Router UI (Tenant, Landlord, Admin portals)
- **`backend/`**: Express / Mongoose REST API (in-memory mock DB fallback, offline-ready)
- **`ai-service/`**: Python FastAPI microservice (matching & rent estimation)
- **`backups/`**: Teammates' historical backup snapshots
- **`docs/`**: Architecture & API documentation

## Run it (Windows)

```bash
# 1. Frontend deps & start — http://localhost:3000
cd frontend
npm install
npm run dev

# 2. Backend deps & start (separate terminal) — http://localhost:5000
cd backend
npm install
set PORT=5000 && node server.js
```

Or from the root directory:
```bash
npm run dev          # starts the frontend
npm run dev:backend  # starts the backend
```

No MongoDB needed — the backend auto-falls back to an in-memory mock DB and prints `⚡ [MOCK DB ACTIVATED]`.

## Demo logins (password for all: `Password123!`)

| Role | Email |
|---|---|
| Tenant | dev.tenant@homelink.test |
| Landlord | dev.landlord@homelink.test |
| Admin | dev.admin@homelink.test |

## Notes for teammates

- `frontend/.env.local` is included (`NEXT_PUBLIC_MOCK_MODE=false`, API on :5000).
- Registered accounts persist to `backend/mock-users.json` so they survive backend restarts.
- Property photos live in `frontend/public/homes/` and `backend/uploads/homes/`.
- Typecheck frontend: `cd frontend && npx tsc --noEmit`

