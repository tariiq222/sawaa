# Sawaa Backend — API Endpoint Inventory & Engineering Analysis

Snapshot date: 2026-10-12. Source of truth: `apps/backend/openapi.json` (416 operations across 329 paths) cross-checked against the 71 `*.controller.ts` files under `apps/backend/src/api/`. The only route in code that is intentionally absent from the OpenAPI snapshot is `GET /public/metrics` (`@ApiExcludeController`). No other drift was found.

All paths below are relative to `/api/v1` (global prefix `api`, URI versioning with default version `1`).

---

## 1. Architecture at a glance

### 1.1 Four API surfaces

| Surface | Path prefix | Caller | Auth mechanism | Ops |
|---|---|---|---|---|
| Staff auth | `/auth` | Dashboard | Public (login/OTP/reset) + staff JWT for `me` / `password/change` | 10 |
| Dashboard | `/dashboard/*` | Next.js dashboard | `JwtGuard` + `CaslGuard` + per-route `@CheckPermissions` | 254 |
| Mobile | `/mobile/auth`, `/mobile/client/*`, `/mobile/employee/*` | Expo app | Client session JWT (`ClientSessionGuard`) for clients; staff JWT + CASL for employees | 78 |
| Public / website | `/public/*` | Website + mobile (shared catalog) | Mostly `@Public()`; client-owned routes use `ClientSessionGuard` | 71 |
| Health | `/health*` | Infra | Public | 3 |

Breakdown by HTTP verb: GET 183, POST 139, PATCH 64, PUT 15, DELETE 15.

### 1.2 Guard chain (global → route)

1. `SingleTenantThrottlerGuard` (global, Redis-backed). Default bucket: 300 req/min. Sensitive routes override with `@Throttle` (3, 5, 10, 20, 30, 60, 120 per minute).
2. `JwtGuard` (global `APP_GUARD`). Every route is staff-JWT protected unless decorated `@Public()`. This is a deny-by-default posture: forgetting `@Public()` breaks a public route loudly instead of leaking a private one.
3. Route-level guards:
   - `CaslGuard` + `@CheckPermissions({ action, subject })` on every dashboard and `mobile/employee` controller. Coverage is 100 %: 254 dashboard routes carry 254 permission checks; `mobile/employee` has 16/16 (the `profile` controller uses `JwtGuard` only, which is correct for self-service).
   - `ClientSessionGuard` (Passport strategy `client-jwt`) on client-owned routes. Those controllers are marked `@Public()` at class level to bypass the staff `JwtGuard`, then re-guarded with the client strategy. This double-decoration is the main cognitive trap in the codebase (see §4.2).
   - `WebChatEnabledGuard` on guest and client chat routes (feature flag gate).
4. Global `ValidationPipe` with `whitelist + forbidNonWhitelisted + transform`. Unknown body fields are rejected, not ignored.
5. CSRF policy middleware with explicit exemptions for the two inbound webhooks (`/public/payments/webhook`, `/public/sms/webhooks`).

### 1.3 CASL subjects in use

`Setting` (67 checks), `Booking` (56), `Employee` (34), `Service` (21), `Report` (11), `User` (10), `Invoice` (10), `Payment` (9), `Conversation` (9), `Client` (9), `Role` (8), `Branch` (8), `Coupon` (6), `Department` (5), `Category` (5), `Integration` (3).

`Setting` is overloaded: it covers organization settings, AI config, email/SMS providers, Moyasar config, intake forms, packages, media and mobile home cards. Any role granted `Setting:update` for one of these gets all of them.

---

## 2. Endpoint catalog by domain

Legend: **A** = requires a token (staff JWT or client session), **–** = anonymous. Throttle shown only where a route overrides the 300/min default.

