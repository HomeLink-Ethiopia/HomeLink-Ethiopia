# Development Log

Phase-by-phase build notes for the HomeLink Ethiopia frontend
prototype — kept for context on *why* things are built the way they
are. For a project overview, setup instructions, and current status,
see the top-level [`README.md`](../README.md).

Next.js (App Router) + React + Tailwind CSS.

## Phase 1 — Foundation & Global Architecture

- **Role-based routing** — `app/(public)` is the open marketing/browse
  tree (no URL prefix). `app/tenant`, `app/landlord`, `app/admin` are
  real URL segments, each gated by `middleware.ts`, which checks a
  `session_role` cookie against the route prefix and redirects
  unauthenticated or wrong-role visitors home. Swap the cookie check
  in `middleware.ts` for real session lookup once FR-01 auth is built.
- **`components/TopNav.tsx`** — Explore, How It Works, List Property,
  About, Support, an EN/AM toggle, and the "Get Started" CTA. Mobile
  menu included.
- **`components/Footer.tsx`** — Company, Resources, Legal, Social.
- **`tailwind.config.js`** — the warm rust/charcoal/cream palette and
  the Fraunces / Inter / IBM Plex Mono type system, documented inline.
- **`app/globals.css`** — base styles plus the `.notch` utility, a
  clipped-corner "seal" motif reserved for verification-related UI
  (the primary CTA today; verification badges once FR-02 is built).
- **`framer-motion`** — `components/PageTransition.tsx` fades/slides
  between routes; `lib/motion.ts` holds shared variants (`fadeInUp`,
  `cardHover`) so later phases animate consistently instead of each
  page inventing its own timing. The nav CTA and homepage hero use
  these already as a reference.
- **`lib/images.ts`** — real (not blank-box) placeholder photography
  via Picsum Photos. **Note:** the brief's original
  `source.unsplash.com/featured/?...` pattern is dead — Unsplash fully
  shut that endpoint down in June 2024, so those URLs 404. Picsum is
  the live equivalent: no key required, deterministic per seed, but
  not Ethiopia-specific. For real contextual photography (actual Addis
  Ababa streets/interiors), wire up the official Unsplash API with a
  free key behind a small server route so the key never ships to the
  client — `lib/images.ts` has the exact swap-in point documented.

## Phase 2 — The Discovery Engine

Addresses FR-03 (property discovery) with three pieces:

- **`components/discovery/Hero.tsx`** — scroll-linked parallax hero
  (via `framer-motion`'s `useScroll`/`useTransform`, not a fixed
  background-attachment trick) plus the location/type/budget/bedroom
  search bar from the design. Used on `/`.
- **`components/discovery/PropertyCard.tsx`** — the listing card. Hover
  gives a real 3D tilt (rotation follows pointer position, not just a
  flat lift) plus shadow expansion, and a green "Verified" badge per
  FR-11 (fraud-risk reduction). Accepts an optional `isHighlighted`
  prop so it can be driven externally — see DiscoverySplit.
- **`components/discovery/DiscoverySplit.tsx`** + **`PropertyMap.tsx`**
  — the split list/map view at `/explore`. The map is a real,
  interactive Leaflet map (OpenStreetMap tiles, free, no API key),
  not a placeholder:
  - Centered on Addis Ababa, with markers plotted at each property's
    actual lat/lng (`lib/properties.ts`).
  - Custom HTML/CSS "price bubble" markers (`L.divIcon`, no image
    assets) matching the design's pins — this also sidesteps the
    common Next.js + Leaflet bug where the default marker icon PNGs
    404 because the bundler doesn't resolve Leaflet's internal image
    paths.
  - Hover is synced both directions: hovering a list row highlights
    its map pin (scale + shadow) and opens its popup card; hovering a
    pin highlights the matching list row.
  - `PropertyMap` is dynamically imported with `ssr: false` in
    `DiscoverySplit.tsx`, since Leaflet touches `window` on load and
    would break server rendering otherwise.
  - Pin color is coded per neighborhood (see `NEIGHBORHOOD_COLOR` in
    `lib/properties.ts`) so clusters are readable at a glance.
  - The List/Split/Map toggle shown in the toolbar is visual only for
    now — only the Split view is wired up; List and Map are stubs for
    a later pass.

Property data in `lib/properties.ts` is mocked with realistic Addis
Ababa neighborhood coordinates (Bole, Kazanchis, CMC, Saris, Yeka) —
swap for the real FR-03 listings API when it exists; nothing else
downstream needs to change.

## Phase 3 — The Property Deep Dive

