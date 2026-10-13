# Client API Surface Unification — Analysis & Target Design

Status: implementation candidate under review (2026-10-13). The analysis below records the original design and branch evidence; current integration and verification are described in §10.
Scope: the two client-facing route families, `/public/me/*` + client-owned `/public/*` routes (website) and `/mobile/client/*` (Expo app).
Related: [API endpoint inventory](api-endpoint-inventory.md) §4.1.

---

## 1. Executive summary

The website and the mobile app are the **same actor** (an authenticated client) talking to the backend through **two different URL families, two sets of DTOs, and in several cases two different handlers**. The audit below shows this is not cosmetic duplication:

- The **same cancellation request produces different business outcomes** depending on which URL the client used (approval requirement, payment hold, reason persistence, coupon release, Zoom status).
- Mobile routes accept **weaker input validation** than web routes for the same profile fields.
- Mobile routes reuse **dashboard handlers and dashboard response DTOs**, with ad-hoc post-filtering to hide fields; web routes use purpose-built client handlers.
- Error semantics differ (`404` on web vs `403` on mobile for "not your booking / invoice"), which leaks resource existence on the mobile path.
- Throttling is inconsistent: booking creation and program enrolment are capped at 5/min on web and run on the 300/min default on mobile.
- Feature parity is broken in both directions (account deletion, rating, Zoom join, bank transfer, native pay only on mobile; refunds, chat, invoice list, receipt PDF, coupons only on web).

The ideal end state is **one audience-agnostic client API** (`/api/v1/client/*`) backed by **one client handler per use case**, with the channel carried as a **token claim** rather than a URL prefix, and the old prefixes kept as **aliases with a sunset date** until the mobile fleet has migrated.

---

## 2. Precise duplication map

Legend: handler names refer to `apps/backend/src/modules/...`. "Same" means both routes call the identical handler with equivalent arguments.

### 2.1 Profile

| Aspect | Website `GET/PATCH /public/me` | Mobile `GET/PATCH/DELETE /mobile/client/profile` |
|---|---|---|
| Read handler | `identity/client-auth/GetMeHandler` (explicit `select`, `deletedAt: null` filter) | `people/clients/GetClientHandler` (dashboard handler) wrapped in `withProvenEmailOnly()` |
| Read response | `ClientProfile` (client-shaped) | `ClientResponseDto` from `api/dashboard/dto/people-response.dto.ts` (dashboard-shaped, then post-filtered) |
| Update handler | `UpdateClientProfileHandler` | same |
| Update DTO | `UpdateClientProfileDto`: `@IsEmail`, `@IsUrl` on avatar | `MobileUpdateProfileBody`: `@IsString` only for `email` and `avatarUrl` |
| Delete account | **absent** | `RequestAccountDeletionHandler` |
| Email / phone change | folded into `PATCH /public/me` | dedicated OTP flows under `profile/email/*`, `profile/phone/*` |

Risks: the mobile read path depends on a dashboard DTO whose field set evolves for staff needs, not client exposure; any new field added for the dashboard is visible to clients unless `withProvenEmailOnly` is extended. The mobile update path lets a malformed e-mail or non-URL avatar through, so the same client record can be corrupted from one channel and not the other. Account deletion exists only where the app store requires it, which leaves web clients without a self-service exit.

### 2.2 Bookings

