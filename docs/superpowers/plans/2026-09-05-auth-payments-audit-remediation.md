# Sawaa Auth and Payments Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Project instructions override skill defaults: independent owners work in parallel, only the root orchestrator runs validation, and no commits are authorized.

**Goal:** Fix the ten confirmed Auth/Authorization and Payments/Moyasar audit findings approved by the user on 2026-09-05.

**Architecture:** Preserve the modular monolith and existing API shapes. Serialize competing financial writers on Invoice, make state transitions conditional, and stage required domain events in the existing transactional outbox. Keep session lifecycle and error recovery explicit across backend and web clients.

**Tech Stack:** NestJS 11, Prisma 7/PostgreSQL, BullMQ, Next.js 15, React/TanStack Query, Jest, Vitest, Playwright.

**Spec:** The accepted audit and implementation scope below (user approved with “ابدا”). Base: 703e944487a55ebadc579e241e50015c913e56d8.

## Global Constraints

- Backend + Dashboard + Website only; do not inspect or modify Mobile.
- No commit, push, merge, deploy, secret rotation, or real payment.
- Existing migrations are immutable. Prefer solutions using existing schema; any needed schema change is additive only.
- No production database operations. Root alone provisions a disposable test database and runs validation.
- Preserve Arabic/English localization and current cookie/token namespaces.
- Existing POST response shapes remain compatible. Root owns OpenAPI regeneration and generated dashboard types.
- Subagents are not alone: do not overwrite others' edits or expand ownership silently.
- Only root runs tests, builds, lint, schema generation, and live checks. Authors write regression tests first and notify root with exact commands; root confirms the red result before production changes.
- Test payment provider outcomes with fakes first. Sandbox requires test credentials and must never use live keys.

## Technical Lead and Contracts

Sol owns technical integration and Task 2 payments. It dispatches at most two independent Luna workers for Tasks 1 and 3 from blank context, passing these task briefs by local file URI. Root owns environment, test execution, generated contracts, final review coordination, and reporting.

| Pair | Contract | Independence |
|---|---|---|
| Auth / Web | Refresh routes and response shapes unchanged; valid refresh cookie can renew an expired client access cookie. Terminal auth errors remain 401/403. | Independent file ownership |
| Payments / Web | Init accepts invoiceId and returns paymentId/redirectUrl. Retrying the same invoice must reuse or reconcile its checkout; no blind replay after unknown outcomes. | Independent file ownership |
| Payments / Auth | No shared schema or services modified. | Independent |
| All / Root | Root alone generates OpenAPI/types and executes test suites once implementation is ready. | Dependent |

## Task 1: Backend session lifecycle and role assignment

**Owner:** Root integrated backend auth after the Luna regression handoff; Sol performed the independent read-only review.

**Files:** `apps/backend/src/api/public/auth.controller.ts`, `public-auth.controller.ts`, `apps/backend/src/api/dashboard/identity.controller.ts`; `apps/backend/src/modules/identity/{logout,shared,client-auth,users}/` relevant handlers/services and colocated tests; `apps/backend/test/e2e/{auth,identity}/` focused regression tests. Read actual client-auth folder layout before editing. Do not modify finance, HTTP helpers, OpenAPI, or web apps.

**Accepted findings:** custom role assignment requires manage:User but bypasses manage:Role and rank checks; staff refresh can insert a replacement after logout; client refresh requires a valid access session.

- [x] Write regressions: principal with manage:User but no manage:Role gets 403 on assigning/removing another user's custom role; actor cannot modify a target at/above its rank. Use canonical UpdateUserRoleHandler policy as the source of rank behavior.
- [x] Write a deterministic refresh/logout race test. Pause refresh around rotation, run logout against another valid session, then resume; assert no surviving replacement credential can restore access after successful logout. Same-token double-refresh still has one winner.
- [x] Write a controller/real-guard test: expired or missing access cookie plus a valid client refresh cookie succeeds; revoked, expired, and wrong-client refresh credentials fail. Do not override the guard being verified.
- [x] Send test paths and commands to root and wait for red evidence before changing production code.
- [x] Make custom-role assignment use the canonical role-management gate and actor/target policy, including equivalent removal bypasses in the same surface.
- [x] Serialize staff rotation and revoke-all using the same User row lock and one transaction for token consumption, user version read, and replacement persistence. Token service can accept an optional transaction client while preserving existing callers. Logout must also lock User before invalidating tokens/version; use consistent lock ordering.
- [x] Client refresh authenticates from the refresh credential itself rather than requiring an unexpired access token; derive client identity from the verified refresh record, keep cookie output and CSRF protection. Review logout with expired access for the same lifecycle requirement.
- [x] Report changed files, regression expectations, remaining concerns, and proposed verification commands. Do not run validation or commit.

## Task 2: Financial atomicity, webhook recovery, and provider deadlines

**Owner:** Sol technical lead.

**Files:** `apps/backend/src/modules/finance/process-payment/`, `collect-booking-payment/`, `payments/client/init-client-payment/`, `moyasar-webhook/`, `moyasar-api/`; callers consuming deferred payment events where necessary; `apps/backend/src/modules/ops/cron-tasks/reconcile-payments.cron.ts`; `apps/backend/src/infrastructure/http/`; focused colocated tests and `apps/backend/test/e2e/finance/`. No auth or web edits.

**Accepted findings:** cash/card initialization race; manual payment event loss after commit; webhook/reconcile duplicate state transitions; abandoned webhook dedup claim; provider timeout ends before response body.

