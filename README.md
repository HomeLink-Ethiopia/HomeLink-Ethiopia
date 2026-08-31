# HomeLink Ethiopia

**A trusted digital housing & landlord–tenant platform for Ethiopia.**

This repository is the frontend prototype submitted for INSA
competition review. It implements the product vision from the
HomeLink Ethiopia Proposal as a working, navigable Next.js
application across all three user roles — Tenant, Landlord, and
Administrator — with mocked data standing in for the backend/API
layer described in the proposal's system architecture.

> HomeLink Ethiopia — *from finding a house to managing a trusted
> tenancy.*

---

## 1. Project Overview

Ethiopia's rental market is fragmented: tenants and landlords rely on
disconnected listings, brokers, informal communication, and
paper-based records, with no reliable way to verify a listing or a
landlord before money changes hands. HomeLink does not claim to solve
the national housing shortage — it targets the part of the problem
software can realistically fix: **discovery, trust, verification,
communication, applications, tenancy records, maintenance, and
market transparency.**

The platform connects three sides of the rental process in one
trusted digital environment:

- **Tenants** — discover verified properties, schedule viewings,
  apply, track rent and maintenance, and message landlords.
- **Landlords** — list and verify properties, review applications,
  manage tenants, track rent collection, and handle maintenance
  requests.
- **Administrators** — run the verification queue, review fraud
  reports and disputes, and monitor aggregated housing-market
  analytics.