| Aspect | Website | Mobile |
|---|---|---|
| List | `GET /public/me/bookings` → `bookings/client/ListClientBookingsHandler` (`page`, `pageSize` default 10, `tab`) | `GET /mobile/client/bookings` → `bookings/list-bookings/ListBookingsHandler` (the 426-line **dashboard** list handler; `page`, `limit` default 20, `status`, `clientTab`) |
| Get one | `GET /public/me/bookings/{id}` → `GetClientBookingHandler` (`where: { id, clientId }` → **404**) | `GET /mobile/client/bookings/{id}` → `GetBookingHandler` (dashboard handler; finds by id then **403 "Not your booking"**) + manual `cancellationRefund` merge in the controller |
| Create | `POST /public/bookings` → `CreatePublicBookingDto` (`startsAt`, `bookingType`, `couponCode`, optional `branchId`) → `CreatePublicBookingHandler` → `CreateBookingHandler`; throttle **5/min** | `POST /mobile/client/bookings` → `MobileCreateBookingDto` (`scheduledAt`, no coupon, required `branchId`) → `CreateBookingHandler` with `source: 'ONLINE'`; throttle **default 300/min** |
| Cancel | `PATCH .../cancel` → `ClientCancelBookingHandler` with `legacyChannel = 'PUBLIC'` | `PATCH .../cancel` → same handler with `legacyChannel = 'MOBILE'`, plus a `reason` enum the web DTO lacks; response shape is `{ ...booking, ...result }` (flattened) vs `{ status, booking, requiresApproval, refund }` on web |
| Cancellation preview | `ClientCancellationPreviewHandler(id, clientId)` → channel `PUBLIC` | same handler, channel `MOBILE` |
| Reschedule | `ClientRescheduleBookingHandler` | same (identical) |
| Rate | **absent** | `POST .../rate` → `SubmitRatingHandler` |
| Zoom join | **absent** (website renders `zoomJoinUrl` from booking detail if already present) | `GET .../join` → lazily creates the meeting via `CreateZoomMeetingHandler` |
| Booking invoice | `GET /public/me/bookings/{id}/invoice` → `GetBookingInvoiceHandler` | **absent** (mobile reads `/mobile/client/payments/invoices/{id}` by invoice id) |

**The channel-dependent business logic** lives in `bookings/client/client-cancellation-policy.ts` and `client-cancel-booking.handler.ts`. With the configurable policy disabled, the legacy path diverges by channel:

| Rule | `PUBLIC` (web) | `MOBILE` (app) |
|---|---|---|
| Requires staff approval when cancelling late | yes (`channel === 'PUBLIC' && !early`) | no |
| Payment hold for `AWAITING_PAYMENT` / `PENDING_GROUP_FILL` | no | yes |
| `cancelReason` enum persisted | no | yes |
| Coupon released on cancel | no | yes |
| Zoom meeting marked `CANCELLED` | no | yes |
| Status-log reason | free text or `CLIENT_CANCEL` | enum |

The same client with the same booking therefore gets a different approval requirement, a different refund path, and different side effects depending only on which device they picked up. Reception also sees inconsistent audit data. This is the single most important reason to unify.

### 2.3 Payments & invoices

| Aspect | Website | Mobile |
|---|---|---|
| Invoice get | `GET /public/invoices/{id}` → `GetPublicInvoiceHandler` (`where: { id, clientId }` → 404) | `GET /mobile/client/payments/invoices/{id}` → `GetInvoiceHandler` (dashboard handler → 403) |
| Invoice list + outstanding balance | `GET /public/me/invoices` | **absent** |
| Receipt PDF (presigned) | `GET /public/invoices/{id}/pdf` | **absent** |
| Payments list | **absent** | `GET /mobile/client/payments` → `ListPaymentsHandler` (dashboard handler) |
| Moyasar init (invoice) | `POST /public/payments/init`, throttle 5/min | `POST /mobile/client/payments/init`, `returnTo: 'MOBILE'`, throttle 3/min |
| Moyasar init (package) | `POST /public/payments/package-purchases/init` | `POST /mobile/client/payments/package-purchases/init` (same handler) |
| Native pay (config / init / reconcile / package) | **absent** | 4 routes |
| Bank transfer upload + settings | **absent** | 2 routes |
| Payment methods capability | `GET /public/payments/methods` (anonymous) | consumed by mobile too |
| Refund request | `POST /public/refunds/request` | **absent** |

`returnTo: 'MOBILE'` is the one legitimate channel dependency in this cluster: Moyasar needs a callback URL that differs per surface. Everything else is incidental.

### 2.4 Packages, programs, chat, notifications

