# Phase 3 — payment UI and lifecycle acceptance

Scope: continue the authorized local-only Sandbox coverage on `codex/e2e-phase1`.
No product behavior changes, commits, deployment, production or shared-data writes.

1. Run existing real-Postgres contracts in a dedicated disposable container on
   loopback port 55861: webhook authentication/idempotency, native reservation
   concurrency, package reserve/consume/return and HTTP booking, cancellation
   ownership/financial quote/replay. External providers in this lane are mocked;
   this is not proof of actual Moyasar webhook delivery.
2. In an independently owned local UI stack, exercise the native card form with
   official Sandbox cards; prove failure leaves the invoice unpaid, successful
   retry confirms the booking with one completed payment, and reopening does not
   duplicate the capture. Record UI and database evidence.
3. Verify a signed HTTP webhook against authoritative Sandbox payment state,
   duplicate delivery and invalid authentication. Distinguish a local replay from
   an event delivered by Moyasar itself; the latter needs a reachable Sandbox
   endpoint configured at the provider.
4. Exercise package/cancellation UI after the financial contracts are established.
5. Apple Pay requires a physical device and owner interaction. Keep it pending
   until an actual device result and server reconciliation are recorded.

Dependencies: steps 2–4 share fixture settings and must run sequentially. Step 1
owns a different Postgres instance and can run while UI infrastructure is prepared.
An active integration task initially occupied the fixed UI ports/subnet; coordinate
before starting that stack, and preserve both worktrees and their dirty changes.

Acceptance: named test results plus persisted state; skipped/blocked/mock-provider
results must not be reported as live provider or native UI success. Keep evidence
under `.e2e/` and a private report directory. Retain volumes; stop only owned runtime.

Measurement: baseline captured after initial inspection; whole-task usage unknown.
Policy: sol61-all-v1. No model or quota savings inference.
