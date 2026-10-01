# HomeLink API Reference

Base URL: `http://localhost:5000` · All responses are JSON. Authenticated endpoints expect `Authorization: Bearer <JWT>`.

## Authentication — `/api/auth`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Register (firstName, lastName, email, phone 09…, password, role tenant\|landlord). Returns `devVerificationCode` when email delivery unavailable. |
| POST | `/login` | — | Email + password → `{ token, user }`. Rate-limited (10 failed / 15 min per email). |
| POST | `/verify-email` | — | 6-digit code |
| POST | `/resend-code` | — | Resend verification code |
| POST | `/forgot-password` | — | Rate-limited password reset code |
| POST | `/reset-password` | — | Code + new password |

## Properties — `/api/v1/properties`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/search` | optional | Filters: `location, minPrice, maxPrice, propertyType, bedrooms, bathrooms, furnished, verifiedOnly, sort, page, limit`. Returns `{ data, total, page }`. |
| GET | `/:id` | optional | Full detail incl. landlord verification badge + reviews |
| POST | `/` | landlord | Create (verified landlords only — Sprint 3 guard). AI fraud check runs on every create. |
| PUT | `/:id` | landlord | Owner-only edit |
| DELETE | `/:id` | landlord | Owner-only delete |
| GET | `/my` | landlord | Own listings |

## Verification — `/api/v1/verification`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/submit-identity` | landlord | Upload ID documents (multipart) |
| GET | `/status` | landlord | Current verification state + rejection reason |
| GET | `/queue` | admin | Pending verifications |
| PUT | `/review/:id` | admin | approve / reject + reason (audit-logged) |

## Viewings — `/api/v1/viewings`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | tenant | `{ propertyId, requestedSlots:[{date,time}], tenantNote }` |
| GET | `/my` | tenant/landlord | Role-aware list |
| PUT | `/:id/accept` `/:id/reject` `/:id/reschedule` | landlord | Manage requests |
| POST | `/:id/cancel` | either | Cancel |

Statuses: `pending → confirmed → completed / cancelled`

## Applications — `/api/v1/applications`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | tenant | Apply (duplicate-guarded) |
| GET | `/my` | tenant | Own applications (`/my-applications` alias) |
| GET | `/landlord` | landlord | All apps across own properties |
| GET | `/property/:propertyId` | landlord | Per-property |
| PUT | `/:id/review` | landlord | `{ status: under_review|approved|rejected }` |
| PUT | `/:id/withdraw` | tenant | Withdraw |

Statuses: `submitted → under_review → approved / rejected / withdrawn`

## Agreements — `/api/v1/agreements`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | landlord | Create → `pending_signatures` |
| GET | `/my` `/landlord` | tenant/landlord | Lists (response shaped for the UI) |
| POST/PUT | `/:id/confirm` | either | Sign. Both signed → `active` |
| POST | `/:id/renewal` | either | Propose renewal `{ newEndDate, newRentAmount, message }` |
| PUT | `/:id/renewal/respond` | other party | `{ decision: accept|reject }` — accept = one-click dual signing |
| GET | `/:id/renewal-price` | either | AI fair renewal price with range + explanation |

## Payments — `/api/v1/payments`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/generate/:agreementId` | landlord | One-click monthly rent schedule (idempotent) |
| GET | `/my` `/landlord` | tenant/landlord | Lists |
| GET | `/agreement/:id` | either | Per-agreement schedule |
| POST | `/:id/pay` | tenant | Upload proof `{ paymentMethod, transactionReference }` |
| PUT | `/:id/verify` | landlord | Confirm receipt → `paid`/`partial` |
| POST | `/:id/remind` | landlord | Send reminder |
| POST | `/:id/chapa/initialize` | tenant | Chapa online payment |
| GET | `/chapa/verify/:tx_ref` | — | Chapa callback verification |

Statuses: `pending → paid / partial / overdue / waived / disputed`

## Maintenance — `/api/v1/maintenance`
`GET /my` (role-aware), `GET /:id`, `POST /` (tenant, with images), `PUT /:id/status` (landlord: submitted→acknowledged→assigned→in_progress→resolved→closed), `PUT /:id/assign`, `POST /:id/respond`

## Communication — `/api/v1/communication` + `/api/v1/messages`
Conversations between tenant ↔ landlord: `GET /conversations`, `GET /conversations/:id/messages`, `POST /conversations/:id/messages`, mark-read. `POST /api/v1/messages` (by receiverId) opens-or-reuses a conversation.

## Reviews — `/api/v1/reviews`
`POST /` (agreement-gated: only verified stays, no self-review, one per agreement/type), `GET /property/:id`, `GET /user/:id`, `GET /my`

## Fraud — `/api/v1/fraud-reports`
`POST /` (tenant: category = fake_listing | duplicate_listing | image_theft | scam | impersonation | suspicious_payment | other), AI risk scoring attached (LOW/MEDIUM/HIGH → admin review, never auto-ban).

## Disputes — `/api/v1/disputes`
`POST /` (either party, tied to property/agreement), `GET /my`, admin: `GET /api/v1/admin/disputes` + `PUT /api/v1/admin/disputes/:id/resolve` (audit-logged).

## Notifications — `/api/v1/notifications`
`GET /` (own list), `PUT /:id/read`, `PUT /read-all`. Centralized: viewings, applications, agreements, renewals, rent, maintenance, messages, fraud, disputes.

## Intelligence — `/api/ai` + `/api/v1/credit-score` + `/api/v1/neighborhoods`
| Method | Path | Description |
|---|---|---|
| POST | `/api/ai/estimate-rent` | `{subcity, bedrooms, bathrooms, area_sqm}` → range + confidence |
| POST | `/api/ai/detect-fraud` | risk_score 0-100, level, red_flags, human_review_required |
| POST | `/api/ai/recommend` | `{max_budget_etb, preferred_subcities[], min_bedrooms}` → scored matches with reasons |
| GET | `/api/ai/health` | Service status (503 = offline, heuristic fallback engages) |
| GET | `/api/v1/credit-score/my` | Tenant's 0-1000 score + breakdown (live recompute) |
| GET | `/api/v1/credit-score/tenant/:id` | Landlord views applicant score (24h cache) |
| POST | `/api/v1/credit-score/batch` | `{tenantIds[]}` → scores for an application list |
| GET | `/api/v1/neighborhoods` | 12 Addis sub-cities × 7 liveability dimensions |
| GET | `/api/v1/neighborhoods/compare?names=A,B` | Side-by-side |

## Admin — `/api/v1/admin` (admin role only)
`GET /dashboard` · `GET /analytics/kpis` · `GET /analytics/charts` · `GET /users` · `GET /properties` · `GET /fraud-reports` · `GET /disputes` · `GET /verifications` · `GET /audit-logs` · `PUT /disputes/:id/resolve` · `PUT /landlords/:id/verify` · `PUT /users/:id/suspend` — every moderation action writes an AuditLog.