| Capability | Website | Mobile | Notes |
|---|---|---|---|
| Packages (purchases list/get, book credit) | `/public/me/packages/*` | `/mobile/client/packages/*` | **Already one controller** with `@Controller([...two prefixes])`. Proof the alias pattern works in this codebase. |
| Program enrol | `POST /public/programs/{id}/enroll`, throttle 5/min | `POST /mobile/client/programs/{id}/enroll`, default throttle | identical handler and arguments |
| Client chat (11 routes) + guest chat | `/public/me/chat/*`, `/public/chat/*` | **absent** on the server side for mobile | the app has a chat screen; it is not wired to these routes today |
| Notifications list / unread / mark-read / FCM | **absent** | 5 routes | device-specific, legitimately mobile-only except list/unread/mark-read |
| Portal aggregates (home, summary, upcoming) | **absent** | 3 routes | screen-shaped reads; fine to keep as a mobile BFF layer |

### 2.5 Transport and cross-cutting differences

| Concern | Website | Mobile |
|---|---|---|
| Token delivery | `httpOnly` cookie `client_access_token` | `Authorization: Bearer` |
| Guard | `ClientSessionGuard` (strategy tries cookie first, then bearer) | same guard |
| CSRF | enforced on `/api/v1/public/*` except webhooks | **bypassed for the whole `/api/v1/mobile` prefix** (`common/middleware/csrf-policy.ts`) |
| Session claim for channel | none | none |

Because the strategy accepts both transports on every route, **nothing stops the website from calling `/mobile/client/*` with its cookie today**, and if it did, the request would skip CSRF protection entirely. Likewise the app can already call `/public/me/*` with a bearer token. The URL prefix is therefore neither an authentication boundary nor a reliable channel signal; it is only a CSRF-policy switch, and that is the wrong place for such a switch.

### 2.6 Consumer footprint (what has to move)

| Consumer | References | Where |
|---|---|---|
| Website via `packages/api-client` | 7 source files (`me.ts`, `chat.ts`, `package-families.ts`, `payments.ts`, …) | all behind one `apiRequest` helper |
| Mobile | 18 source files under `apps/mobile/services` and screens | all behind one Axios instance in `services/api.ts` |
| Backend tests referencing either prefix | 31 spec/e2e files | `apps/backend/src`, `apps/backend/test` |
| Mobile tests | 7 files | hard-coded paths |
| Website / api-client tests | 5 files | hard-coded paths |

Both frontends centralise the base URL but hard-code the path per call, so a move is mechanical but touches every call site.

---

## 3. Why this is dangerous, ranked

1. **Divergent business rules keyed on URL** (§2.2 cancel table). Clients receive different refund/approval outcomes for identical facts. Reception receives inconsistent audit trails. Any future policy fix must be reasoned about twice and will drift again.
2. **Weaker validation on one channel** (§2.1). Data written through the app bypasses the e-mail and URL checks the web enforces.
3. **Dashboard handlers and DTOs exposed to clients** (`ListBookingsHandler`, `GetBookingHandler`, `GetClientHandler`, `GetInvoiceHandler`, `ListPaymentsHandler`, `ClientResponseDto`). These are shaped for staff. Field exposure is controlled by after-the-fact filtering in controllers, which is the opposite of the project's "no business logic in controllers" rule and will silently widen as the dashboard grows.
4. **Inconsistent authorization semantics** (404 vs 403). The mobile path confirms that a booking or invoice id exists before refusing it.
5. **Throttle gaps** on mobile booking creation and enrolment (300/min vs 5/min).
6. **CSRF policy coupled to prefix** (§2.5). A cookie-bearing request to a `/mobile/*` path is unprotected.
7. **Feature asymmetry** that users notice: no account deletion on web, no rating or lazy Zoom join on web, no refund request or receipt PDF in the app.
8. **Compounding cost**: every client feature is implemented, tested and documented twice (roughly 25 duplicated operations today, 31 backend test files pinned to prefixes).

---

## 4. Target design

### 4.1 Principles

