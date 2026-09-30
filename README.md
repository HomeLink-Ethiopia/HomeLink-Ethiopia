# HomeLink Ethiopia

**A trusted digital housing platform connecting tenants, landlords, and communities across Ethiopia.**

HomeLink solves Ethiopia's fragmented rental market by providing verified property listings, AI-powered matching, landlord verification, and end-to-end rental management — all in Amharic and English.

---

## Features

- **Property Discovery** — Search and filter properties across Ethiopian cities (Addis Ababa, Hawassa, Bahir Dar, Dire Dawa, Mekelle, and more)
- **AI Matching** — Personalized property recommendations based on budget, location, and preferences
- **Landlord Verification** — Document upload and admin approval workflow
- **Property Management** — Full CRUD for landlords (create, edit, delete listings)
- **Rental Applications** — Tenants apply, landlords review and approve
- **Viewing Appointments** — Schedule, confirm, reschedule, or cancel property viewings
- **Rental Agreements & Rent Tracking** — Digital agreements with confirmation workflow and payment records
- **Email Verification & Password Reset** — Secure OTP-based account flows
- **Role-Based Dashboards** — Separate experiences for tenants, landlords, and admins
- **Bilingual Interface** — Full English ⇄ Amharic translation

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Zustand |
| Backend | Node.js, Express 5, Mongoose |
| Database | MongoDB (Atlas) |
| Auth | JWT + bcrypt, rate-limited OTP email verification (Resend) |
| File uploads | Multer (property images, verification documents) |

---

## Project Structure

```
HomeLink-Ethiopia/
├── app/                    # Next.js App Router pages
│   ├── (public)/           # Home, explore, property details, auth pages
│   ├── tenant/             # Tenant dashboard (favorites, viewings, agreements…)
│   ├── landlord/           # Landlord dashboard (properties, applications…)
│   └── admin/              # Admin dashboard (verification queue, disputes…)
├── components/             # Shared UI components
├── services/               # API client layer (calls the Express backend)
├── lib/                    # Stores, contexts, and helpers
├── locales/                # English/Amharic translation files
├── middleware.ts           # Route protection
├── backend/
│   ├── server.js           # Express entry point
│   └── src/
│       ├── config/         # DB connection
│       ├── controller/     # Business logic
│       ├── middleware/     # Auth, roles, rate limiting, uploads
│       ├── models/         # Mongoose schemas (User, Property, …)
│       ├── routes/         # API route definitions
│       ├── utils/          # Email service, helpers
│       ├── validators/     # Joi validation schemas
│       └── uploads/        # Uploaded property images & documents
└── scripts/                # (in backend/) DB seed scripts
```

---

## Getting Started (Hackathon Quick Start)

We've simplified the boot process so teammates and judges can run the stack locally without friction.

### Prerequisites

- **Node.js 18+** & **npm 9+**
- **Python 3.10+** (or Conda)

### 1. Install Dependencies

Install the frontend, backend, and AI dependencies:

```bash
# 1. Next.js Frontend (Root)
npm install

# 2. Express Backend
cd backend
npm install

# 3. AI Backend
cd ../ai
pip install -r requirements.txt
```

### 2. Launch the Application

The easiest way to launch all three servers is to use the automated startup script:

> **🔥 Quick Start Automation:** If you are on Windows, simply double-click the `start-project.bat` script in the project root to automatically launch the Next.js frontend, Express backend, and FastAPI AI Engine in parallel!

If you prefer to start them manually, open three terminal windows:

```bash
# Terminal 1 - Express Backend (from /backend)
npm start

# Terminal 2 - AI Backend (from /ai)
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 3 - Next.js Frontend (from root)
npm run dev
```

---

## User Flows

**Tenant:** Register → verify email (6-digit code) → search/filter properties → save favorites → request viewing → apply → sign agreement → track rent.

**Landlord:** Register → verify email → upload identity/ownership documents → admin approval → create property listings with photos → manage viewings, applications, agreements, and rent.

**Admin:** Log in → review verification queue (identity documents, property ownership) → approve/reject with recorded reason → monitor fraud reports and disputes.

---

## API Overview

Base URL: `http://localhost:5000`

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `/login`, `/verify-email`, `/resend-email-code`, `/forgot-password`, `/reset-password` |
| Properties | `GET /api/v1/properties/search` (public), `POST /api/v1/properties` (landlord), `GET/PUT/DELETE /api/v1/properties/:id` |
| Verification | `POST /api/v1/verification/submit-identity`, `GET /api/v1/verification/pending`, `PATCH /api/v1/verification/:id/review` (admin) |
| Favorites | `POST/DELETE /api/v1/properties/:id/favourite`, `GET /api/v1/properties/favourites` |
| Preferences | `GET/POST/PUT /api/v1/properties/preferences` (tenant) |

Responses use `{ data: ... }` for success and `{ message: ... }` for errors. Protected routes require `Authorization: Bearer <token>`.

---

## Email Delivery Note

The development Resend account only delivers to `@resend.dev` addresses on the free tier. Registration still succeeds for any address (the user is saved and can verify with the on-screen development code). To deliver to real inboxes, verify a sending domain in the Resend dashboard and update the "from" address in `backend/src/utils/emailService.js`.

---

## Scripts

| Location | Command | Description |
|---|---|---|
| root | `npm run dev` | Start Next.js dev server |
| root | `npm run build` | Production build |
| root | `npm run lint` | ESLint |
| backend | `npm start` | Start API server |
| backend | `node scripts/seed-dev-accounts.js` | Seed dev accounts |

---

## Team Roles

| Member | Role |
|---|---|
| Kidist | Backend Lead — API, auth, business logic, security |
| Tsedenia | Frontend Lead — dashboards, components, forms, API integration |
| Yirgalem | Database & Verification — models, verification workflow, fraud detection |
| Addisu | Testing, DevOps & AI — API testing, deployment, CI/CD, AI service |
