# HomeLink Ethiopia — Team Handoff

Full-stack rental platform: **Next.js 14 frontend** + **Express/Mongoose backend** (runs in mock-DB mode without MongoDB) + optional Python AI microservice.

## Run it (Windows)

```bash
# 1. Frontend deps
npm install

# 2. Backend deps
cd backend
npm install
cd ..

# 3. Start backend  (terminal 1) — http://localhost:5000
set PORT=5000 && node backend/server.js

# 4. Start frontend (terminal 2) — http://localhost:3000
npm run dev
```

No MongoDB needed — the backend auto-falls back to an in-memory mock DB and prints `⚡ [MOCK DB ACTIVATED]`.

## Demo logins (password for all: `Password123!`)

| Role | Email |
|---|---|
| Tenant | dev.tenant@homelink.test |
| Landlord | dev.landlord@homelink.test |
| Admin | dev.admin@homelink.test |

## Notes for teammates

- `.env.local` is included (`NEXT_PUBLIC_MOCK_MODE=false`, API on :5000). Real emails are NOT configured — verification/reset codes are returned in the API response and shown on screen by design (dev convenience).
- Registered accounts persist to `backend/mock-users.json` so they survive backend restarts. It's git-ignored demo data — delete it to reset.
- Property photos live in `public/homes/` (frontend cards) and `backend/uploads/homes/` (API-served listing images).
- `lib/images.ts` is the single source of photo pools (property cards, interiors, city photos).
- Typecheck: `npx tsc --noEmit`
- `backend-backup-kidist/` is an old backup — safe to ignore/delete.