- **One actor, one API.** A client is a client regardless of device. Routes live under a single prefix, `/api/v1/client/*`.
- **Channel is a fact about the session, not about the URL.** The login flow stamps a `channel` claim (`web` | `ios` | `android`) into the client access token. Handlers that genuinely need it (Moyasar `returnTo`, push targeting, analytics) read it from the session object. No handler receives a `legacyChannel` string from a controller.
- **Business rules are channel-free.** The cancellation policy has exactly one set of rules, chosen by the owner (§6, decision A). If a rule must differ, it differs on a business fact (payment status, time to session), never on device.
- **Client handlers only.** Everything under `api/client/` injects handlers from `modules/<cluster>/client/` (or purpose-built equivalents). No dashboard handler, no dashboard DTO, no post-filtering in controllers.
- **Explicit response DTOs.** Each read returns a `Client*Dto` with an allow-list of fields (`class-transformer` `@Expose` + `excludeExtraneousValues`), so new dashboard fields never leak by default.
- **Uniform semantics.** Ownership failures return 404. Pagination uses `page` + `pageSize` everywhere. State transitions use one verb style (keep `PATCH /{id}/<verb>` to match the dashboard).
- **Guarding is declarative and testable.** A `@ClientRoute()` composite decorator (`applyDecorators(Public(), UseGuards(ClientSessionGuard), ApiBearerAuth(), ApiCookieAuth(), ApiStandardResponses())`) replaces the manual `@Public()` + `@UseGuards` pair. An architecture test asserts every controller file under `api/client/` uses it and nothing else under `api/` uses `ClientSessionGuard`.
- **CSRF keyed on transport.** The middleware enforces CSRF when a session cookie is present on a state-changing request, regardless of path, and skips it for bearer-only requests. The `/api/v1/mobile` prefix bypass is removed.
- **Throttle profiles, not ad-hoc numbers.** Three named profiles: `client-read` (120/min), `client-write` (20/min), `client-money` (5/min: booking create, enrol, payment init, package init, refund request). Applied per route via a small helper so web and app always match.

### 4.2 Route map (target)

```
/api/v1/client
├── profile                     GET PATCH DELETE
│   ├── email                   GET      (verification state)
│   ├── email/{request,verify,decline}        POST
│   └── phone/{request,verify}                POST
├── bookings                    GET POST
│   └── {id}                    GET
│       ├── cancellation-preview GET
│       ├── cancel              PATCH
│       ├── reschedule          PATCH
│       ├── rate                POST
│       ├── join                GET      (lazy Zoom create, both surfaces)
│       └── invoice             GET
├── invoices                    GET
│   └── {id}                    GET
│       └── pdf                 GET
├── payments                    GET
│   ├── init                    POST
│   ├── native/{config,init,{paymentId}/reconcile}
│   ├── bank-transfer           POST
│   └── bank-transfer/settings  GET
├── packages
│   ├── purchases               GET
│   ├── purchases/{id}          GET
│   └── book                    POST
├── package-purchases/init      POST
├── package-purchases/native/init POST
├── programs/{id}/enroll        POST
├── refunds/request             POST
├── notifications               GET
│   ├── unread-count            GET
│   ├── mark-read               PATCH
│   └── fcm-token               POST DELETE   (no-op/400 for web channel)
├── chat/...                    (today's /public/me/chat routes, unchanged shape)
└── portal/{home,summary,upcoming} GET  (mobile BFF reads; harmless for web)
```

Anonymous discovery (`/public/services`, `/public/employees`, `/public/availability`, `/public/packages`, `/public/programs`, `/public/payments/methods`, guest chat, auth/OTP, webhooks) **stays under `/public`**. Only client-owned routes move.

### 4.3 Backend structure (target)

```
src/api/client/
├── profile.controller.ts
├── bookings.controller.ts
├── payments.controller.ts
├── invoices.controller.ts
├── packages.controller.ts
├── programs.controller.ts
├── notifications.controller.ts
├── chat.controller.ts
└── portal.controller.ts
src/modules/<cluster>/client/      ← one handler per use case, client-shaped DTOs in/out
src/common/auth/client-route.decorator.ts
src/common/middleware/csrf-policy.ts   ← transport-keyed
test/architecture/client-surface.spec.ts
```

`api/mobile/client/` and `api/public/me*`, `public/invoices`, `public/refunds`, the client-owned halves of `public/bookings`, `public/payments`, `public/programs` are deleted at the end of the migration. `api/mobile/auth/*` and `api/public/auth|otp` stay (login flows are legitimately different per surface today; unifying them is a separate, later decision).

### 4.4 Compatibility strategy

Mobile builds in the field cannot be force-upgraded, so the old URLs must keep working for a bounded period.