Addresses FR-03 (discovery transparency) and FR-08/09 (rent +
maintenance visibility) with the listing detail page:

- **`lib/propertyDetails.ts`** — layers description, a photo gallery,
  amenities, deposit, a landlord profile, open maintenance requests,
  and an AI rent-estimate range onto each mocked `Property`, keyed
  deterministically off its id so the same listing always renders the
  same detail. Swap for the real FR-03/07/08/09 APIs later.
- **`components/property/PropertyGallery.tsx`** — hero photo + a
  thumbnail strip (with the design's "+N" tile), all clickable into a
  full lightbox modal (`framer-motion` `AnimatePresence`, arrow-key
  and Esc navigation, click-through backdrop).
- **`components/property/RentEstimateGauge.tsx`** — the "AI Fair-Rent
  Estimate" gauge. The needle animates to the estimated position only
  once the card scrolls into view (`useInView`), not on page load.
- **`ActionCard.tsx`** (sticky Apply Now / Schedule Viewing / Save),
  **`LandlordCard.tsx`**, **`OpenRequestsCard.tsx`**,
  **`AboutSection.tsx`** (Read more/less toggle).
- **`app/(public)/property/[id]/page.tsx`** — assembles all of the
  above, reuses the existing Leaflet `PropertyMap` for the location
  card (single marker), and lists Similar Properties.
- `PropertyCard` and the `/explore` list rows now link to
  `/property/[id]` — they didn't navigate anywhere before this phase.

## Phase 4 — The Tenant Dashboard

Addresses FR-08 (rent) and FR-09 (maintenance) with the tenant's
signed-in home base at `/tenant/dashboard`:

- **`components/tenant/Sidebar.tsx`** — the persistent left rail.
  Only Home, Search, and My Home point at routes that exist today;
  Applications/Payments/Messages/Maintenance/Favorites/etc. render
  inert (`href="#"`) rather than 404ing, since FR-05/06/08/09's own
  pages aren't built yet.
- **`components/tenant/TopBar.tsx`** — Messages, Notifications (with
  an unread dot), and the user menu.
- **`components/tenant/HomeJourneyTracker.tsx`** — the five-stage
  stepper (Discovered → Viewing → Application → Approved → Living
  Here). The connecting line fills and each dot pops in staggered via
  `framer-motion`, driven by how far along `currentStepIndex` is.
- **`CurrentHomeCard.tsx`**, **`NextPaymentBox.tsx`**,
  **`RentPaymentCard.tsx`**, **`QuickActions.tsx`**,
  **`MaintenanceTrackerCard.tsx`** — the remaining dashboard widgets,
  all driven by `lib/tenant.ts`'s mock tenancy data (current lease,
  next/last payment, open maintenance requests, recommended homes).
  Swap `lib/tenant.ts` for the real session + FR-08/09 data once
  FR-01 auth exists — every component here just takes props.

## Phase 5 — Landlord Operations

Addresses FR-07 (landlord/property management tools) at
`/landlord/dashboard`:

- **`components/landlord/Sidebar.tsx`** — landlord-specific left rail
  (Overview, Properties, Applications, Tenants, Rent & Payments,
  Maintenance, Reports, Messages). Only Overview/Properties point at
  the built route today; the rest render inert (`href="#"`), same
  convention as the tenant sidebar.
- **`components/landlord/TopBar.tsx`** — page title + notifications +
  the signed-in landlord's name/avatar.
- **`components/landlord/LandlordPropertyList.tsx`** — the status
  toggle tabs (All / Occupied / Vacant / Under Maintenance), a live
  search box (title, neighborhood, or tenant name), and the property
  rows themselves: tenant name + collection rate for occupied units,
  views + application count for vacant ones, and the open issue for
  units under maintenance. Rows animate in with `framer-motion`.
- **`lib/landlord.ts`** — layers this portfolio metadata directly onto
  the shared `PROPERTIES` list from `lib/properties.ts` (rather than a
  second, divergent mock dataset), so every "View Details" button
  resolves to a real Phase 3 `/property/[id]` page instead of 404ing.
- **"Add New Property"** links to `app/landlord/properties/new` — a
  pre-submission checklist for FR-02 (landlord & property
  verification): what to have ready (ownership proof, ID, photos)
  before starting. The actual multi-step intake form is a later
  phase; the "Start Verification" button is disabled with a tooltip
  saying so rather than pretending to submit anything.

## Phase 6 — Trust, Verification & Analytics (Admin)

Addresses FR-02 (verification), FR-11 (fraud-risk detection), and
FR-04 (housing analytics) across two admin pages:

