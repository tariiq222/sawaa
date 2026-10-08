# Security findings remediation plan

> For agentic workers: use subagent-driven-development with the repository's scoped ownership and coordinator-only integrated verification rules.

**Goal:** Close the eight reported security boundaries on current develop, preserving legitimate workflows.
**Base:** e4db299c66816eab810a9cc9d0cc8a19ea699a0a.
**Branch:** codex/security-findings-fixes.
**Spec:** Eight findings in scan e0a92efd-9ba9-4e44-b6a1-6948704509e5 and the user's explicit repair authorization.
**Architecture:** Reuse actor-aware handlers and rank checks. Enforce invoice-wide accounting serialization. No schema migration, new tenant model or credential changes.
**Stack:** NestJS, Prisma/PostgreSQL, Jest, Next.js dashboard smoke.

## Constraints and interfaces

- No commit, push, merge, deployment, production data access or cleanup of others' work.
- Preserve fixed encryption context, VAT=0, event organizationId and separate client/staff identities.
- Each worker owns disjoint files; coordinator owns shared people.controller.ts, OpenAPI output and final verification.
- Privacy command additions use requesterRole and requesterUserId from authenticated req.user, never DTO/body input. Explicit EMPLOYEE without identity fails closed.
- Identity employee command additions use actorUserId injected by the coordinator in employee controller methods and excluded from Prisma data.
- Two-factor authority includes role SUPER_ADMIN OR isSuperAdmin. Do not promote isSuperAdmin or mutate existing accounts to close the authentication gap.
- Worker execution is limited to explicitly scoped regression tests. Full tests/typecheck/build/smoke run once by coordinator after integration.
- Source edits authorized now; sensitive fixes are not accepted as verified until applicable runtime/sandbox checks pass.

## Task 1: Private client, chat and booking reads

Owned: modules/people/clients list/get/serializer and tests; modules/comms/chat legacy list handlers/access helper and tests; modules/bookings timeline/status-log handlers and tests; api/dashboard/comms.controller.ts and bookings.controller.ts and their direct tests. Do not edit people.controller.ts.

- [ ] Reproduce cross-employee reads with focused tests, plus allowed assigned-employee and privileged-staff controls.
- [ ] Pass trusted actor into the legacy chat paths and nested booking reads; resolve Employee.id from User.id. Scope list and count consistently; caller filters cannot widen ownership.
- [ ] Restrict client reads to practitioner booking relationships and employee-safe projection. Preserve privileged dashboard response and pagination contracts; scope booking summaries too.
- [ ] Report exact people.controller.ts caller wiring for coordinator.
- [ ] Run focused tests for owned boundaries and report commands/results.

## Task 2: Account rank and required second factor

Owned: modules/identity employee-account/shared/login/request-dashboard-otp/verify-dashboard-otp and tests; modules/people/employees create/update handlers and tests. Do not edit people.controller.ts or client files.

- [ ] Reproduce ADMIN modifying peer/super-admin through linked user, email match and linked employee email update. Preserve lower-rank management and non-account employee editing.
- [ ] Reuse assertCanManageUser for current target and assertCanAssignRole for requested new role. Authorize explicit user linkage and authentication-email synchronization. Never persist actor metadata.
- [ ] Apply one effective super-admin predicate to password/OTP/mobile eligibility so preexisting role-only privileged accounts require the configured second factor. Do not broaden platform privileges.
- [ ] Test missing actor, self/peer/higher target, allowed lower target, role-only/flag-only super-admin and ordinary staff controls.
- [ ] Report required controller wiring; run only focused owned regression tests.

## Task 3: Financial record retention and invoice refund serialization

Owned: modules/bookings/delete-booking and tests; modules/finance/refund-payment implementation/tests and any narrowly required finance locking helper; one focused real-DB concurrency test under test/e2e/finance.

- [ ] Reproduce deletion of terminal booking with only PARTIALLY_REFUNDED payment; preserve rejection and legitimate deletion controls.
- [ ] Include partial refunds in the shared preservation check used before and inside deletion transaction.
- [ ] Trace active/legacy accounting callers. Lock Invoice before Payment and before request mutations on every affected accounting path, re-read values under locks and preserve leases/idempotency.
- [ ] Demonstrate two different payments on one invoice sum both refunds using a real PostgreSQL concurrency test. No provider money movement or production databases from worker.
- [ ] Preserve recently merged cancellation/refund behavior; report sandbox validation requirements rather than mock it as real provider acceptance.

## Coordinator: Audit identity and integration

Owned: common/interceptors/audit.interceptor.ts and tests, request-context interceptor if needed; people controller wiring; generated OpenAPI/dashboard types; this plan and final evidence.

- [ ] Reproduce unsigned bearer audit spoof, including failure events. Preserve verified staff/client identities and anonymous events.
- [ ] Remove unverified payload fallback; trust authenticated req.user/context only.
- [ ] Integrate controller actor arguments and inspect every changed helper's callers.
- [ ] Run backend typecheck, focused/integrated unit and relevant real-DB checks; regenerate OpenAPI; run dashboard smoke against this branch's isolated local backend.
- [ ] Perform one independent bypass/regression review of candidate diff, resolve confirmed issues and rerun affected checks.
- [ ] Run Moyasar sandbox verification if safe test credentials/setup are available. Otherwise explicitly mark financial verification blocked, not fixed.
- [ ] Retain branch without commit/push; deliver files, evidence and remaining limitations.

## Review focus

1. Spoofed query/body actor fields must never override injected identity.
2. Missing Employee link must deny access; optional legacy caller context must not expose staff routes.
3. Related clients' other practitioners' booking summaries must remain private.
4. Existing role-only SUPER_ADMIN rows and OTP-only paths must receive required second factor.
5. Mixed manual/provider/reviewed refunds must use consistent invoice-first lock order without damaging reservation/lease handling.

## Rulings

- User authorized concrete security repairs and native delegation; no additional plan approval needed.
- Parallel workers share a checkout only through disjoint owned source files; common controller and generated artifacts remain coordinator-owned.
- Broad validation and final review are integrated once; workers run only focused red/green diagnostics.
- Measurement receipt attachment failed with KeyError: participants in existing routing ledger; task consumption remains incomplete/unknown, no ledger repair in this task.