1. Every new controller declares all three prefixes during the transition, exactly as `MobileClientPackagesController` already does:
   `@Controller(['client/bookings', 'mobile/client/bookings', 'public/me/bookings'])`.
2. Requests arriving on a legacy prefix get `Deprecation: true` and `Sunset: <date>` headers plus a counter metric labelled by prefix (`client_api_legacy_prefix_total{prefix,route}`), exported on the existing `/public/metrics` endpoint.
3. Where legacy DTO field names differ (`startsAt` vs `scheduledAt`, `limit` vs `pageSize`, mobile cancel `reason` enum), the new DTO accepts both spellings for the alias period via `@Transform`, and the OpenAPI marks the legacy spelling deprecated.
4. Sunset when the legacy counter is zero for a full month or the owner-set date passes, whichever is later. Then the alias prefixes and the compatibility transforms are removed in one commit.

**Implemented mechanism** (`common/middleware/legacy-client-prefix.middleware.ts`, wired in `main.ts` after CSRF): requests under `/api/v1/mobile/client/*` and `/api/v1/public/me/*` get `Deprecation: true`, plus `Sunset: <HTTP-date>` when env `CLIENT_LEGACY_PREFIX_SUNSET` holds a valid date (invalid values are ignored with a one-time warning). On response finish the counter `sawaa_client_api_legacy_prefix_requests_total{prefix,route}` is incremented, where `prefix` is `mobile/client` or `public/me` and `route` is the Express route template (the prefix alone when no template matched). The unified `/api/v1/client/*` prefix is never marked. This is the counter named `client_api_legacy_prefix_total` in item 2 above.

---

## 5. Migration plan

Each phase is independently shippable through the normal develop → staging → manual acceptance path. Phases 1 and 3 touch owner-only tiers (payments, `create-booking`, cancellation and refund behaviour) and need explicit approval plus a Moyasar sandbox run before staging.

| Phase | Content | Risk | Owner approval |
|---|---|---|---|
| 0. Freeze & guardrails | Architecture test forbidding new routes under the old prefixes; `@ClientRoute()` decorator adopted by existing controllers (no behaviour change); transport-keyed CSRF with the old prefix bypass kept temporarily; throttle profiles applied to the mobile gaps. | low | no (CSRF change is High tier: scoped, additive) |
| 1. One truth per use case | Replace dashboard handlers on mobile routes with client handlers (list/get booking, get client, get invoice, list payments); unify profile DTO validation; unify error semantics to 404; decide and implement the single cancellation policy (decision A); `channel` claim added at login and read by Moyasar `returnTo`. | **high** (cancellation + payments) | **yes** |
| 2. New surface | Create `api/client/*` controllers with triple-prefix aliases, deprecation headers and metrics; add the missing capabilities to both surfaces (web: delete account, rate, join, bank transfer; app: invoice list, PDF, refund request). `pnpm openapi:sync`. | medium | yes for refunds/bank transfer wiring (payments tier) |
| 3. Move the web | Point `packages/api-client` at `/client/*`; website smoke + Playwright. Single deploy, instantly reversible. | low | no |
| 4. Move the app | Point `apps/mobile/services` at `/client/*`; ship an app release; watch the legacy counter. | low (aliases stay) | release approval as usual |
| 5. Sunset | Remove alias prefixes, compatibility transforms, `api/mobile/client/`, `api/public/me*`; regenerate OpenAPI; delete the legacy counter. | low | yes (irreversible for old app builds) |

### 5.1 Verification per phase

- Backend: contract test suite that runs the same request set against every alias prefix and asserts identical status, body and headers. Reuse existing 31 spec files by parameterising the prefix instead of rewriting them.
- Cancellation: table-driven tests over (early/late × paid/unpaid × channel) proving the outcome no longer depends on channel.
- Payments: Moyasar sandbox round-trip for invoice init, package init and native reconcile from both channels (callback URL must still land on the right surface).
- Web: `pnpm --filter=dashboard run e2e:smoke` is unaffected; website Vitest + Playwright for the account area.
- Mobile: `pnpm --dir apps/mobile typecheck` + existing Jest suites with updated paths; manual run on simulator against local backend for booking → pay → cancel → rate.
- OpenAPI: snapshot regenerated and committed in every phase.

