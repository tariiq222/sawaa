# Sawa Backend — Full Audit Report

**Date:** 2026-06-21
**Scope:** `apps/backend` (NestJS 11, Prisma 7, Postgres, Redis, MinIO, BullMQ)
**Methodology:** 40 parallel read-only audit agents dispatched across 11 domains
**Mode:** Report only — no code changes
**Deployment mode:** Single-tenant (no `organizationId` filters in Prisma)

---

## Executive Summary

| Indicator | Count |
|---|---|
| **P0 (Critical, owner-only)** | **53** |
| **P1 (High)** | **92** |
| **P2 (Medium)** | **78** |
| **P3 (Low / hardening)** | **41** |
| **Total findings** | **264** |

**Overall verdict:** `HAS_GAPS` to `BROKEN` on several critical paths (payments, communications, cross-cluster events). The DB-side transaction layer is sound; the event-side delivery is broken because the Outbox Pattern is used by only 2 of 15+ event publishers.

**Strengths:**
- DB-level integrity is excellent (EXCLUDE constraints, CHECK constraints, partial unique indexes, FK enforcement)
- CASL authorization is structurally sound (global `APP_GUARD`, per-method `@CheckPermissions`, DB-sourced permissions, defense-in-depth wildcard filter, rank-gated role mutation, `tokenVersion` invalidation)
- Project pattern adherence is high (53/56 controllers have `@ApiTags` + `@ApiOperation`, 147/147 DTOs documented, 100% tag taxonomy compliance)

**Major risks:**
- **Money loss:** `ApproveRefund` without outstanding check + bank-transfer unit mismatch + commission has no persisted ledger (silently paying 100% commission)
- **Regulatory:** ZATCA placeholder VAT number (`300000000000003`) in real customer receipts = potential fines up to 50,000 SAR per violation
- **Data loss:** Outbox pattern used by 2/15+ publishers → events lost on crash between commit and publish
- **Security:** 3 P0-marked security handlers have no test coverage; XSS in email templates; XSS in cron alert emails

---

## 1. P0 Critical Issues (53)

### 1.1 Identity / Auth (8 P0)

| # | File:Line | Issue | Fix |
|---|---|---|---|
| 1 | `login/login.handler.ts:71-101` | Username enumeration via 3 different error messages + bcrypt timing oracle | Collapse to single `Invalid credentials`; always run dummy `bcrypt.compare` |
| 2 | `client-auth/client-logout.handler.ts:35` | Logout doesn't bump `Client.tokenVersion` (access JWT stays valid 15 min) | Add `tokenVersion: { increment: 1 }` |
| 3 | `identity/users/update-user.handler.ts:24-47` | No rank check — any user with `update:User` can edit ADMIN | Pass `actorUserId` and assert rank > target |
| 4 | `identity/users/deactivate-user.handler.ts:17-27` | Deactivation doesn't invalidate JWT or revoke refresh tokens | `tokenVersion: { increment: 1 }` + revoke in same tx |
| 5 | `identity/users/assign-role.handler.ts:31-35` | No `tokenVersion` bump → new permissions don't apply until JWT expiry | Bump `tokenVersion` |
| 6 | `identity/users/delete-user.handler.ts:17-23` | Hard delete with CASCADE → audit + booking history lost | Soft-delete + restrict hard delete to `isSuperAdmin` |
| 7 | Identity handlers | No audit log on any sensitive mutation (no `AuditEvent` table) | Create audit table + emit events |
| 8 | `jwt.strategy.ts:21-26` + `client-jwt.strategy.ts:27-41` | No algorithm pinning → RS256→HS256 confusion vulnerability | `algorithms: ['HS256']` |
| 9 | `otp/otp-session.service.ts:25-32` | `JWT_OTP_SECRET` falls back to `JWT_ACCESS_SECRET` | Throw on missing in prod |
| 10 | `employee-account/create-employee-account.handler.ts:56-72` | Privilege escalation: linking email to existing `User` silently upgrades role | Refuse to link non-CLIENT user; require `forceTakeOver=true` |
| 11 | `owner-provisioning/owner-provisioning.service.ts:22-87` | Dead code: no caller; no bootstrap for first admin | Wire to CLI seed or `OnModuleInit` |
| 12 | `employee-account/create-employee-account.handler.ts:79-87` | New employee created with `isActive=true` + caller-supplied password → no forced reset | `isActive=false` + send password setup token |

### 1.2 Payments / Finance (12 P0)

