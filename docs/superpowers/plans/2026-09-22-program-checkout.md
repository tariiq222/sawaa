# Program Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox syntax for tracking.

**Goal:** Complete paid-program checkout and safe resumption without duplicate enrollment or premature success.

**Architecture:** Preserve existing enrollment, invoice and hosted payment endpoints. Make enrollment idempotently resumable under the program lock; add an existing-invoice mobile checkout; bridge mobile payment callbacks through a fixed website deep link. Server status remains the source of truth.

**Tech Stack:** NestJS/Prisma/PostgreSQL, Expo/React Native/React Query, Next.js, Jest/Vitest/Playwright.

**Spec:** `docs/superpowers/specs/2026-09-22-program-checkout.md`

## Global Constraints

- Worktree `/Users/tariq/.codex/worktrees/sawaa-program-checkout/sawaa`; HEAD `95cab4d05`.
- Integer halalas; default VAT 0; physical in-person services; existing Moyasar provider configuration; no auth/guard/credential/encryption/migration changes.
- Arabic-first existing design, client wording موعد. Preserve unrelated changes. No commits, pushes, merges or deployments.
- Mobile commands run via its separate workspace. Final evidence must distinguish local automated tests, real PostgreSQL integration, dashboard smoke, real Moyasar sandbox, and native-device Apple Pay.
- Three Luna high implementers own disjoint files. Parent Astra owns dependencies, generated contracts and final review/checks. Workers do not run full build/lint/typecheck/test suites, spawn agents, or change dependencies; focused tests for owned changes only.

### Task 1: Existing-invoice mobile checkout

**Target/ownership:** `apps/mobile/` payment/program screens, services, hooks, translations and their focused tests only; no dependency or lock changes.
**Change:** Correct `groups/[id].tsx` and `services/client/group-sessions.ts`, add `booking/checkout.tsx` and `booking/payment-callback.tsx`, a focused checkout state hook, and appointment recovery CTA. Existing individual checkout must retain compatible behavior. Read `apps/mobile/CLAUDE.md`.
**Interfaces:** consumes enrollment `{ type:'ENROLLED', bookingId:string, status:string, invoiceId:string|null }`; server returns existing active enrollment for repeats. Uses existing `/mobile/client/payments/init` and invoice/booking read endpoints. Produces deep link route `sawa://booking/payment-callback?bookingId=...&invoiceId=...` redirecting to `/(client)/booking/checkout` with those IDs. Callback source is not payment proof.

- [x] Write focused behavior tests before implementation: unpaid enrollment navigates to checkout rather than success; free enrollment remains immediate; missing invoice for paid enrollment is error; retry never calls booking creation; invoice paid with booking awaiting remains pending; completed payment plus confirmed booking succeeds; historical failure plus live/paid attempt not false failure; cancelled/expired booking is terminal; app foreground/recheck reloads authoritative state; appointment resume uses existing invoice.
- [x] Run owned failing tests with `pnpm --dir apps/mobile exec jest --runInBand <owned-test-paths>` and record red evidence.
- [x] Implement a reusable existing-booking checkout with server invoice total/currency, branch/program context when available, actual cancellation-policy link/statement if exposed (do not invent policy), single in-flight payment initiation, disabled duplicate taps, error/cancel recovery, finite polling with recheck, and app foreground refetch. Never interpret absent data/fetch error as paid. Avoid year-2999 dates. Use existing UI/translations; no dependencies.
- [x] Preserve invoice IDs for recovery through server appointment list/detail; no secret or payment token persistence. Use `WebBrowser.openAuthSessionAsync(redirectUrl, 'sawa://booking/payment-callback')`; on return or dismiss recheck. Do not auto-charge/reopen browser on re-mount.
- [x] Re-run only owned focused tests and report changed files, exact commands/counts, concerns, and self-review to the assigned report file. Parent performs final checks.

### Task 2: Idempotent program enrollment

**Target/ownership:** `apps/backend/src/modules/bookings/enroll-in-program/` handler and specs; add `apps/backend/test/e2e/bookings/program-checkout.real-e2e-spec.ts` if meaningful. Do not touch finance, controllers, generated files or mobile.
**Change:** Resume an existing active enrollment without creating another booking/invoice/seat. Read `apps/backend/CLAUDE.md`, current handler, expiry/cancellation handlers and program capacity service before editing.
**Interfaces:** preserve result `{ type:'ENROLLED', bookingId:string, status:BookingStatus, invoiceId:string|null }`. For the same client/program, resolve current enrollment inside existing program serialization before capacity/open-state rejection. Terminal/expired/inconsistent enrollments must not be presented as successful; keep established expiry cleanup semantics and avoid deadline extension. The runtime-discovered CSRF incompatibility also requires a native enrollment controller/module registration and focused HTTP test; no database schema or guard-policy change.