**Trust & Verification Center** — `/admin/dashboard`:

- **`components/admin/KpiCard.tsx`** — In Verification, Fraud
  Reports, Disputes, Verification Rate, each with a trend chip.
- **`components/admin/VerificationQueue.tsx`** — sorted high → medium
  → low risk (the order the fraud-risk model would want a reviewer to
  work through), each row showing the listing/landlord, an avatar, and
  time in queue.
- **`components/admin/VerificationProgress.tsx`** — a Recharts donut
  breaking the queue down by risk tier, with the total in the center.
- **`components/admin/FraudReportsByType.tsx`** — animated horizontal
  bars (Fake Listing, Payment Scam, Duplicate Listing, Identity Fraud,
  Other).
- **`components/admin/RiskLevelDistribution.tsx`** — a second Recharts
  donut, this one as % of the queue rather than raw counts.

**Market Insights** — `/admin/market-insights`:

- **`components/admin/InsightsTabs.tsx`** — Overview / Financials /
  Demand / Supply / Neighborhoods tabs. Only Overview is built; the
  others show an honest "not built yet" placeholder rather than empty
  charts.
- **`components/admin/RentTrendChart.tsx`** — a Recharts line chart,
  average rent by unit size (1/2/3-bed) over 6 months.
- **`components/admin/DemandSupplyChart.tsx`** — a Recharts bar chart,
  active demand requests vs. active listings by month.
- **`components/admin/NeighborhoodDemand.tsx`** — animated bar list,
  Popular Neighborhoods by Demand.
- **`components/admin/PropertyTypeDistribution.tsx`** — a third
  Recharts donut, the property-type mix (Apartment/Condo/House/etc).
- **`lib/admin.ts`** / **`lib/marketInsights.ts`** — all the mock data
  for both pages; swap for real aggregation queries once FR-02/FR-11
  write real data instead of the seeded mocks.
- **`components/admin/Sidebar.tsx`** — shared between both admin pages
  (Dashboard, Verification Queue, Landlord/Property Verification,
  Fraud Reports, Disputes, Risk Monitoring, Market Insights, Audit
  Logs). Only Verification Queue and Market Insights point at built
  routes; the rest are `href="#"`.

### Bug fixed this phase

`app/(public)/property/[id]/page.tsx` (a Server Component, from Phase
3) was calling `<PropertyMap onHoverChange={() => {}} />` — passing an
inline function from a Server Component into a Client Component,
which isn't serializable across that boundary and crashed
`next build` during static generation for every `/property/[id]`
page (`tsc --noEmit` doesn't catch this; it's a React Server
Components rule, not a type error). Fixed by making `onHoverChange`
optional on `PropertyMap`, defaulting to a no-op internally, so
Server Component callers can omit it entirely instead of being forced
to supply an unserializable function. A full `next build` now
completes cleanly end to end (confirmed by temporarily stubbing the
Google Fonts calls in `app/layout.tsx`, which fail only because this
sandbox has no outbound access to `fonts.googleapis.com` — unrelated
to the fix, and reverted before packaging).

## Architecture, workflow modals & wizard (this batch)

Foundational pieces the rest of the app now builds on:

- `lib/store.ts` — Zustand store for the single global UI concern that's genuinely cross-cutting: which workflow modal is open (`activeModal: 'application' | 'viewing' | 'maintenance' | 'fraud' | null`) plus its context (which property), and sidebar open/closed.
- `lib/auth-context.tsx` — `AuthProvider` + `useAuth()`, a simulated session built on the existing `Role`/`ROLE_HOME` source of truth in `types/roles.ts` (kept lowercase `'tenant' | 'landlord' | 'admin'` rather than introducing a second, conflicting role enum). `login(role)` sets the same `session_role` cookie `middleware.ts` already reads, so switching roles actually unlocks that role's route tree, not just the UI.
- `services/api.ts` — mock API layer. Every exported function has the exact `(typed params) => Promise<TypedResult>` shape a real `fetch('/api/...')` call would have, organized by FR number (FR-02 verification, FR-03 discovery, FR-05 viewings, FR-06 applications, FR-09 maintenance, FR-11 fraud, FR-12 disputes). Swapping the body for a real request is the entire migration path.
- `components/modals/` — `ModalShell` (shared backdrop + framer-motion enter/exit + Escape-to-close), and the four workflow modals it wraps: `ApplicationModal` (FR-06), `ViewingModal` (FR-05), `MaintenanceModal` (FR-09), `FraudModal` (FR-11). All four use `react-hook-form` + `zod`. `ModalRoot` mounts all four once in the root layout; anything anywhere can open one via `useUIStore().openModal('application', { propertyId, propertyTitle })`. Wired up so far: the property page's Apply Now / Schedule Viewing / Report buttons, and the tenant dashboard's Quick Actions.
- `components/landlord/PropertyWizard.tsx` — the real FR-02/FR-03 property intake form, replacing the old disabled "Start Verification" stub at `/landlord/properties/new`. Four steps (details, pricing & amenities, photos, verification docs), `react-hook-form` + `zod` with per-step validation via `trigger()`, framer-motion step transitions. Submits through `submitPropertyListing()`.
- `components/RoleSwitcher.tsx` — small floating "Dev" toggle (bottom-center) for instantly switching between Tenant/Landlord/Admin during testing, via `useAuth().login(role)`. Remove or gate behind an env flag once FR-01 real auth exists.