### 2.1 Staff authentication — `/auth` (10)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/login` | – | email + password |
| POST | `/auth/lookup` | – | which auth methods a user has |
| POST | `/auth/otp/request-dashboard` | – | OTP by email |
| POST | `/auth/otp/verify-dashboard` | – | |
| POST | `/auth/refresh` | – | refresh-token rotation |
| POST | `/auth/logout` | – | revokes refresh token |
| POST | `/auth/request-password-reset` | – | |
| POST | `/auth/reset-password` | – | |
| GET | `/auth/me` | A | |
| PATCH | `/auth/password/change` | A | |

### 2.2 Dashboard — `/dashboard/*` (254)

| Controller | Ops | Main subjects | Highlights |
|---|---|---|---|
| `bookings` | 23 | Booking | Full lifecycle as PATCH verbs (`confirm`, `check-in`, `complete`, `no-show`, `restore-no-show`, `cancel`, `approve-cancel`, `reject-cancel`, `reschedule`), `DELETE` of terminal bookings, late-entry recording, credit transfer, book-from-credit, Zoom retry, timeline + status log, `stats`, `availability`, `matching-credits` |
| `finance` | 28 | Invoice, Payment, Coupon | Invoices (create, discount, PDF), payments (process, verify bank transfer, refund, manual refund, stats), coupons CRUD + apply, Moyasar config + probe, package purchases (sell, refund), per-client purchases |
| `refunds` | 3 | Payment | refund-request queue: list / approve / deny |
| `discount-reasons` | 4 | Setting | CRUD |
| `people` | 42 | Client, Employee | Clients CRUD + active toggle. Employees: CRUD, avatar + public image, login-account link, availability, breaks, exceptions, vacations, slots, available-days, onboarding, ratings, per-service config (assign, options, durations, delivery types, pricing mode, custom pricing, types) |
| `organization` (5 controllers + package-families) | 59 | Setting, Branch, Department, Category, Service | Settings, booking settings, branches (+ employee assignment), departments, categories, hours, holidays, services (+ booking types, duration options, employees, restore), packages, package families, intake forms (+ fields, responses), ratings |
| `programs` | 9 | Booking | Group programs: CRUD, publish, schedule, cancel (+ preview), enroll on behalf |
| `comms` | 23 | Setting, Conversation | Chat conversations (legacy namespace), contact messages, email templates + preview, delivery logs, staff notifications, email/SMS provider settings + test + deliveries |
| `conversations` | 9 | Conversation | Reception inbox: list, get, claim, assign, reply, read, release, close |
| `ai` | 15 | Setting | Chatbot config, knowledge base CRUD + publish/unpublish/reindex, provider config + models + credential test, staff chat |
| `identity` | 15 | User, Role | Users CRUD, activate/deactivate, role change (rank-checked), custom roles + permissions, permission catalog |
| `integrations` | 3 | Integration | Zoom S2S credentials get/put/test |
| `platform` | 5 | Integration, Setting | Generic integrations list/upsert, problem reports |
| `media` | 4 | Setting | Upload, metadata, presigned URL, delete |
| `mobile-home-cards` | 4 | Setting | List, create draft, update (optimistic concurrency), reorder |
| `ops` | 5 | Report | Activity log, failed outbox list + retry, clinic report, package report |
| `stats` (`/dashboard/stats`, `/dashboard/top-performers`) | 2 | Report | Home KPIs, top performers by revenue |

### 2.3 Mobile auth — `/mobile/auth` (17, all anonymous)

Three parallel entry flows plus legacy register/OTP:

- **Email-entry** (5): `request` → `verify` → `request-phone` / `resend-phone` → `verify-phone` (issues session).
- **Phone-entry** (4): `request` → `verify` → `resend` → `complete`.
- **Legacy** (6): `register`, `verify-otp`, `request-login-otp`, `password-login`, `refresh`, `logout`.
- **Review** (1): `review-login` for the app-store review account (throttled 5/min, gated by config).
- `request-email-verification` is listed under `/mobile/auth` but requires a session.

All OTP issuers are throttled at 3/min; `refresh` at 10/min; `password-login` at 5/min.