---

## 6. Decisions required from the owner

| # | Decision | Recommendation |
|---|---|---|
| A | Which cancellation rule set is correct when the configurable policy is off: web (late cancel requires approval, no payment hold) or app (no approval, payment hold, reason persisted, coupon released, Zoom cancelled)? | Take the **app** side effects (reason, coupon release, Zoom cancel are all correct bookkeeping) and the **web** approval rule for late cancellations, and make approval a setting rather than a channel. |
| B | Ownership failures: 404 everywhere (hide existence) or 403? | 404. |
| C | Should web clients get account deletion? | Yes. Same handler, same retention statement. |
| D | New prefix name: `/client` or reuse `/public/me`? | `/client`. `public` is misleading for authenticated routes and `me` does not fit payments/packages. |
| E | Alias retention: fixed date or metric-driven? | Metric-driven with a floor of one full app release cycle. |
| F | Unify mobile and web login flows under `/client/auth` in a later phase? | Defer. Not needed for the goals above. |

---

## 7. What not to do

- Do not point the website at `/mobile/client/*` as a shortcut. It would silently remove CSRF protection from cookie sessions (§2.5).
- Do not add a `channel` query parameter or header that the client chooses. The claim must come from the token the server issued.
- Do not keep `legacyChannel` and simply pass the token claim into it. The goal is to delete the branch, not relabel it.
- Do not refactor `create-booking`, `refund-payment` or `moyasar-webhook` internals while doing this. Phase 1 only changes which handler the client routes call and the cancellation policy function; those three slices stay as they are unless the owner separately authorises it.

---

## 8. Risk review of the proposal itself (added 2026-10-12)

A second pass checked whether the proposed changes can break running clients. Findings and the corrections they force:

| Proposal element | Verified facts | Risk | Correction |
|---|---|---|---|
| Swap dashboard handlers for client handlers under the **existing** mobile routes (Phase 1) | `apps/mobile/services/client/bookings.ts` consumes `bookingType`, `employee{}`, `branch{}`, `service{}`, `zoomMeetingStatus`, `hasRated`, `cancellationRefund`, all produced by `booking-row.mapper.ts`. `ListClientBookingsHandler` returns a flat 19-field shape without them. | **High.** Shipped app builds cannot update; a shape change on the legacy prefix breaks them. | Legacy prefixes must keep their exact response shape until sunset. The unified handler returns a **superset DTO** (`ClientBookingDto` = union of both shapes, legacy-only fields marked deprecated). Handler swap happens only behind that DTO. |
| Zoom host URL exposure through dashboard mapper | `mapBookingRow` already nulls `zoomHostUrl` / `zoomStartUrl` unless `includeHostUrls` (P0-6). | None today. | Keep the mapper contract in the new DTO tests. |
| 403 → 404 on ownership failures | Mobile treats 401/403 as auth errors (`services/api.ts`, `query-client.ts`); 404 falls to generic not-found handling. | Low, and it removes a false "session invalid" path on old builds. | Proceed. |
| Transport-keyed CSRF | Mobile logs in through `/mobile/auth/*` (JSON tokens, no `Set-Cookie`); only `/public/otp/*` is used for password reset and returns a `sessionToken`. `csrfMiddleware` sets a `ck_csrf` cookie on every non-bypassed response; iOS XHR would echo it back. Website api-client already mirrors `ck_csrf` into `x-csrf-token`. | Medium if done wrong: keying on "any cookie" would make mobile bearer requests fail with `CSRF_INVALID`; adding `/client` to the bypass list would strip web protection. | Key the check on the **session cookie** `client_access_token` only. This change is a **prerequisite** of Phase 2, not optional. |
| `channel` claim in the client token | One issuer (`ClientTokenService.issue`) with 11 call sites; `ClientJwtStrategy` rebuilds the session from the DB, so the claim must be threaded into the session object; tokens issued before deploy lack it for up to one access TTL. | Low. | Default the claim from the refresh endpoint family during the alias period (`/mobile/auth/refresh` → mobile, `/public/auth/refresh` → web). No DB change. |
| Tighter throttle on mobile booking create / enrol | Mutations are not auto-retried; old builds show a generic error on 429. | Low. | Money profile fixed at 5/min (the website limit); Moyasar payment init keeps the stricter 3/min `payment` profile. |
| Single cancellation policy | `requireCancelApproval` already exists in settings, so decision A needs **no migration**. Behaviour change is visible to clients and to reception (approve/reject queue volume) and feeds `refund-payment`, an owner-only slice. | Medium, product-level not technical. | Owner decision A before Phase 1; table-driven tests; announce to reception. |
| Array-prefix aliases | Nest generates distinct operationIds per prefix (`[0]`, `[1]`); no collisions in the current snapshot. Adding a third prefix roughly triples the client section of `openapi.json` for the alias period. | Low; large diff, CI drift check requires committing it. | Accept; shrink again at sunset. |
| New controllers + backend coverage gate | Jest thresholds 65 % branch / 70 % fn / 85 % line. | CI fails if controllers land without specs. | Parameterise existing 31 spec files by prefix instead of writing new ones. |

