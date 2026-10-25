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
├── frontend/               # Next.js 14 App Router & TypeScript UI
│   ├── app/                # Public, tenant, landlord, and admin routes
│   ├── components/         # Reusable UI components & modals
│   ├── lib/                # Client state, contexts, API configs
│   ├── locales/            # Amharic & English translations
│   ├── public/             # Images, icons, static assets
│   ├── services/           # Backend API integration client
│   └── package.json        # Frontend dependencies & Next scripts
├── backend/                # Node.js Express 5 REST API & MongoDB
│   ├── server.js           # Server entry point (port 5000)
│   ├── src/
│   │   ├── config/         # MongoDB Atlas connection
│   │   ├── controller/     # Auth, property, and user controllers
│   │   ├── middleware/     # JWT authentication, RBAC, uploads
│   │   ├── models/         # Mongoose schemas
│   │   └── routes/         # Express API routes
│   └── package.json        # Backend dependencies
├── ai/                     # Python FastAPI AI Engine (port 8000)
│   ├── main.py             # FastAPI entry point
│   ├── models/             # Trained ML models (Rent estimator)
│   └── requirements.txt    # Python dependencies
├── package.json            # Root convenience scripts (delegates to frontend & backend)
├── start-project.bat       # Windows 1-click launcher for all services
└── start-project.sh        # Linux/macOS launcher for all services
```

---

## Getting Started (Quick Start)

Anyone cloning this repository can launch the entire project instantly.

### Prerequisites

- **Node.js 18+** & **npm 9+**
- **Python 3.10+** (optional, for AI engine)

### 1. Install Dependencies

You can install all dependencies from the root:

```bash
# Option A: From root (installs both frontend and backend)
npm run install:all

# Option B: Individually
cd frontend && npm install
cd ../backend && npm install
cd ../ai && pip install -r requirements.txt
```

### 2. Launch the Application

**Option A — Automated One-Click Start (Recommended):**
- **Windows:** Double-click `start-project.bat` (or run `.\start-project.bat` in PowerShell).
- **Linux/macOS:** Run `./start-project.sh`.

This automatically starts the Frontend (port 3000), Backend (port 5000), and AI Service (port 8000).

**Option B — Run Directly:**
```bash
# Start frontend (from repository root or inside /frontend):
npm run dev

# In a separate terminal, start backend (from /backend):
cd backend && npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

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
| root | `npm run dev` | Start Next.js dev server (delegates to `frontend/`) |
| root | `npm run build` | Production build (delegates to `frontend/`) |
| root | `npm run lint` | ESLint checks |
| root | `npm run install:all` | Install dependencies for both frontend and backend |
| frontend | `npm run dev` | Start Next.js dev server directly |
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