This prototype covers the functional requirements from the proposal
that are realistic for a frontend-only submission — structured
listings and discovery (FR-03), viewing/application/maintenance
workflows (FR-05/06/09), a landlord property-intake flow tied to
verification (FR-02), rent tracking (FR-08), and the admin trust,
fraud, and analytics surfaces (FR-02/04/11) — using mocked data and a
simulated session in place of the real auth, database, and AI
services the full architecture calls for. See
[§5 What's Implemented vs. Mocked](#5-whats-implemented-vs-mocked)
for the exact boundary, and
[`docs/DEVELOPMENT_LOG.md`](./docs/DEVELOPMENT_LOG.md) for a
phase-by-phase account of how each piece was built.

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 14](https://nextjs.org) (App Router) |
| Language | TypeScript |
| UI | React 18 |
| Styling | [Tailwind CSS](https://tailwindcss.com) |
| Animation | [Framer Motion](https://www.framer.com/motion/) |
| Maps | [Leaflet](https://leafletjs.com) / [React-Leaflet](https://react-leaflet.js.org) over OpenStreetMap tiles (no API key required) |
| Charts | [Recharts](https://recharts.org) |
| Forms & validation | [react-hook-form](https://react-hook-form.com) + [Zod](https://zod.dev) |
| Client state | [Zustand](https://zustand-demo.pmnd.rs) |

No backend, database, or paid API keys are required to run this
prototype — everything renders from mocked, in-repo data (`lib/*.ts`)
behind an API-shaped mock layer (`services/api.ts`), so swapping in a
real backend later is a matter of replacing function bodies, not
rewriting components.

## 3. Running It Locally

**Requirements:** Node.js 18.17+ and npm.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Other scripts:

```bash
npm run build   # production build
npm run start   # run the production build
npm run lint    # lint the codebase
```

### Trying each role

There's no real login yet (see [§5](#5-whats-implemented-vs-mocked)),
so a floating **Dev** switcher — bottom-center on every page — lets
you jump straight into any role:

| Role | Lands on | Also visits |
|---|---|---|
| Tenant | `/tenant/dashboard` | `applications`, `payments`, `maintenance`, `messages` |
| Landlord | `/landlord/dashboard` | `applications`, `tenants`, `rent-payments`, `maintenance`, `properties/new` |
| Admin | `/admin/dashboard` | `market-insights`, `verification-queue`, `fraud-reports`, `disputes` |

Unauthenticated visitors land on `/` (public marketing/browse) and
`/explore` (the split list/map discovery view) — no role needed for
either.

### Mobile / responsive testing

The app is built mobile-first per the proposal's non-functional
requirement to support lower-end Android devices. To check it: open
Chrome DevTools → Device Toolbar (`Cmd/Ctrl+Shift+M`) and pick a
narrow device profile, or resize the browser below ~1024px (the `lg`
breakpoint). Dashboards, sidebars, tables, and the map view collapse
into single-column, drawer-based layouts below that width; the
sidebar becomes a slide-in drawer opened via the hamburger icon in
each dashboard's top bar.

## 4. Architecture & Structure

### 4.1 High-level shape

```
Presentation (this repo)
   Public site  ->  Tenant dashboard  ->  Landlord dashboard  ->  Admin console
        \_______________|_______________|________________/
                         |
                 services/api.ts   <- mock API layer, one function per FR
                         |
                    lib/*.ts       <- mocked datasets (properties, tenants,
                                      applications, rent, maintenance, fraud...)
```

`services/api.ts` is the seam for a real backend: every exported
function already has the `(typed params) => Promise<TypedResult>`
shape a real `fetch('/api/...')` call would have, grouped by FR
number. Swapping a mock body for a real request doesn't change any
component.

### 4.2 Repository layout

```
app/
  (public)/            Marketing + discovery -- no auth required
    page.tsx              Home (hero, featured listings)
    explore/               Split list/map discovery (FR-03)
    property/[id]/          Property detail page
  tenant/               Tenant dashboard tree (FR-05/06/08/09)
    dashboard/, applications/, payments/, maintenance/, messages/
  landlord/             Landlord dashboard tree (FR-02/07/08/09)
    dashboard/, applications/, tenants/, rent-payments/, maintenance/,
    properties/new/        Property intake wizard (FR-02/03)
  admin/                Admin console (FR-02/04/11)
    dashboard/              Trust & Verification Center
    market-insights/        Housing analytics
  layout.tsx            Root layout -- fonts, AuthProvider, modal root,
                         floating Dev role switcher

components/
  discovery/            Hero, PropertyCard, split list/map + Leaflet map
  property/             Gallery, rent-estimate gauge, action card, etc.
  tenant/, landlord/, admin/   Per-role Sidebar, TopBar, and dashboard widgets
  modals/                Application / Viewing / Maintenance / Fraud workflow
                          modals (FR-05/06/09/11), shared ModalShell
  RoleSwitcher.tsx       Floating dev-only role toggle
  TopNav.tsx / Footer.tsx   Public site chrome

lib/                    Mocked datasets + domain logic per feature area
services/api.ts         Mock API layer (typed, promise-based, FR-grouped)
types/roles.ts           Shared Role type
middleware.ts            Route-guards /tenant, /landlord, /admin by role cookie
docs/DEVELOPMENT_LOG.md  Full phase-by-phase build history
```

### 4.3 UI/UX workflow overview

```
                 +-------------------------------------------+
                 |             Public / Discovery             |
                 |   Home -> /explore (list+map) -> /property  |
                 +--------------------+------------------------+
                                      |  Apply / Schedule viewing / Report
                                      v
                     +--------------------------------------+
                     |   Workflow modals (FR-05/06/09/11)     |
                     |  Application . Viewing . Maintenance    |
                     |            . Fraud report               |
                     +--------------------+--------------------+
                                          |
        +----------------------------------+-----------------------------------+
        v                                  v                                   v
+----------------+              +--------------------+              +--------------------+
| Tenant          |              | Landlord             |              | Admin                |
| dashboard       |              | dashboard             |              | console               |
| . Home journey  |              | . Property list        |              | . Verification queue  |
| . Rent/payments |              | . Applications          |              | . Fraud reports         |
| . Maintenance   |<------------>| . Tenants                |<------------>| . Disputes               |
| . Messages      |  shared FR   | . Rent & payments         |  shared FR   | . Market insights         |
+----------------+  data model  | . Maintenance               |  data model  +--------------------+
                                | . Property wizard             |
                                |   (FR-02/03 intake)             |
                                +--------------------+
```

Role switching (Dev toolbar) and session state flow through a single
`AuthProvider` (`lib/auth-context.tsx`), which sets the same
`session_role` cookie `middleware.ts` reads to gate each role's route
tree -- so switching roles in the UI immediately unlocks (or locks)
the matching pages, the same way real auth would.

## 5. What's Implemented vs. Mocked

**Implemented as real, working UI:**
Property discovery & map search, property detail pages, the tenant
dashboard (home journey, rent, maintenance), the landlord dashboard
(property list, applications, tenants, rent collection, maintenance,
a full multi-step property intake wizard), the admin Trust &
Verification Center and Market Insights analytics, the four workflow
modals (application, viewing, maintenance, fraud report), and
role-based route guarding.

**Mocked or not yet built** (see
[`docs/DEVELOPMENT_LOG.md`](./docs/DEVELOPMENT_LOG.md) for details on
each):
- **Authentication (FR-01)** -- the floating Dev role switcher stands
  in for real login; it should be removed or gated behind a
  dev-only flag before any production deployment.
- **Backend / database / AI services** -- all data comes from
  `lib/*.ts` mocks behind `services/api.ts`; the rent-estimate,
  property-matching, and fraud-risk scores shown in the UI are
  illustrative, not computed by a live model.
- **Digital rental agreements (FR-07)** beyond structured summary
  data, ratings & reviews (FR-10), and a live payment gateway behind
  the rent-payment form (it records a payment but doesn't call a real
  processor).
- Marketing pages (How It Works / About / Support) are route stubs.

## 6. References

This project responds to the housing-market and NFR data cited in the
proposal (UN-Habitat, World Bank, and Ethiopian Statistics Service
sources) -- see the proposal document for full citations.