Impact extent, by system:

- **Backend**: `src/api/` (new `client/` folder, later deletion of `mobile/client/` and `public/me*`), client handlers per cluster, `csrf-policy.ts`, `client-token.service.ts` + 11 issuers, `client-jwt.strategy.ts`, throttle helper, 31 spec files, `openapi.json`. **No Prisma migration in any phase.**
- **Website + `packages/api-client`**: 7 source files, 5 tests. The dashboard shares `api-client` but not the client modules, so it is unaffected.
- **Mobile**: 18 source files, 7 tests, one store release; old builds keep working only because legacy prefixes keep legacy shapes.
- **Dashboard**: no code change; reception sees unified cancellation behaviour; regenerated OpenAPI types change names for client routes the dashboard does not call.
- **Operations**: one new Prometheus counter, no new env vars, normal develop → staging → acceptance path per phase; the alias period spans at least one app release cycle.

---

## 9. Implementation status (2026-10-12, branch `task/client-api-unification`)

| Commit | Phase | Verified by |
|---|---|---|
| `bd8f32e4f` | 0 — guardrails, CSRF by transport, channel claim, throttle profiles | tsc, eslint, 9310 backend tests, OpenAPI zero diff |
| `3a5d4b3d0` | 1 — one handler per client use case, unified cancellation, `Setting` split (+ migration) | tsc, eslint, 9412 backend tests, 2393 dashboard tests, parity spec |
| `b56852a92` | 2 — `/api/v1/client/*` (54 operations), legacy prefixes as aliases | Nest boot (snapshot run), 3792 tests, surface spec |
| `8966dc6fc` | 3 — website on `/client` | api-client 146 tests, website typecheck |
| `d1d7079f5` | 4 — mobile on `/client` | mobile typecheck, 1825 tests |
| `fa85f3b3c` | review fixes, canonical envelopes | 1487 backend tests, 1829 mobile tests |

Still owed before «انشر» (owner-visible checklist):
1. Live smoke with local infra up: `scripts/dev/client-api-live-smoke.sh` (boots the branch build on port 5201; needs `pnpm docker:up`).
2. End-to-end on web and simulator: login → book → pay (Moyasar sandbox, both channels) → cancel (early and late) → rate → account closure on web.
3. Apply `20261013000000_expand_setting_permission_subjects` **before** the new image starts; a pending migration blocks publication until separately authorised.
4. Publish via `git push origin task/client-api-unification:refs/heads/publish/client-api-unification` and a merge-commit PR into `develop`; staging through `build-images.yml` only.
5. Sunset (Phase 5) only when `sawaa_client_api_legacy_prefix_requests_total` stays at zero for a month after the app release.
Known unrelated: 5 website test files fail on a clean checkout with a localStorage "reading 'clear'" environment error.

### 9.1 Live smoke evidence (2026-10-12, local docker infra, branch build on port 5201)

Unauthenticated: `/client/*` → 401 without a session; legacy prefixes → 401 with `Deprecation: true`; `/client/*` carries no Deprecation header; `/public/payments/methods` → 200 anonymously; cookie session without CSRF → 403 `CSRF_INVALID` on both `/client/bookings` and `/mobile/client/bookings` (gap closed); bearer without cookie bypasses CSRF and hits auth (401); Swagger exposes the 54 `/client` operations; `/public/metrics` → 401 without token.