- [x] Write regressions before production edits. Cash commit between balance read/reservation must prevent a stale card amount. Duplicate webhook statuses and webhook/reconcile interleavings must produce one effective transition and one event. Manual payment committed during broker outage must retain a retryable outbox row; keyed replay must not create another event.
- [x] Write a recovery regression for an existing WebhookEvent with processedAt=null after a crashed worker; retry must safely complete rather than permanently ack as duplicate.
- [x] Write deadline tests with immediate headers and a delayed/nonterminating response body; deadline must abort parsing. Preserve caller cancellation and error classification.
- [x] Send test paths/commands to root; wait for red evidence before production edits.
- [x] Reserve card payment inside an Invoice row lock after rereading invoice status, amount, booking eligibility and completed/pending rows. Keep provider HTTP outside the transaction. Preserve hosted URL reuse and unknown-outcome recovery; an absent metadata lookup while another create is in flight is not proof the attempt is safely discardable.
- [x] Stage ProcessPayment completion/deposit events inside the caller's transaction or its own transaction. Preserve the public result shape; adapt Collect and package callers to avoid double-staging. Use stable event identity and current outbox delivery lane conventions.
- [x] Serialize webhook/reconcile writers using Invoice lock, reread Payment state and amount under the lock, and conditionally transition only a nonterminal payment. Preserve terminal refunds and no-op already completed transitions. Keep authoritative gateway fetch outside locks.
- [x] Make dedup ownership crash-recoverable without unsafe early acknowledgements: prefer inserting/claiming the WebhookEvent and marking completion in the financial transaction, with an advisory transaction lock for the provider event identity if necessary. Existing unprocessed claims must be recoverable; concurrent matching delivery must wait or remain retryable.
- [x] Ensure explicit request deadline includes response consumption for Moyasar, not just headers, while preserving generic helper compatibility. Do not introduce auto-retry of payment/refund POSTs.
- [x] Self-review lock order against manual payment, refund, invoice discount, and existing provider lease paths. Report exact implemented invariants and test commands to root.

## Task 3: Web session and checkout recovery

**Owner:** Sol completed web integration after the Luna regression handoff; a separate Sol performed the independent read-only review.

**Files:** `apps/website/features/auth/`, `features/account/account-feature.tsx`, `app/booking/page.tsx`, `features/payment/`, `lib/public-fetch.ts`, relevant translation modules and tests; `apps/dashboard/components/providers/auth-provider.tsx` and tests; `packages/api-client/src/client.ts` only if required for bounded website auth requests (read package conventions). No backend edits or generated files.

**Accepted findings:** transient profile/refresh failure treated as logout; successful booking identity lost after init failure; mutations and website logout can wait indefinitely.

- [x] Write tests: transient /me 500/network error retains profile and allows retry without login navigation; terminal 401 still clears auth. Dashboard scheduled refresh retries transient failure without clearing a still-valid session, and aborted/late refresh cannot resurrect logout.
- [x] Write booking regression: booking create succeeds, init fails, next submit calls init for the same invoice and never creates a second booking. Preserve booking/invoice before awaiting init. Existing backend overlap prevents duplicates; test recovery rather than assuming duplicate creation.
- [x] Write tests for bounded pending mutations and logout with a hung response. Logout clears/cancels local session and query cache promptly, rejects late profile responses, and does not present successful server revocation when it is unknown.
- [x] Send test paths and commands to root; wait for red evidence before production edits.
- [x] Distinguish ApiError/PublicFetchError terminal authorization failures from transient errors. Let transient profile errors reach query retry and show a localized retry state without redirect loops. Preserve authenticated route safety.
- [x] Store created bookingId/invoiceId immediately and resume/reconcile init against them after errors. Retain a visible route to that booking; redirect fallback should use the stored hosted URL rather than reload and lose the state.
- [x] Add finite waits for relevant mutating requests with explicit unknown-outcome handling; no automatic replay of financial POSTs. Keep CSRF token acquisition/retry rules and caller abort semantics intact.
- [x] Coordinate logout local clearing with query cancellation/removal and generation checks so late data cannot restore the session. Retain remote revocation error state/recovery appropriately for httpOnly cookies.
- [x] Report changed files, command list, and remaining integration concerns. No validation or commits.

## Task 4: Root verification and completion evidence

- [x] Confirm isolated clean base, install locked dependencies, and generate Prisma client without touching production secrets or data.
- [x] Run test-first regressions from each owner, capture red output, then authorize implementation. Record failures caused by environment separately.
- [x] Review completed packages for spec compliance and quality; dispatch a fresh focused reviewer for the combined diff and resolve actionable issues through owners.
- [x] Run targeted backend tests and web unit suites; run backend/dashboard/website typechecks and required dashboard smoke. Run build/typecheck sequentially where Next.js generated types overlap.
- [x] Regenerate `apps/backend/openapi.json` and dashboard types using `pnpm openapi:sync`; manually update API client only if the public contract changed.
- [x] Provision an isolated test database using the repository's real-E2E helper; never reset or mutate an existing user database. Run focused Auth/Identity/Finance real-DB concurrency E2E, with provider/network dependencies mocked.
- [ ] Verify Moyasar sandbox using only explicitly identified test credentials if available: success/decline/3DS, webhook replay/out-of-order, lost create response, partial/full refund and ambiguous outcome. If credentials are unavailable, report sandbox verification as outstanding rather than infer it from mocks.
- [x] Produce a concise delivery report with actual commands/results, limitations, no commit/push/deploy, and clean separation of local proof versus sandbox proof.

## Completion evidence

Local implementation and verification are complete. Moyasar sandbox remains pending valid test credentials (seed authentication returned 401). See [the delivery report](../audits/2026-09-05-auth-payments-remediation.md) for actual results, skipped checks, and runtime limitations. No commit, push, or deployment was performed.