| # | File:Line | Issue | Fix |
|---|---|---|---|
| 13 | `init-client-payment.handler.ts:75-82` | **Orphan payment on retry**: hard-DELETE prior PENDING row before webhook can land | Void-prior-then-UPDATE (call Moyasar void API) |
| 14 | `moyasar-webhook.handler.ts:238-259` | `WebhookEvent` dedup INSERT before mutation → transient failure permanently drops webhook | Move INSERT inside try block |
| 15 | `init-client-payment.handler.ts:108` + `moyasar-api.client.ts:206` | `method: 'APPLE_PAY'` silently downgraded to card | Wire method switch to `source.type` |
| 16 | `init-client-payment.handler.ts:103-113` | Idempotency-key race → 500 (P2002 unhandled) | try/catch P2002 → 409 |
| 17 | `moyasar-webhook.handler.ts:537-549` | `toTerminalStatus` returns `null` for `'refunded'` → refund webhooks silently dropped | Add `case 'refunded': return REFUNDED` + emit `RefundCompletedEvent` |
| 18 | `moyasar-webhook.handler.ts:92-100` | No timestamp window / replay protection | Reject `|now - created_at| > 5 min` |
| 19 | `payment-state-machine.ts` vs `moyasar-webhook.handler.ts:421-433` | State machine not used in 3 of 4 payment mutation paths | Helper `applyPaymentTransition(tx, paymentId, next, extraData)` |
| 20 | `refund-payment/approve-refund.handler.ts:35-186` | **Over-refund**: no outstanding balance check; admin can approve full refund after partial already paid | `SELECT FOR UPDATE` + `amount - refundedAmount` check |
| 21 | `approve-refund.handler.ts:36-64` | No `SELECT FOR UPDATE` → two simultaneous approvals both pass | `updateMany({where: {id, status: PENDING_REVIEW}})` |
| 22 | `get-payment-stats/get-payment-stats.handler.ts:50-64` | `PARTIALLY_REFUNDED` missing from stats; `refundedAmount` uses `_sum.amount` instead of `_sum.refundedAmount` | Fix aggregation |
| 23 | `bank-transfer-upload/bank-transfer-upload.handler.ts:65-71` | **Unit mismatch**: `cmd.amount` (SAR) compared to `Number(invoice.total)` (halalas) → every upload rejected in prod | Multiply by 100 or change DTO to halalas |
| 24 | `bank-transfer-upload/bank-transfer-upload.handler.ts` | No virus/malware scan on receipts | Add ClamAV via BullMQ |
| 25 | `finance/zatca/build-qr-tlv.ts:1-31` | No SHA-256 invoice hash, no previous-hash chain (PIH) | Add `computeInvoiceHash(canonicalXml, previousHash)` |
| 26 | `prisma/schema/finance.prisma:43-94` | Missing ZATCA fields: `invoiceCounter` (ICV), `invoiceHash`, `previousInvoiceHash`, `uuid`, `clearanceStatus`, `csid` | New additive migration |
| 27 | `invoice-pdf-renderer.service.ts:13` | `PLACEHOLDER_VAT_NUMBER = '300000000000003'` ships in real customer receipts | Refuse to render when `vatRegistrationNumber` is null |
| 28 | `finance.module.ts:85-87` | `CreateBundlePurchaseHandler` + `UseBundleHandler` are dead code with unsafe state writes (`paidAt: now()` before Payment exists) | Wire or remove |

### 1.3 Bookings (12 P0)

| # | File:Line | Issue | Fix |
|---|---|---|---|
| 29 | `cancel-group-session/cancel-group-session.handler.ts:13-39` | **Group session cancel does nothing to child bookings, refunds, or notifications** | Cascade: cancel bookings + refund + notify enrolled clients |
| 30 | `create-group-session/create-group-session.handler.ts:13-62` | No employee overlap check; no business hours / holidays / exceptions / breaks | Call `CheckAvailabilityHandler` before insert |
| 31 | `public/book-group-session.handler.ts:35-69` | No `BookingCreatedEvent` emitted → staff not notified | `tx.outboxEvent.create` inside transaction |
| 32 | `group-session/group-session-capacity.service.ts:33-53` | `GroupSessionStatus.FULL` never written; `FULL → OPEN` flip never happens | Full state machine |
| 33 | `dashboard/bookings.controller.ts:419-431` | Employee can mark own booking as no-show (conflict of interest) | Assert `booking.employeeId !== currentUserEmployeeId` |
| 34 | `no-show-booking/no-show-booking.handler.ts:21-23` | No grace period + no `checkedInAt === null` guard (cron enforces both) | Mirror cron predicates |
| 35 | `complete-booking/complete-booking.handler.ts:21-23` | No `checkedInAt !== null` prerequisite (cron enforces) | Require check-in first |
| 36 | `check-in-booking/check-in-booking.handler.ts:20-25` | No time window — can check-in 7 days early/late | Enforce `checkInWindowMinutes` |
| 37 | `expire-booking/expire-booking.handler.ts:56-60` | `tx.booking.update` unguarded → race with CONFIRM | `updateBookingAtomically` with status filter |
| 38 | `reschedule-booking/reschedule-booking.handler.ts:115-120` | Duration change leaves invoice subtotal/VAT/total stale | Emit `BookingRescheduledEvent`; finance subscriber re-prices |
| 39 | `expire-booking/expire-booking.handler.ts:55-100` | No Zoom teardown for expired ONLINE bookings | Mirror cancel-booking Zoom cleanup |
| 40 | `create-group-session/create-group-session.handler.ts:42-60` | No transaction + no advisory lock → two concurrent operators create overlapping sessions | `rlsTransaction.withTransaction` + lock |

### 1.4 Communications (8 P0)

