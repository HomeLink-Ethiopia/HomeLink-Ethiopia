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
- **Viewing Scheduling** — Request and confirm property viewings
- **Maintenance Requests** — Tenants report issues, landlords track resolution
- **Rent Management** — Payment tracking, due dates, receipts
- **Fraud Reporting** — Report suspicious properties with AI risk scoring
- **Bilingual UI** — Full Amharic/English translation toggle
- **Responsive Design** — Mobile-first, works on all devices

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| UI | React 18 |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| Maps | Leaflet + React-Leaflet (OpenStreetMap) |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| State | Zustand |

---

## Getting Started

**Requirements:** Node.js 18.17+ and npm

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Available Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Run production build
npm run lint     # Lint codebase
```

---

## Project Structure

```
app/
  (public)/              Public pages (no auth required)
    page.tsx               Homepage
    explore/               Property discovery with map
    property/[id]/         Property detail page
    login/                 Login page
    signup/                Registration page
    verify-email/          Email verification
    forgot-password/       Password reset
  tenant/                Tenant dashboard
    dashboard/             Overview and quick actions
    applications/          My rental applications
    payments/              Payment history
    maintenance/           Maintenance requests
    messages/              Landlord messaging
    ai-match/              AI property matching
    favorites/             Saved properties
    agreements/            Rental agreements
  landlord/              Landlord dashboard
    dashboard/             Overview and analytics
    properties/            Property management
    properties/new/        Add new property
    applications/          Review tenant applications
    tenants/               Tenant management
    rent-payments/         Rent collection tracking
    maintenance/           Maintenance requests
    verification/          Verification status
  admin/                 Admin dashboard
    dashboard/             System overview
    verification-queue/    Landlord verification
    fraud-reports/         Fraud investigation
    disputes/              Dispute management
    risk-monitoring/       Risk score dashboard
    market-insights/       Housing analytics
    audit-logs/            Audit trail

components/              Reusable UI components
  discovery/             Property cards, map, search
  tenant/                Tenant sidebar, widgets
  landlord/              Landlord sidebar, widgets
  admin/                 Admin sidebar, widgets
  modals/                Application, viewing, maintenance modals

lib/                     Utilities and data
  language-context.tsx   Amharic/English translation system
  properties.ts          Property data and types
  ai-matching.ts         AI matching algorithm
  images.ts              Image management
  store.ts               Zustand state management

locales/
  en.json                English translations (361+ keys)
  am.json                Amharic translations (361+ keys)

services/
  api.ts                 API service layer
```

---

## API Endpoints

The frontend expects the following REST API endpoints. The backend should implement these for full integration.

### Authentication

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | `{ firstName, lastName, email, phone, password, role }` |
| POST | `/api/auth/login` | Login | `{ email, password }` |
| POST | `/api/auth/verify-email` | Verify email code | `{ email, code }` |
| POST | `/api/auth/forgot-password` | Request reset code | `{ email }` |
| POST | `/api/auth/reset-password` | Reset password | `{ email, code, newPassword }` |

### Properties (Public)

| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| GET | `/api/public/properties` | Search properties | `neighborhood, city, minPrice, maxPrice, beds, baths, type, furnished, page, limit` |
| GET | `/api/public/properties/:id` | Get property detail | — |

### Properties (Authenticated)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/properties/my` | Get landlord's properties | Landlord |
| POST | `/api/v1/properties` | Create property | Landlord |
| PUT | `/api/v1/properties/:id` | Update property | Landlord (owner) |
| DELETE | `/api/v1/properties/:id` | Delete property | Landlord (owner) |

### Verification

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/verification/pending` | Get pending verifications | Admin |
| POST | `/api/v1/verification/submit` | Submit verification docs | Landlord |
| PUT | `/api/v1/verification/:id/approve` | Approve verification | Admin |
| PUT | `/api/v1/verification/:id/reject` | Reject verification | Admin |

### Applications

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/applications` | Submit application | Tenant |
| GET | `/api/v1/applications/my` | Get my applications | Tenant |
| GET | `/api/v1/applications/property/:id` | Get applications for property | Landlord |
| PUT | `/api/v1/applications/:id/approve` | Approve application | Landlord |
| PUT | `/api/v1/applications/:id/reject` | Reject application | Landlord |

### Viewings

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/viewings` | Request viewing | Tenant |
| GET | `/api/v1/viewings/my` | Get my viewings | Tenant/Landlord |
| PUT | `/api/v1/viewings/:id/confirm` | Confirm viewing | Landlord |
| PUT | `/api/v1/viewings/:id/cancel` | Cancel viewing | Either |

### Maintenance

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/maintenance` | Submit maintenance request | Tenant |
| GET | `/api/v1/maintenance/my` | Get my requests | Tenant |
| GET | `/api/v1/maintenance/property/:id` | Get requests for property | Landlord |
| PUT | `/api/v1/maintenance/:id/status` | Update status | Landlord |

### Response Format

All API responses should follow this format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed"
}
```

Error response:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

---

## User Roles

| Role | Dashboard | Can Do |
|------|-----------|--------|
| **Tenant** | `/tenant/dashboard` | Search properties, apply, schedule viewings, pay rent, report maintenance |
| **Landlord** | `/landlord/dashboard` | List properties, verify identity, manage applications, track rent |
| **Admin** | `/admin/dashboard` | Verify landlords, investigate fraud, resolve disputes, view analytics |

---

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

---

## Testing the App

1. **Homepage** — Browse featured properties, search by city
2. **Explore** — Filter properties with map view
3. **Signup** — Register as tenant or landlord
4. **Login** — Access dashboard
5. **Tenant Dashboard** — View applications, payments, maintenance
6. **Landlord Dashboard** — Manage properties, review applications
7. **Admin Dashboard** — Verification queue, fraud reports, analytics

---

## License

Proprietary — HomeLink Ethiopia Team