## Running it

```bash
npm install
npm run dev
```

Visit `/` for the hero + featured listings, `/explore` for the split
list/map view, or click into any listing for the property detail page
at `/property/[id]`. Each role dashboard is gated by `middleware.ts`
via a `session_role` cookie — easiest way to set it now is the floating
"Dev" switcher at the bottom of any page, which also updates the
simulated `AuthProvider` session:

- Tenant → `/tenant/dashboard`, plus `applications`, `payments`, `maintenance`, `messages`
- Landlord → `/landlord/dashboard`, plus `applications`, `tenants`, `rent-payments`, `maintenance`, `properties/new`
- Admin → `/admin/dashboard`, `market-insights`, `verification-queue`, `fraud-reports`, `disputes`

## Not yet built

Real auth (FR-01 — the Dev role switcher stands in for it), the
digital rental-agreement workflow (FR-07) beyond structured data on
the tenant/landlord dashboards, ratings & reviews (FR-10), a live
payment gateway behind the FR-08 payment form (it currently records
the payment but doesn't call out to a real processor), and How It
Works / About / Support marketing pages (route stubs only).

## Final Polish — Submission Readiness

Covers the pre-submission pass requested for INSA review: mobile
responsiveness, the dev role-switcher, and documentation.

- **Mobile responsiveness audit.** The tenant/landlord/admin
  `Sidebar.tsx` components were fixed `w-64` rails with no way to
  hide them below desktop widths — on a phone they simply ate the
  screen. All three are now off-canvas drawers: `-translate-x-full`
  by default, sliding to `translate-x-0` when `useUIStore().sidebarOpen`
  is true, with a tap-to-dismiss backdrop and an in-drawer close (×)
  button. Above the `lg` breakpoint the drawer classes are overridden
  (`lg:static lg:translate-x-0`) so desktop behavior is unchanged.
  Each role's `TopBar.tsx` now renders a hamburger button (`lg:hidden`)
  wired to `toggleSidebar()`; the sidebars themselves close on
  backdrop tap or nav-link tap. `lib/store.ts`'s `sidebarOpen` default
  flipped from `true` to `false` to match (harmless — the flag is
  ignored above `lg` either way).
- **Table overflow.** `/landlord/rent-payments` and `/landlord/tenants`
  had bare `<table>` markup with no scroll container, so columns
  would compress or clip on narrow screens. Both now wrap the table
  in `overflow-x-auto` with a `min-w-[...]` on the `<table>` itself,
  matching the pattern already used on the applications table and
  admin insights tabs.
- **TopBar crowding on small screens.** Secondary labels (tenant
  name, "Notifications" text, landlord name, the admin period-filter
  dropdown) now hide below `sm`, leaving icon-only controls plus the
  page title so nothing wraps or overflows on a small Android
  viewport.
- **Role switcher.** `components/RoleSwitcher.tsx` — the floating
  bottom-center "Dev" toggle for jumping between Tenant/Landlord/Admin
  — already existed from an earlier phase and needed no changes; it's
  mounted once in the root layout and confirmed working across all
  three role trees.
- **README.** Replaced with a submission-facing `README.md`
  (overview, tech stack, setup, structure/workflow overview); this
  phase-by-phase build log moved here, to `docs/DEVELOPMENT_LOG.md`.

Not verified in this pass: an actual `next build` / device-lab check,
since this sandbox has no network access to install dependencies.
The changes above were reviewed by hand for correct Tailwind
breakpoint usage and balanced JSX; run `npm run build` and test on a
real low-end Android viewport (or Chrome DevTools device emulation)
before relying on this for the competition demo.