### 2.4 Mobile client — `/mobile/client/*` (39, all `ClientSessionGuard`)

| Area | Ops | Routes |
|---|---|---|
| bookings | 8 | list, create, get, cancel, cancellation-preview, reschedule, rate, join (Zoom) |
| payments | 10 | list, invoice get, Moyasar init (invoice / package), native init (invoice / package), native reconcile, native config, bank-transfer upload + settings |
| packages | 3 | purchases list/get, book from credit (shared controller with `/public/me/packages`) |
| portal | 3 | home aggregate, summary, upcoming |
| profile | 3 + 4 + 2 | get/update/delete; email state/request/verify/decline; phone request/verify |
| notifications | 5 | list, unread-count, mark-read, FCM token register/remove |
| programs | 1 | enroll |

### 2.5 Mobile employee — `/mobile/employee/*` (22, staff JWT + CASL)

| Area | Ops | Routes |
|---|---|---|
| bookings | 8 | list, create, get, start, start-meeting (Zoom host), complete, cancel-request, employee-cancel |
| schedule | 4 | today, weekly, availability get/update |
| clients | 3 | list, get, history (scoped to clients with a booking with this employee) |
| earnings | 1 | summary (display-only analytics, never money movement) |
| profile | 6 | get, update, avatar upload/remove, contact request/verify |

### 2.6 Public website — `/public/*` (71)

**Anonymous catalog & discovery (28):** `branding`, `branches` (+ `/{id}`, `/{id}/employees`), `services` (+ booking options per practitioner), `employees` (list, by slug/id, image, availability, availability/days, images/{fileId}), `availability`, `packages` (+ `/{id}`), `package-families` (+ `/{id}`), `programs` (+ `/{id}`), `testimonials`, `mobile-home-cards`, `intake-forms/applicable`, `payments/methods`, `bookings/{id}/status`, `verify-email`, `contact-messages` (POST).

**Anonymous client auth (7):** `public/auth` login/register/refresh/logout/reset-password, `public/otp` request/verify.

**Guest chat (6):** create conversation, current, messages list/send, retry, handoff. Gated by `WebChatEnabledGuard`.

**Client-owned, `ClientSessionGuard` (28):**
- `/public/me` (8): profile get/update, bookings list/get/cancel/reschedule/cancellation-preview/invoice.
- `/public/me/chat` (11): conversations list/get/current/claim/handoff/messages/retry, operations acknowledge/confirm/decline (AI-prepared booking operations).
- `/public/me/packages` (3), `/public/me/invoices` (1), `/public/invoices/{id}` + `/pdf` (2), `/public/bookings` create + intake-responses (2), `/public/payments/init` + `package-purchases/init` (2), `/public/refunds/request` (1), `/public/programs/{id}/enroll` (1).

**Inbound webhooks (2):** `POST /public/payments/webhook` (Moyasar; verified by `x-moyasar-signature` header or body `secret_token`), `POST /public/sms/webhooks/{provider}` (HMAC `x-signature`, rejects when missing). Both are CSRF-exempt.

**Operational (1, excluded from OpenAPI):** `GET /public/metrics` — bearer token (fail-closed 503 when unset) then IP allowlist.

### 2.7 Health (3)

`/health`, `/health/live`, `/health/ready` — anonymous, no throttle override.

---

## 3. Strengths worth preserving

1. **Deny-by-default auth.** Global `JwtGuard` + explicit `@Public()` means a forgotten decorator fails safe.
2. **Complete permission coverage.** Every dashboard and employee route declares a CASL subject/action. No "authenticated but unauthorized" holes were found.
3. **OpenAPI is honest.** 416 operations in the snapshot match the code one-to-one. Only the metrics endpoint is hidden on purpose.
4. **Strict input contract.** `forbidNonWhitelisted` across the board.
5. **State transitions as explicit verbs.** Booking and program lifecycle use `PATCH /{id}/<verb>` instead of a free-form status field, which keeps invariants in handlers.
6. **Webhook hygiene.** Both webhooks verify signatures and are the only CSRF exemptions.
7. **Sensitive flows are throttled tightly.** OTP issuers 3/min, logins 5/min, refresh 10–20/min, AI credential tests and provider tests on low buckets.

