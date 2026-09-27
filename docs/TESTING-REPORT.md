# HomeLink Testing Report — Sprint 15

**Suite:** `backend/tests/e2e-scenarios.js` (plain Node, zero dependencies)
**Run:** `cd backend && node tests/e2e-scenarios.js` — requires backend on :5000 + MongoDB.
**Latest result: 42 passed / 0 failed** against the live Atlas database.

## What is covered

### Scenario 1 — Landlord journey
Register (Joi-validated, Ethiopian phone format) → login → admin verification queue reachable → **Sprint 3 guard verified: unverified landlord is blocked (403) from creating a property** → verified landlord creates a property (AI fraud check runs, geo-safe) → tenant finds it via search.

### Scenario 2 — Tenant journey
Login → search returns listings → AI recommend (scores + reasons) → viewing request (requestedSlots contract) → application (duplicate-guarded) → landlord views applications → active agreement with signed signatures → rent schedule tracked per agreement.

### Scenario 3 — Fraud journey
Tenant files fraud report (category + AI risk attached) → AI risk score computed (severe underpricing + wire-transfer phrasing → HIGH) → admin fraud queue + analytics KPIs reachable.

### API surface smoke (all modules, both roles + admin)
Auth ✅ Properties ✅ Verification ✅ Viewings ✅ Applications ✅ Agreements ✅ Payments ✅ Maintenance ✅ Messages ✅ Reviews ✅ Notifications ✅ Credit score ✅ Neighborhoods ✅ Disputes ✅ Admin dashboard/users/disputes/audit-logs ✅ AI health ✅

### Security smoke (Sprint 14)
- Invalid JWT → 401/403 ✅
- Tenant calling admin API → 403 (role escalation blocked) ✅
- Login rate-limiting (per-email, failed attempts only) ✅
- Joi validation on all auth inputs (email, Ethiopian phone, strong password) ✅
- Helmet secure headers, CORS, 10MB body limit ✅
- Upload validation (type/size) ✅

## Bugs found & fixed by this suite
1. `fraudRiskScore` stored 0–100 but schema capped 0–1 → properties failed to save. Fixed with schema range + normalizer.
2. MongoDB 2dsphere rejected `coordinates:{type:"Point"}` without an array → property creation 500. Fixed with geo guard.
3. Seeded properties pointed at User ids instead of LandlordProfile ids → viewings/applications/maintenance 404. Fixed in the seed + repair step.
4. Missing `/my` aliases on maintenance/reviews and admin `/audit-logs` → frontend pages empty. Added.
5. Future (not-yet-due) invoices penalized the tenant credit score. Fixed: only due/paid invoices count.
6. Mongoose 9 `pre('validate')` hooks needed promise style (`next` removed).
7. Ghost renewal proposals from Mongoose subdoc defaults. Fixed with no-default + cleanup hook + frontend guard.

## Frontend verification
Typecheck (`tsc --noEmit`) clean. Manual browser passes on: signup→verify→login, property detail (map, images, badges), schedule viewing, message landlord, apply (login gate + duplicate detection), agreements (renewal panel), payments schedule, neighborhoods compare, landlord applications with credit badges, admin dashboards.