| # | File:Line | Issue | Fix |
|---|---|---|---|
| 41 | `send-email/send-email.handler.ts:51-53` | **XSS in email templates**: `interpolate()` does raw `String.replace` with NO HTML escape | Per-context escaper; `{{var}}` → `escapeHtml()`; expose `{{{var}}}` for already-safe raw HTML |
| 42 | `send-push/send-push.handler.ts:18-20` | `catch` swallows error → dispatcher believes success | `throw err` |
| 43 | `send-push/send-push.handler.ts:12-15` | Silent skip when FCM unavailable | `throw ServiceUnavailableException` |
| 44 | `notification-channel/sms-channel.adapter.ts:14-17` | Silent drop when Authentica not configured → OTP codes vanish | `throw ServiceUnavailableException` |
| 45 | `send-notification/send-notification.handler.ts:31-114` | No user preference check, no per-recipient rate limit, no `isActive` check on recipient | `NotificationPreference` model + Redis token bucket + active-user gate |
| 46 | `events/on-booking-cancelled.handler.ts:46-52` | `payload.clientEmail` always undefined → email channel silently dropped | Enrich payload in publishers (look up `Client`) |
| 47 | `events/on-payment-failed.handler.ts:46` | Same pattern: `clientEmail` never set by publishers → email dropped | Same fix |
| 48 | `sms-dlr/sms-dlr.handler.ts:85-124` | Dedup INSERT before mutation → transient failure permanently drops DLR | `prisma.$transaction([webhookEvent.create, smsDelivery.updateMany])` |

### 1.5 Infrastructure / Cross-Cutting (9 P0)

| # | File:Line | Issue | Fix |
|---|---|---|---|
| 49 | `event-bus.service.ts:56-65` | **Outbox Pattern used by 2 of 15+ publishers** → 1-50ms crash window silently loses events | `Outbox.enqueue(tx, evt)` helper + interceptor that captures active tx |
| 50 | `cron-tasks/cron-tasks.service.ts:179` | Log says `→ DLQ` but no DLQ exists; failed jobs purged after 7d/500 cap | `CronDLQ` Prisma table + per-queue DLQ + replay UI |
| 51 | `event-bus.service.ts:60-65` | No DLQ for `domain-events` queue; 24h retention then silent purge | `domain-events-dlq` + admin replay endpoint |
| 52 | `cron-tasks.service.ts:201-212` + `authentica-balance-check.cron.ts:50-58` | **XSS in cron alert emails** via unescaped `${err.message}` interpolation into raw HTML | Route through `ops-cron-alert` template; apply `escapeHtml` |
| 53 | `media/upload-file.handler.ts:11-70` | No virus scan; only magic-byte check; PDFs/DOCX/XLSX pass with embedded JS/macros | ClamAV via sidecar + `ScanUploadedFile` BullMQ worker |
| 54 | `mobile/employee/clients.controller.ts:77-97` | `listMyClients` doesn't filter `deletedAt: null` → soft-deleted clients leak | Add `deletedAt: null` to both findMany and count |
| 55 | `people/employees/delete-employee.handler.ts:104` | Hard delete orphans history (no FK) | Soft-delete + `Employee.deletedAt` + emit `EmployeeDeactivatedEvent` |
| 56 | `ai/embed-document/embed-document.handler.ts` | No HTTP route → KB ingestion is dead code from API perspective | Add `POST /dashboard/ai/knowledge-base/embed` |
| 57 | `ai/prisma/schema/ai.prisma:34` | `DocumentChunk.embedding` has no `embeddingModel` column → silent corruption on `OPENAI_EMBEDDING_MODEL` change | Add `embeddingModel` + `embeddingDim` + migration |


---

## 2. P1 High-Importance Issues (92)

