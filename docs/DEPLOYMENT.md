# HomeLink Deployment Guide — Sprint 16

## Architecture
```
Browser ── HTTPS ──> Next.js frontend (:3000)
                          │ fetch /api
                          ▼
                    Express backend (:5000) ──> MongoDB Atlas
                          │ HTTP
                          ▼
                    AI microservice FastAPI (:8000)
```

## Option A — Docker (recommended)

```bash
# 1. Create a .env next to docker-compose.yml with real values:
cat > .env << 'EOF'
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/homelink
JWT_SECRET=<64-char random string>
RESEND_API_KEY=re_...
CHAPA_SECRET_KEY=...
NEXT_PUBLIC_API_URL=https://api.your-domain.com
EOF

# 2. Build and start everything (backend + AI + frontend):
docker compose up --build -d

# 3. Seed demo data + neighborhoods:
docker compose exec backend node scripts/seed-neighborhoods.js
docker compose exec backend node scripts/seed-demo-data.js
```

## Option B — Manual (two servers or one VM)

**Backend**
```bash
cd backend
cp .env.production.example .env   # fill real values
npm ci --omit=dev
node server.js                    # use pm2 for production:
pm2 start server.js --name homelink-api
```

**AI service**
```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000   # or: pm2 start "uvicorn app.main:app --port 8000"
```

**Frontend**
```bash
npm ci
NEXT_PUBLIC_API_URL=https://api.your-domain.com npm run build
npm start                          # or serve behind nginx/caddy
```

## Environment separation
| File | Purpose |
|---|---|
| `backend/.env` | Active local values (never commit) |
| `backend/.env.development` | Shared dev defaults |
| `backend/.env.production.example` | Production template — copy & fill |
| `.env.local` (root) | Frontend `NEXT_PUBLIC_API_URL` |

## Production checklist (Sprint 14 + 16)
- [ ] HTTPS everywhere (TLS terminates at nginx / Caddy / host proxy)
- [ ] `JWT_SECRET` is a fresh 64-char random string (never reuse dev secret)
- [ ] `CORS_ORIGIN` set to the real frontend domain (not `*`)
- [ ] MongoDB Atlas: IP allowlist + strong user password + backups enabled
- [ ] Resend domain verified (so verification emails deliver to all addresses)
- [ ] Chapa production keys
- [ ] `NODE_ENV=production`
- [ ] Database backups: Atlas continuous backup or nightly `mongodump` cron
- [ ] Logs shipped off-box (pm2 logs / Docker driver)
- [ ] Health checks wired to uptime monitor: `GET /` (backend), `GET :8000/health` (AI)

## Demo credentials (after seeding, password `Demo@1234`)
- Admin: `admin@homelink.demo`
- Landlords: `abebe@` · `hanna@` · `dawit@homelink.demo`
- Tenants: `marta@` · `yonas@` · `liya@` · `samuel@homelink.demo`