---

## 4. Findings and risks

Ordered by impact. None is a confirmed vulnerability; they are design-level observations.

### 4.1 Duplicate client surface: `/public/me/*` vs `/mobile/client/*`

The website client and the mobile client expose the same capabilities under two prefixes with partially diverging shapes:

| Capability | Website | Mobile |
|---|---|---|
| Profile | `GET/PATCH /public/me` | `GET/PATCH/DELETE /mobile/client/profile` |
| Bookings | `/public/me/bookings/*` (6) | `/mobile/client/bookings/*` (8, adds `rate`, `join`) |
| Payments init | `/public/payments/init` | `/mobile/client/payments/init` + native variants |
| Invoices | `/public/me/invoices`, `/public/invoices/{id}` | `/mobile/client/payments/invoices/{id}` |
| Packages | shared controller (`['mobile/client/packages','public/me/packages']`) | same |
| Programs enroll | `/public/programs/{id}/enroll` | `/mobile/client/programs/{id}/enroll` |

Consumers today: `packages/api-client` references `public/me` (7 files); the mobile app references `mobile/client` (18 files) and never `public/me`. The packages controller already proves the dual-prefix pattern works. Consolidating the rest behind one `client/*` prefix (or the array-prefix trick) would remove roughly 25 duplicated operations and one class of drift bugs (features that exist on mobile but not web, e.g. `rate`, `join`, account deletion).

### 4.2 `@Public()` + `ClientSessionGuard` double decoration

Client-owned controllers are `@Public()` at class level solely to skip the staff `JwtGuard`, then re-protected by `ClientSessionGuard`. This is correct but fragile: a new client route added to a `@Public()` class without the guard is silently anonymous. Two defensive options:

- Make `JwtGuard` strategy-aware (accept either staff or client token, then let a `@ClientOnly()` / `@StaffOnly()` decorator restrict), or
- Add a lint/test that asserts every method in a class decorated `@Public()` under `api/mobile/client` and `api/public/me*` carries `@UseGuards(ClientSessionGuard)`.

Current audit: all 22 `ClientSessionGuard` usages are at class level, so no route is currently exposed. The risk is forward-looking.

### 4.3 `Setting` subject is too coarse

67 permission checks collapse onto `Setting`. Granting a receptionist `Setting:read` to see booking settings also exposes AI provider config, Moyasar config (masked), SMS/email provider settings, and media. Splitting into at least `Setting`, `ProviderConfig` (AI/SMS/Email/Zoom/Moyasar), `Catalog` (services/packages/families), and `Content` (home cards, intake forms, media) would make role design meaningful. This touches the Critical auth tier and needs owner approval before any change.

#### Setting subject split

Status: implemented (owner-approved), with zero change in effective access for every existing role.

The 67 `Setting` checks under `apps/backend/src/api/dashboard` now use 5 subjects. Actions are unchanged; 54 decorators moved and 13 stay on `Setting`.

| Subject | Routes | Count |
|---|---|---|
| `ProviderConfig` | AI provider config (+ test, models), SMS and email provider settings (+ test), Moyasar config (+ test), platform integrations | 15 |
| `Refund` | Payment refund, package purchase refund, refund approve and deny (still `manage`) | 4 |
| `PersonalData` | SMS deliveries, contact messages (list, status), delivery logs, intake form responses | 6 |
| `Content` | Knowledge base, chatbot config, email templates, mobile home cards, media, intake form definitions | 29 |
| `Setting` (kept) | Organization settings, booking settings, business hours and holidays, discount reasons | 13 |