### 2.1 Bookings — Logic Gaps
- **Reschedule never re-prices** when duration changes → invoice subtotal/VAT/total stale
- **Admin reschedule bypasses `clientRescheduleMinHoursBefore`** (client path enforces, admin doesn't)
- **No `BookingRescheduledEvent`** → comms/finance/analytics blind to reschedules
- **Approve cancel listens to wrong event** (`finance.refund.completed` instead of `bookings.booking.cancelled`) → staff-approved cancellations never refund
- **Bundle siblings over-refund** on cancel
- **Walk-in booking subjected to `minBookingLeadMinutes`** — reception can't book "right now"
- **Timezone bug in `check-availability`**: `dateOnly = new Date(query.date).setHours(0,0,0,0)` misaligns holiday/exception lookups by one day in non-Asia/Riyadh deployments
- **No caching on availability hot path** (every wizard keystroke recomputes)
- **Waitlist + walk-in modules don't exist as separate slices** (waitlist dropped in migration `20260617000000`; walk-in is just `bookingType: WALK_IN` flag on generic `CreateBookingHandler`)
- **DEPOSIT_PAID missing from DB EXCLUDE constraint** (in app but not in migration)
- **`create-group-session` employee overlap** (DB constraint exempts GROUP)
- **`GroupSessionStatus.FULL` dead column** + no `FULL → OPEN` flip
- **2 bundle-purchase paths diverge** (duplicate check, `quantityTotal`, COMPLETED transition)
- **`BundlePurchase.expiresAt` dead column** (no writer, no cron)
- **Approve cancel publishes `BookingCancelledEvent`** (comm subscriber renders "your booking was cancelled" for system expiry — factually wrong)
- **No Zoom teardown in expire-booking** for ONLINE bookings

### 2.2 Payments / Finance
- **State machine bypassed** in 3 of 4 payment mutation paths
- **Approve refund without `SELECT FOR UPDATE`** (concurrent approval race)
- **Anti-spoof amount check racy** with `ProcessPaymentHandler` in webhook
- **`markWebhookEvent` swallows DB errors** (dedup row deadlocks; legitimate retries return `duplicate`)
- **No secret rotation** for Moyasar `webhookSecret` (single column, rotating drops in-flight signed webhooks)
- **`verify-payment` bypasses deposit rule** (no `assertDepositPaymentAmount`)
- **No `RefundCompletedEvent` consumer** → client never gets refund receipt
- **No commission ledger exists** (`Employee.commissionRate` defaults to **100%**; no `EmployeeEarning` model; refund doesn't reduce commission)
- **Deposit amount enforcement asymmetry**: manual path enforces, online webhook classifies only
- **Bank transfer upload no admin notification**
- **Apply coupon no `serviceIds` gate** (booking path enforces, finance path doesn't)
- **Apply coupon TOCTOU** + no advisory lock
- **No receipt expiry cron** (uploads sit at PENDING_VERIFICATION forever)
- **State machine spec only tests refund transitions** (5 tests; missing PENDING → COMPLETED, PENDING → FAILED, etc.)
- **Currency not validated outbound** to Moyasar
- **No bundle expiry enforcement**
- **No commission approval flow**
- **Tier rates not supported**
- **`FinanceInvoice.created` event has no in-cluster consumer**
- **Bundle-purchase state writes are unsafe** (`paidAt: now()` before Payment exists)

### 2.3 Communications
- **No HTML escape in email template `interpolate()`** → XSS vector for all templated emails
- **No idempotency on event handlers** → duplicate notifications + duplicate sends
- **No DLQ for `domain-events`** (permanently-failed events vanish)
- **Payload schema drift**: 6 of 8 handlers redeclare payload interfaces (publisher/consumer shape mismatches don't fail TypeScript)
- **Sentry coverage = 1 of 8** event handlers (only `on-booking-cancelled` captures)
- **5 of 7 publishers use direct `eventBus.publish` post-commit** (lost-event window)
- **FCM token-expiry errors swallowed** → dead tokens accumulate, FCM quota wasted
- **Two parallel chat schemas** (AI uses `chatSession`/`chatMessage`; staff handoff uses `chatConversation`/`commsChatMessage` — no bridge)
- **Contact form has no notification** (submissions sit silent)
- **`CreateChatMessageHandler` is dead code with unsafe signature** (sender forgery risk if wired)
- **No FCM token cleanup cron** (180-day stale tokens linger)
- **No size limit on chat messages** (1MB body breaks dashboard)
- **`ChatSession`/`ChatbotConfig` have no `archivedAt`**
- **No idempotency-key on email sends** (BullMQ retries re-deliver)
- **No `List-Unsubscribe` header** (Gmail/Yahoo 2024 requirement)
- **No bounce/complaint webhook** for email providers
- **No platform priority on FCM** (Doze + APNs default-priority throttling)
- **`LogActivity` writes are fire-and-forget** (audit gaps invisible)
- **No `NotificationPreference` model**
- **No dead-letter persistence** in `NotificationDeliveryLog`

### 2.4 Identity
- **No password history check for staff** (only clients)
- **PII (email, phone, name) stored plaintext** (only provider credentials are encrypted)
- **`tokenVersion` not bumped in deactivate / assignRole / removeRole**
- **Soft-deleted clients leak into employees' mobile views**
- **No hard-delete vs soft-delete for Employee** (asymmetric with Client)
- **Phone-dedup silently merges PII** (different identity lands on same record)
- **4 different phone regexes** for the same field
- **DTO spread directly into `prisma.employee.update`** (no field allowlist)
- **Ratings block delete** (PDPL Art. 17 violation path)
- **OTP rate-limiting missing windowed counter** → brute-forceable on 4-digit codes
- **OTP session silent fallback** to `JWT_ACCESS_SECRET`
- **4 different error messages in OTP verify** (info leak)
- **`request-mobile-login-otp` SMS-bombing vector** against verified users
- **`request-otp` no per-IP "distinct identifiers targeted per hour" cap**
- **JWT no issuer/audience binding** (cross-namespace token replay if secrets leak)
- **Bcrypt cost 10 for refresh tokens** (OWASP recommends ≥12)
- **Client token service issues with `tokenVersion ?? 0`** (if DB has non-zero at issue time, JWT is immediately rejected)
- **Client refresh handler does lookup AFTER `updateMany`** (deactivated user loses refresh token with no replacement)

### 2.5 AI
- **No per-user Throttle on mobile chat** (only dashboard has 20/min)
- **No embedding model versioning** (silent corruption on `OPENAI_EMBEDDING_MODEL` switch)
- **No "context-as-data" frame on custom prompts** (admin-authored prompts can re-open stored injection)
- **No input token guard** (long histories → 400 from OpenRouter)
- **No output validation / toxicity filter** (medical-clinic context)
- **No `maxLength` on embed content** (multi-MB POSTed)
- **No idempotency on embed-document** (duplicates forever)
- **No audit trail** (no `createdBy`, no events)
- **`NaN`/`Infinity` not validated** before `::vector` cast
- **Authentica fallback to loose phone regex** (accepts `+96612345678` without leading 5)
- **`MAX_HISTORY_MESSAGES = 20` is a count cap, not token cap** (huge histories)
- **`tokensUsed` never aggregated** (no cost metric, no budget alert)
- **KB context has no character cap**

### 2.6 Org-Config / Org-Experience
- **`set-business-hours` duplicate `dayOfWeek` → P2002** + no `endTime > startTime` validation
- **`delete-department` orphans categories** (no SetNull warning)
- **DIRECT-mode category price = 0** (free bookings + no way to set via category API)
- **No `createdBy` on knowledge documents** (no audit)
- **No `sourceType` enum in DB** (drift hazard)
- **No `embeddingModel`/`embeddingDim` on DocumentChunk**
- **Rating spoofing via dashboard DTO** (any user with `Booking:create` can rate any booking)
- **Intake answers stored raw** (stored XSS surface)
- **No DB unique on `(formId, bookingId)` in IntakeResponse** (racy `findFirst → create|update`)
- **No `SanitizeText` on organization free-text fields** (`aboutAr`, `privacyPolicyAr`, etc.)
- **Inconsistent delete strategy** (service/bundle soft-delete vs intake-form/discount-reason hard-delete)
- **`iconBgColor` no hex validation** (any 20-char string)
- **`BundlePriceService` silently caps percentage discount at 100** (masks bad inputs)
- **No soft-delete for branches/departments** (CASCADE danger)
- **No expiration handling** for `BundlePurchase.expiresAt` (dead column)
- **No `BundlePurchase` quantity cap** (promotional bundles can't be limited)
- **Testimonial anonymization ineffective for Arabic** (first 2 chars ≈ full name)
- **Phone required contradicts schema** (walk-in clients may have no contact info)
- **No row-level ownership check on client PII edits**
- **Email search via `contains + insensitive` enables staff enumeration**

### 2.7 Integrations / Platform
- **Zoom credentials accessed from booking handler** (cluster boundary violation — should go through `integrations/zoom/`)
- **Two Zoom provision paths race** (confirm-booking + payment-completed)
- **Zoom retries capped at 3** with no operator notification
- **No `NEEDS_ZOOM_RETRY` status** in `ZoomMeetingStatus` enum
- **Zoom meeting not cleaned up on expire** (cancel does, expire doesn't)
- **Problem reports have no notification** (admin must poll)
- **No `isActive` re-check on long-lived sessions** (deactivation only takes effect at token refresh)
- **Two encryption services for same data** (`ZoomCredentialsService` + `IntegrationCredentialsService`)
- **`IntegrationCredentialsService` falls back to `MOYASAR_ENCRYPTION_KEY`** (couples integration creds to payment master key)
- **`secret-crypto.ts` uses raw `PLATFORM_SETTINGS_KEY` with no HKDF** (no context binding)
- **`ZoomMeetingService.updateMeeting` queries outside transaction** (RLS hazard)
- **No Zoom webhook handler exists at all** in the codebase
- **`TestZoomConfigHandler` returns Zoom error messages verbatim** (info leak)
- **`GetSystemHealthHandler` and `Get/UpdateNotificationDefaultsHandler` are dead code**
- **`CreateProblemReportDto.reporterId` from body, not authenticated user** (admin impersonation)
- **No audit log for problem reports**

### 2.8 Infrastructure / Common
- **`CaslGuard` empty permissions → BUILT_IN fallback** (privilege escalation)
- **No `isActive` re-check on `CaslGuard`** (only on JWT strategy)
- **`SuperAdminGuard` / `InternalBearerGuard` / `IpAllowlistGuard` are dead code** (logic re-implemented inline in `metrics.controller.ts`)
- **`THROTTLER_DISABLED` kill-switch** has no production guard
- **Cron job race** (outbox-publisher sloppy lock window between SELECT and UPDATE)
- **BullMQ `concurrency: 1` default** across the board (slow consumer blocks all)
- **No PII sanitization in event payloads** (stored in Redis for 1h)
- **Cron email uses XSS-prone HTML** (raw `${err.message}` interpolation)
- **No circuit breaker on `CacheService`** (Redis outage floods logs)
- **Cron single worker drains 13 jobs sequentially**
- **Health endpoint leaks queue counts publicly** (unauthenticated `/health`)
- **Orphan-audit N+1 + full table scan** (millions of round-trips on Booking@5M)
- **Fire-and-forget `eventBus.publish` in upload** (file association lost on publish failure)
- **Cron name strings repeated as plain object keys** (typo = silent dead path)
- **Outbox publisher lock window sloppy** (separate UPDATE after `FOR UPDATE SKIP LOCKED`)
- **No `aggregateId` / `eventType` index on OutboxEvent** (event-sourced query patterns impossible)
- **Cron tier rate limits missing** (4 of 4 crons hit the same lock namespace)
- **Test: 3 P0-marked security handlers have NO tests**:
  - `lookup-user.handler.ts` (P0-12 enumeration prevention)
  - `refund-completed.handler.ts` (P0-15 Zoom teardown)
  - `use-bundle.handler.ts` (P0-16 concurrency fix is comment-only)
- **116 DTO specs are stub-only** (≤12 lines, just `expect(dto).toBeDefined()`)
- **282 spec files contain `it('should be defined')` as placeholder** (inflates "tests passed" signal)
- **No positive-path login e2e test** (only 401/400)
- **No property-based tests anywhere** (`fast-check` zero hits)
- **Test: smoke spec `< 1s` brittle for CI runners**


---

## 3. P2 Medium Issues (78) — Highlights

- **OpenAPI documentation gaps**:
  - 1 dashboard controller (`refunds`) missing `@ApiStandardResponses`
  - 4 public controllers missing `@ApiPublicResponses` (health, sms-webhooks, payment-webhook, invoices)
  - 16 GET-by-id endpoints without 404 documented
  - 43 schema properties without `description`/`example`
  - 2 paginated response shapes coexist (`{data, total, ...}` vs `{items, meta}`)
  - `verify-email` (Public) uses `@ApiStandardResponses` (advertises 401/403 for unauth endpoint)
- **Inconsistent throttler** (per-method vs global, additive behavior)
- **No PII sanitization in log fields** (log flood, data leak)
- **Storage key uses `Date.now()`** (collision risk on concurrent uploads)
- **Moyasar secret-key cache 5 min in-process** (slow key rotation across instances)
- **Magic-byte validator trusts caller `textMimes`** (HTML risk)
- **No soft-delete for branches/departments** (CASCADE danger)
- **No bundle quantityTotal enforcement** (drift between two create paths)
- **No audit log for staff actions**
- **No event for refund receipt email** to client
- **Health endpoint returns queue counts without auth** (info disclosure)
- **EmailChannelAdapter signature mismatch** with `NotificationChannel` interface
- **No idempotency on `coupons` create/update** (TOCTOU on uniqueness check)
- **Inconsistent i18n** (Arabic vs English error messages mixed in handlers)
- **Dead code in module wiring** (`CreateBundlePurchaseHandler`, `CreateChatMessageHandler`, `GetSystemHealthHandler`)
- **No SanitizeText decorator** (escapeHtml manually used inconsistently)
- **Cron names as plain string object keys** (typo = silent dead path)
- **Cache invalidation not cross-slice** (e.g., business-hours cache not invalidated on branch delete)
- **No `aggregateId` / `eventType` index on OutboxEvent**
- **No partial unique index for "unconsumed OTP per (identifier, purpose)"** (race window)
- **Outbox event for `BookingRescheduled` missing** → finance can't re-price
- **Inconsistent event-payload conventions** (some `organizationId?`, some required)
- **BundlePurchase.quantityTotal set from `bundle.items.length` not `bundle.quantityTotal`**
- **No bundle sale-cap** (promotional bundles can't be limited)
- **No audit log on `coupons` redemption**
- **No retention policy for `IntakeResponse`** (PII medical history)
- **No `bundle_purchase.status` → COMPLETED transition** in `create-bundle-booking`
- **Auto-complete cron and manual endpoint diverge** (cron filters `checkedInAt != null`; handler doesn't)
- **Booking creation `bookingType: WALK_IN` skips `ServiceBookingConfig` validation** (intentional but undocumented)
- **Two `RefreshTokenDto` definitions** (one in `refresh-token/`, one in `client-auth/`)

---

## 4. P3 Low / Hardening (41) — Highlights

- **`CLAUDE.md` claims out of sync**:
  - `infrastructure/mail/PlatformMailerService` doesn't exist there (only FCM)
  - `bilingualLayout()` doesn't exist
  - `escapeHtml()` claim is not implemented on the send path
  - `MailModule` (`infrastructure/mail/`) is actually a push-notification module
- **No tests for `ApproveCancel` + `RejectCancel` + `RequestCancel` handlers**
- **No real-DB e2e fallback** (Testcontainers)
- **No tests for `set-business-hours`, `add-holiday`, `set-employee-breaks`**
- **No tests for `EmployeeOnboarding` 4-step flow**
- **No tests for `create-bundle-purchase` + `list-client-bundle-purchases` + `get-payment`**
- **No tests for `get-client-booking` ownership check** (only auth boundary for client surface)
- **No tests for `get-public-availability-days` `silentOnMissingConfig`**
- **Inconsistent i18n error messages** (handlers mix Arabic and English)
- **Zombie enum value** `BookingStatus.PENDING_GROUP_FILL` (defined, asserted in tests, never produced)
- **`BundlePurchase.expiresAt` dead column** (no writer, no cron)
- **`APPROVED` refund status dead** (defined, never set)
- **`IN_APP` enum unused** (in-app has its own table)
- **`DeliveryChannel.providerName` + `senderActor` never populated**
- **Inconsistent error message language** (HttpExceptionFilter should render one locale)
- **`RecurringBooking` dropped but enum still referenced**
- **`thumbnail` mime not in magic-byte allowlist**
- **Inconsistent test mock patterns** (proxy-tx vs separate-tx vs real-tx mock)
- **Inconsistent e2e bootstrap** (mocked + real-DB, no Testcontainers fallback)
- **Inconsistent handler instantiation** (`Test.compile()` vs direct `new` constructor)
- **Inconsistent date source** (`Date.now()` vs injectable clock)
- **Dead helper `*Validator.spec.ts`** in some modules
- **`thumbnail` no max file size** (uses global 10MB instead of avatar 1MB)

---

## 5. Summary by Cluster

| Cluster | P0 | P1 | P2 | P3 | Verdict |
|---|---|---|---|---|---|
| **Identity** (8 agents) | 8 | 21 | 11 | 3 | `HAS_GAPS` (privilege escalation paths, PII unprotected) |
| **Bookings** (8 agents) | 9 | 24 | 18 | 5 | `BROKEN` on cancel-group-session and DEPOSIT_PAID expire cron |
| **Finance** (8 agents) | 12 | 23 | 21 | 6 | `BROKEN` on bank-transfer + refund + ZATCA |
| **Comms** (5 agents) | 8 | 14 | 12 | 8 | `BROKEN` on email XSS + silent drop + no outbox |
| **AI** (2 agents) | 0 | 9 | 7 | 4 | `HAS_GAPS` (embed model versioning, KB ingestion dead) |
| **Org-Config / Experience / People / Integrations** (5 agents) | 5 | 14 | 18 | 9 | `HAS_GAPS` (soft-delete missing, PII exposed) |
| **Infrastructure / Common** (3 agents) | 7 | 11 | 13 | 8 | `BROKEN` (outbox missing, DLQ missing, XSS in cron emails) |
| **Cross-cutting (API docs + tests)** (2 agents) | 4 | 6 | 8 | 4 | `HAS_GAPS` |
| **TOTAL** | **53** | **92** | **78** | **41** | **264** |

---

## 6. Cross-Cutting Critical Themes

### 6.1 Outbox Pattern — Partial Adoption
- **Used** in 2 handlers only: `create-booking`, `create-bundle-booking`
- **Missing** in 11+ handlers: `cancel-booking`, `expire-booking`, `confirm-booking`, `moyasar-webhook`, `refund-payment`, `process-payment`, `verify-payment`, `approve-cancel-booking`, `reject-cancel-booking`, `request-cancel-booking`, `client-cancel-booking`
- **Impact:** Crash between commit and publish silently loses the event. Three expensive crons (`booking-autocomplete`, `reconcile-payments`, `reconcile-refunds`) exist to compensate.

### 6.2 No Dead Letter Queue (DLQ)
- `cron-tasks.service.ts:179` log line promises DLQ; no DLQ exists
- `event-bus.service.ts:60-65` 24h retention then silent purge
- `bull-mq.service.ts:17` 7d/500 cap then silent purge
- Failed events/jobs invisible to operators

### 6.3 ZATCA Compliance — 0% Phase 2
- No SHA-256 invoice hash
- No previous-hash chain (PIH)
- No UBL 2.1 XML
- No CSID storage
- No Clearance/Reporting API
- **Placeholder VAT number (`300000000000003`) ships in real customer receipts = regulatory violation**
- Fines up to 50,000 SAR per violation

### 6.4 Commission Ledger — Does Not Exist
- `Employee.commissionRate` defaults to **100%**
- No `EmployeeEarning` model
- No writes in `complete-booking` or `payment-completed`
- Dashboard shows projection, not source of truth
- Refund doesn't reduce commission
- **Critical for any payroll**

### 6.5 Encryption Primitives — 3 Parallel Implementations
- `EncryptedCredentialsBase` (canonical) — HKDF + AES-256-GCM + AAD + self-healing legacy fallback
- `IntegrationCredentialsService` (parallel) — same pattern but no shape validation; falls back to `MOYASAR_ENCRYPTION_KEY`
- `secret-crypto.ts` (parallel) — raw hex, no HKDF, no AAD, no shape validation

### 6.6 Tests on P0-Security Handlers — 0
- `lookup-user.handler.ts` (P0-12 enumeration prevention) — **NO SPEC**
- `refund-completed.handler.ts` (P0-15 Zoom teardown) — **NO SPEC**
- `use-bundle.handler.ts` (P0-16 concurrency fix is comment-only) — **NO SPEC**

### 6.7 OpenAPI Snapshot Coverage
| Metric | Value |
|---|---|
| Operations | 303 |
| Paths | 231 |
| Tags | 43 |
| Lines | 31,630 |
| DTOs with `@ApiProperty` | 147/147 (100%) |
| Controllers without `@ApiStandardResponses` | 1 (refunds) |
| Controllers without `@ApiPublicResponses` | 4 (health, sms-webhooks, payment-webhook, invoices) |
| GET-by-id without 404 documented | 16 |
| Schema properties without description | 43 |


---

## 7. Recommended Fix Order

### Phase 1: P0 — Week 1 (owner approval required)
1. **Implement Outbox Pattern uniformly** — `Outbox.enqueue(tx, evt)` helper that captures the active Prisma transaction. Resolves 5+ P0 issues.
2. **Fix `ApproveRefundHandler`** — `SELECT FOR UPDATE` + `amount - refundedAmount` outstanding check.
3. **Fix `init-client-payment`** — void-prior-then-UPDATE (call Moyasar void API).
4. **Fix `moyasar-webhook.handler.ts`** — timestamp window check, refund status in `toTerminalStatus`, transactional dedup.
5. **Fix `cancel-group-session`** — cascade cancel + refund + notify.
6. **Fix Identity issues** — tokenVersion bumping, logout bump, employee account email-linking guard, registration password reset, lookup-user race.
7. **Fix XSS in email templates** — per-context `escapeHtml` in `interpolate()`.
8. **Add virus scan in uploads** — ClamAV via sidecar.
9. **Fix `bank-transfer-upload` amount unit mismatch** — multiply by 100 or change DTO to halalas.
10. **Build DLQ for `domain-events` and crons** — per-queue/per-cron dead-letter table + admin replay UI.
11. **Add `tokenVersion` bump** in `deactivate-user`, `assign-role`, `remove-role`.
12. **Wire `refund` status in webhook** + emit `RefundCompletedEvent`.

### Phase 2: P1 — Weeks 2-3
1. **ZATCA Phase 1 minimum** (Hash, Counter, UUID) without XML/CSID.
2. **Refuse `PLACEHOLDER_VAT_NUMBER`** in PDF/receipt.
3. **Email idempotency-key** on all providers.
4. **State machine enforcement** in all trusted payment paths.
5. **Add events for outbox handlers** (event-driven cleanup of stale states).
6. **Idempotency on notification system** — `@@unique([recipientId, type, sourceEventId])` on `Notification`.
7. **Schema versioning for `DocumentChunk`** — add `embeddingModel` + `embeddingDim`.
8. **Add 3 P0-security handler tests** + replace 116 DTO stub tests with `class-validator` `validate()` assertions.
9. **Merge chat implementations** (mobile AI + dashboard staff) into one schema.
10. **FCM token cleanup cron** (180-day TTL).
11. **Add Commission ledger** (`EmployeeEarning` model + writes from `complete-booking` + reversal on refund).
12. **Move all event publishers to Outbox pattern** (eliminate the 1-50ms crash window).
13. **Reject placeholder ZATCA VAT number** at render time.

### Phase 3: P2 — Month 2
1. **ZATCA Phase 2** (CSID, Clearance, Reporting, signing).
2. **Refactor `infrastructure/mail/` → `infrastructure/push/`**.
3. **Replace 282 placeholder tests** with real assertions.
4. **Document all 4xx responses** in OpenAPI snapshot.
5. **Unify pagination shape** (`{items, meta}` everywhere).
6. **Add `Outbox.enqueue` helper** as a NestJS interceptor (capture active tx).
7. **Migrate dead modules to soft-delete** (branches, departments, employees).
8. **Add `SanitizeText` decorator** + apply to all free-text fields.

### Phase 4: P3 — Continuous
1. **Delete dead code** (`CreateChatMessageHandler`, `CreateBundlePurchaseHandler`, `UseBundleHandler`, `GetSystemHealthHandler`, dead guards).
2. **Update `CLAUDE.md`** to match reality (no `bilingualLayout`, no `PlatformMailerService` in `infrastructure/mail/`, etc.).
3. **Add Testcontainers** for real-DB e2e.
4. **Property-based tests** (`fast-check`) for halalas/SAR tripwire and state machine.
5. **Refactor `infrastructure/mail/`** to be push-only (rename to `push/` or `fcm/`).

---

## 8. Closing Notes

- **DB transactions are sound** — phase 3 + phase 4 migrations show real investment in integrity (EXCLUDE constraints, CHECK constraints, partial unique indexes, FK enforcement).
- **CASL authorization is structurally sound** — global APP_GUARD, per-method `@CheckPermissions`, DB-sourced permissions, defense-in-depth wildcard filter, rank-gated role mutation, `tokenVersion` invalidation. **No exploitable privilege escalation in current state** — gaps are in stale data and convention drift.
- **Project pattern adherence is excellent** — 53 of 56 controllers have `@ApiTags` + `@ApiOperation`, 147/147 DTOs documented, 100% tag taxonomy compliance.
- **Single biggest leverage point:** Standardizing the Outbox Pattern. It collapses 5+ P0 issues and demotes three expensive crons to defense-in-depth.
- **Single biggest money risk:** `ApproveRefund` without outstanding check + bank-transfer unit mismatch + no commission ledger (silently paying 100% commission).
- **Single biggest regulatory risk:** ZATCA placeholder VAT number in real customer receipts = fines up to 50,000 SAR per violation.
- **Single biggest test gap:** 3 P0-marked security handlers with zero test coverage + 282 placeholder tests masking real coverage weakness.

**Recommendation:** Address the 53 P0 issues over two weeks as a Linear epic, with explicit owner approval required for all changes touching Auth/Authorization/Payments/Migrations (per `AGENTS.md` Security Sensitivity Tiers).

---

## Audit Methodology

- **40 parallel agents** dispatched via `task` tool with `subagent_type: "general"`
- **Read-only** — no files modified
- **Each agent** received a focused, self-contained prompt with:
  - Specific files to audit
  - Project context (single-tenant, conventions from `AGENTS.md` / `CLAUDE.md`)
  - 4 categories to look for: المشاكل (problems), المقترحات (suggestions), التعارضات (conflicts), سلامة المنطق (logic integrity)
  - Required output format (structured report with file:line references)
- **Coverage map:**
  - **8 Identity** agents: login, logout/refresh, OTP, CASL/roles, client auth, JWT, user mgmt, registration
  - **8 Bookings** agents: create flows, cancel, lifecycle, reschedule, availability, state machine, group/bundle, Zoom
  - **8 Finance** agents: payments, state machine, refunds, coupons, invoices, commission, ZATCA, events
  - **5 Comms** agents: SMS/DLR, email/push, FCM/chat/contact, dispatcher, events
  - **2 AI** agents: chatbot, knowledge base
  - **5 Domain** agents: branches/hours, intake/branding/ratings, clients/employees, Zoom/platform, AI
  - **3 Infrastructure** agents: Prisma/migrations, guards/interceptors, event bus/queues
  - **2 Cross-cutting** agents: API docs/OpenAPI, test coverage
- **Synthesis:** All 40 reports aggregated and de-duplicated into this consolidated document.

---

**Report generated:** 2026-06-21
**Auditor:** OpenCode (40 parallel agents, read-only)
**File location:** `docs/audits/2026-06-21-backend-audit.md`