Authenticated (review client, server-signed test tokens for both channels, deleted afterwards): all 13 `/client` reads → 200 with the canonical envelopes; profile keys identical across `/client/profile`, `/mobile/client/profile` and `/public/me` (17 keys, `email` null + `unverifiedEmail` set, no staff fields); cookie GET → 200; cookie PATCH without CSRF → 403, with double-submit token → 204, legacy mobile PATCH with cookie and no CSRF → 403; foreign booking/invoice ids → 404 on new and legacy routes; `pageSize=1000` → 400; `unreadOnly=false` → 200; `sawaa_client_api_legacy_prefix_requests_total` increments per legacy route and is exposed on `/public/metrics`.

Not yet exercised live: booking creation, Moyasar payment init/webhook (sandbox), cancellation with refunds, account closure, the website and the simulator end to end.

### 9.2 End-to-end live checks (2026-10-12, branch backend on 5200, local docker infra)

- **Mobile (Expo app from this branch, existing simulator build, Metro from the worktree):** password login via `/mobile/auth/password-login`, home/portal/notifications/bookings/packages reads all on `/client/*` (200), appointments list renders the canonical envelope through the service adapter, booking detail from `/client/bookings/:id` (uppercase enums normalised), cancellation preview + cancel from the UI → booking `CANCELLED` with `cancelReason = CLIENT_REQUESTED` persisted and the enum in the status log (unified rule set).
- **Booking creation:** `POST /client/bookings` with `payAtClinic: true` → 201 `CONFIRMED`, visible in the app list after refresh.
- **Website (Next dev server from this branch):** cookie login via `/public/auth/login`, account page reads `/client/profile`, `/client/bookings`, `/client/invoices` with CORS preflights; profile name update → `PATCH /client/profile` 200 with the double-submit CSRF token; verified email badge and phone rendered from the unified profile.
- Test data: one synthetic client (`smoke.client@sawaa-test.local`) and one cancelled booking (#9007) remain in the local dev database; credentials live only in the git-ignored `apps/backend/.local-smoke-client.json`.
- Still not exercised live: Moyasar card payment (sandbox), native pay, rating, account closure, package purchase. The website home page 500s locally because employee image URLs in the dev data point at `host.docker.internal`, unrelated to this branch.

### 9.3 Follow-up fixes verified on the simulator (2026-10-12)

- Success screen without an invoice (pay at center): cancelled booking → «لم يتم تأكيد الموعد»; confirmed booking → «تم تأكيد موعدك»; unreadable id (404) → «جاري تأكيد الموعد» with «تحقق مرة أخرى», never a false confirmation.
- Post-login redirect: `sawa://staff-login?redirect=/(auth)/email-entry` followed by a password login lands on the client home, not on the email-entry screen.
- Package purchase leave-before-response: not reproducible by hand (the local native init answers in ~400 ms with a Moyasar credential error); covered by the unit test that unmounts before the promise resolves.
- Website: pay-now hidden for cancelled bookings (unit-tested; not re-checked in the browser).


## 10. Integration candidate (2026-10-13)

`codex/client-api-integration` carries the client API, hand-written API client, website, and mobile changes forward from `task/client-api-unification` onto current develop. Existing practitioner login and package details → confirmation navigation are retained. Legacy client routes remain available.

Review corrections use allowlisted booking/portal projections, preserve mutation envelopes, rotate web phone-verification sessions through HTTP-only cookies, and return 404 for missing or foreign client resources. The API client endpoint manifest includes the new canonical calls. The local HTTP smoke now rejects non-owned endpoints and asserts status/header behavior rather than only printing responses.

The Setting permission split and its unchanged additive migration are isolated in `codex/settings-permission-split`. They are not prerequisites of this API candidate. Live migration execution needs separate owner authorization before that independent permission change can publish.

Original branch evidence in §9 is historical and does not establish acceptance of this integrated candidate. Fresh unit, types, real-database, isolated premerge and Moyasar Sandbox results are recorded with the PR candidate. Physical-device/native SDK, Apple Pay and owner staging acceptance remain separate checks. Alias removal is deferred.