- [x] Add failing cases for active unpaid repeat returning original IDs even at full capacity; confirmed/free repeat; concurrent duplicate path rechecked under lock; unrelated client on full program still fails; expired/cancelled entry not resurrected; no duplicate min-reached event/invoice/booking/counter increment.
- [x] Run the owned handler spec to establish red via `pnpm --dir apps/backend exec jest --runInBand src/modules/bookings/enroll-in-program/enroll-in-program.handler.spec.ts`.
- [x] Implement the minimum transaction-safe change. Prefer one return contract and keep event publication only for newly-created enrollment. Handle races using existing program lock and explicit transaction-level duplicate lookup; preserve person reference locks and money math.
- [x] Add a real PostgreSQL concurrency test for two calls from the same client and capacity count using real handler/transaction, synthetic records, existing test patterns. Parent will run DB tests; no external provider calls or full suites.
- [x] Re-run owned focused handler spec and report red/green evidence, actual diff, exact counts and edge cases.

### Task 3: Native return bridge

**Target/ownership:** `apps/backend/src/api/mobile/client/payments.controller.ts` and spec; `apps/backend/src/modules/finance/payments/client/init-client-payment/init-client-payment.handler.ts` and spec; `apps/website/app/booking/payment-callback/page.tsx` and test. No DTO/schema/guards, mobile, enrollment, generated files or dependencies.
**Change:** Current init handler creates website callbacks, while Expo expects `sawa://booking/payment-callback`. Add an internal typed command marker `returnTo?: 'MOBILE'`; set it in the mobile controller, leave public controller/default unchanged. Build website callback with `source=mobile` only for mobile commands. Fixed scheme only; never accept arbitrary return URL.
**Interfaces:** mobile callback HTTPS query `source=mobile&bookingId=<uuid>&invoiceId=<uuid>`. Website mobile branch offers/attempts fixed `sawa://booking/payment-callback` with safely encoded IDs; preserve normal `/booking/confirm` redirect for web/default. Unknown source stays web. Do not pass gateway status as confirmation or trust callback amount/status. Mobile route is owned by Task 1.

- [x] Add red tests for mobile controller marker, generated mobile/default callback URLs, and website native/web branches including parameter encoding and unknown source. Respect old invoices reused by init: recovery still relies on authoritative app foreground/manual return polling.
- [x] Run only owned Jest/Vitest test files, implement minimum bridge, then rerun and record counts.
- [x] Ensure a visible return-to-app link remains when automatic opening is blocked; no success claim on callback page.
- [x] Read backend and website CLAUDE.md; report changed paths, exact red/green commands and limitations.

### Task 4: Coordinator integration and acceptance

**Ownership:** environment setup, plan/ledger, generated OpenAPI/dashboard types if source snapshot differs, independent actual-diff review, test execution and evidence report. Implementation review fixes return to owning Luna worker.

- [x] Prepare isolated dependencies and synthetic PostgreSQL/Redis test environment; inspect available credential names without printing secrets; never use production data or live charges.
- [x] Review each actual diff for spec compliance and quality, then full integrated behavior including expired invoice and delayed event races. Record findings and bounded fix rounds.
- [x] Run focused mobile/backend/website suites, mobile typecheck, relevant PostgreSQL concurrency/payment tests and dashboard smoke with counts/no-skip evidence. Run `pnpm openapi:sync` for changed endpoint/handler surface and inspect generated differences; manual API client only if its contract changed.
- [ ] Verify actual Moyasar sandbox only with verified test credentials; never call live-charge endpoints. If unavailable, record exact blocker and request required sandbox setup while continuing local work. Native Apple Pay must remain an explicit device verification gate if not exercised.
- [x] Save final evidence and readiness limits; preserve worktree without commit/push/deploy.

### Task 5: Clean-install Metro verification blocker

**Target:** Existing `metro>image-size: 2.0.4` security override passes a path string to the 2.x byte-only API. The failure occurs before the payment UI can render.
**Ownership:** Luna modifies only Metro's extracted runtime/Flow asset boundary in `/tmp/sawaa-program-metro-patch`. Coordinator owns `apps/mobile/patches/metro@0.83.7.patch`, package registration and lock metadata. Independent of mobile flow files; UI verification waits for both.

- [x] Reproduce real `image-size(path)` failure and byte-input success on an app asset.
- [x] Change the existing conditional string/zip input to `fs.readFileSync(assetInfo.files[0])` (runtime) and matching Flow-source read, preserving image-size 2.0.4.
- [x] Exercise the patched Metro asset function on a real image with correct dimensions; coordinator registers the pnpm patch and restarts Metro.
- [x] Verify frozen install, iOS bundle and actual local payment UI; retain native-device/provider limitations.

Final state: local implementation and automated/UI verification completed; the unchecked sandbox/device acceptance remains external. See the final validation report for exact counts and HTTP401 blocker. Original checkout preserved, no commit/push/deployment.