- Catalog: `SETTING_SPLIT_SUBJECTS` in `packages/shared/constants/permissions-catalog.ts`. `ADMIN` and `OWNER` built-in rules get `manage` on the four new subjects.
- Data migration: `20261013000000_expand_setting_permission_subjects`. It copies every stored `Setting` permission row (custom and system roles) onto the four new subjects. It is additive-only and idempotent.
- Parity net: `src/api/dashboard/route-permission-parity.spec.ts` compares routes and built-in roles against `test/fixtures/route-permissions.baseline.json`, which was captured before the split. Never refresh that baseline.
- Deploy note: the migration must be applied before the new image starts; until it is applied, custom roles holding `Setting` lose access to the 54 moved routes. A pending migration blocks publication until it is separately authorized (see the deployment policy).

### 4.4 Guest chat has no dedicated throttle

`POST /public/chat/conversations/{id}/messages` and `.../retry` rely on the 300/min default. Each message can trigger an AI provider call, so this is a cost-exposure vector rather than a security hole. Conversation creation and handoff are also on the default bucket. A 10–20/min per-IP bucket on these four routes would match the rest of the public surface.

### 4.5 Namespace inconsistencies (cosmetic, but they accumulate)

- Two chat namespaces on the dashboard: `/dashboard/comms/chat/conversations/*` (5 ops) and `/dashboard/conversations/*` (9 ops). The second is the reception inbox; the first looks like the earlier generation. Worth confirming which the dashboard still calls and deprecating the other.
- Zoom lives in `/dashboard/integrations/zoom`, while a generic integrations registry lives in `/dashboard/platform/integrations`. Moyasar lives under `/dashboard/finance/moyasar`, SMS/email under `/dashboard/comms/settings/*`, AI provider under `/dashboard/ai/provider-config`. Five homes for "provider credentials".
- `/dashboard/stats` and `/dashboard/top-performers` hang directly off the root while every other feature has a sub-prefix.
- `/mobile/auth/request-email-verification` requires a session but sits among anonymous auth routes.
- Verb style mixes `PATCH /{id}/verb` (bookings) with `POST /{id}/verb` (conversations, mobile employee bookings). Pick one; `POST` for non-idempotent transitions is the more common convention.
- Invoice PDF: `GET /dashboard/finance/invoices/{id}/pdf` returns a receipt URL, `POST` on the same path renders a statement. Overloading one path with two meanings by verb is surprising.

### 4.6 Hard-delete endpoints

Four routes permanently delete business data: `DELETE /dashboard/bookings/{id}` (terminal only), `DELETE /dashboard/people/clients/{id}`, `DELETE /dashboard/people/employees/{id}`, `DELETE /dashboard/identity/users/{id}`. Services, packages and families archive instead. Confirm the people/identity deletes are soft or blocked when financial history exists; the summaries do not say.

### 4.7 Legacy wording in the single-tenant codebase

Swagger summaries still say "for this organization", "org-unique singleton", "owner-scoped". Harmless, but they contradict the single-tenant charter and will confuse the next reader of the OpenAPI file.

---

## 5. Recommended next steps (no code changed by this analysis)

1. **Decide the client-surface strategy** (§4.1): either adopt the array-prefix pattern everywhere or pick one canonical prefix and alias the other for one release.
2. **Add a guard-coverage test** (§4.2): cheap, prevents a future anonymous client route.
3. **Throttle guest chat** (§4.4): four `@Throttle` decorators, low risk.
4. **Owner decision on splitting `Setting`** (§4.3): Critical tier, needs explicit approval and a permissions migration plan.
5. **Namespace cleanup backlog** (§4.5): track as tech debt; do it alongside the next dashboard refactor to avoid a standalone breaking change.
6. **Scrub multi-tenant wording** from Swagger summaries and regenerate `openapi.json` via `pnpm openapi:sync`.

---

## Appendix — regeneration

The counts in this document come from parsing `apps/backend/openapi.json` and grepping `apps/backend/src/api/**/*.controller.ts`. After any endpoint change, run `pnpm openapi:sync` and re-derive the numbers; this file is a snapshot, not a live view.
