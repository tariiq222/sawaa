# Phase 2: isolated booking and payment acceptance

Spec: `docs/testing/e2e-scenarios.md` and the canonical clinic/service contract.

## Constraints

Use the existing `codex/e2e-phase1` checkout; preserve phase 1. No commits,
deployment, shared database writes, production credentials, OTP bypass, or
application behavior changes. All new data belongs to a fresh local Compose
project and database. VAT remains zero. External dispatch and paid AI keys are
empty. Sol 6.1 uses the runner's subscription adapter only.

## Task 1: isolated live stack

Files: `e2e/local/*`. Produce a private runtime environment, fixture manifest
and three app origins. Reject non-loopback/non-test database URLs before any
write. Create a new pgvector database, Redis and MinIO; apply existing immutable
migrations, then seed a minimal synthetic client, staff and SERVICES clinic.
Start the current backend source and separate frontend processes. Retain logs
on failure; stop only processes/resources created by this runner.

Verification: safety tests reject shared/dev/staging/remote databases; live
health and catalog requests must return the exact fixture IDs.

## Task 2: website → backend → staff

Files: `e2e/tests/booking.e2e.ts`, dedicated local config. Real password login,
clinic discovery, service/practitioner/date selection and pay-at-clinic submit.
Assert one persisted CONFIRMED booking, exact client/service/employee IDs,
30000 halalas, SAR, payAtClinic=true and no paid invoice. Open the same booking
in the staff dashboard. Reload client details to verify persistence.

Verification: TesterArmy live browser report, authoritative DB receipt and
dashboard smoke on the isolated environment. A DOM message alone is insufficient.

## Task 3: native app

Files: `e2e.mobile.config.ts`, `e2e/tests/mobile-booking.e2e.ts`, dependency lock.
Use a dedicated simulator and verified existing Debug artifact with current
Metro JS pointed explicitly at the isolated backend. Native password login and
booking use a separate synthetic client/slot. Verify persisted booking as in
Task 2. A simulator pass does not prove physical Apple Pay token acceptance.

Verification: TesterArmy device report plus backend receipt; report launch or
artifact compatibility failures without changing the production native tree.

## Task 4: Sandbox and review

Real Moyasar calls require an explicitly approved local test credential; reject
live keys. If unavailable, keep real-provider acceptance pending and deliver the
concrete runner/setup needed, while completing provider-free journeys. Never
label a simulated reconciliation as Sandbox success.

One independent final review checks isolation, secret handling, exact money and
ID assertions, cleanup ownership, mobile engine compatibility and honest skips.
Parent runs final checks once for the integrated batch. Keep the uncommitted
diff reviewable and document evidence and remaining blockers.
