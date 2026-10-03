# Legacy and program cancellation implementation plan

> **For agentic workers:** Use subagent-driven-development. Owner already said begin and approved the financial policy; no repeat approval gate. No commits or external delivery in this task.

**Goal:** Reconcile old cancellation requests with late payments and implement full prestart / staff-assessed poststart program refunds.
**Architecture:** Booking changes and durable financial intents commit atomically. Existing refund execution owns retries, provider calls and ledger settlement. Current ten states and legacy history remain.
**Tech Stack:** NestJS/Prisma/Postgres, Next.js dashboard, Jest and disposable real-SQL acceptance.
**Spec:** Owner conversation approvals plus `.superpowers/sdd/2026-10-03-legacy-group-cancellation/batch-context.md` and task briefs.

## Global Constraints
No live data/provider access, migration, commit or deployment. Preserve prior dirty work. Deposit confirms; balance remains. Refund never implicitly cancels. Cash refund remains pending until actual settlement. Keep encryption, auth, VAT and old status enums unchanged.

## Tasks and ownership
1. Legacy worker: reject/approve handlers and event subscriber. Restore according to captured money and durable deposit evidence; freeze multicapture staff refund intent at approval. No program/shared financial edits.
2. Program worker: cancellation preview/handler/API/UI, financial intent helper and compatible generic execution; program scheduling concurrency. Different files, fixed shared helper contract in batch context; legacy approval validation waits for helper implementation, rejection is independent.
3. Coordinator: RED focused tests, integrated GREEN, OpenAPI and manual client review, dashboard smoke, isolated real SQL, independent code review, local acceptance report.

## Acceptance sequence
- [x] Write failing tests, coordinator records expected RED.
- [x] Implement bounded fixes, no intermediate full validation by workers.
- [x] Run focused backend/UI + real SQL tests, build/types/smoke and contract sync once integrated; failures get focused repair.
- [x] Independent review on actual new diff, repair important findings and retest changed paths.
- [x] Report local evidence and leave sandbox/provider/staging/production gates explicit.

Local evidence: `docs/superpowers/reports/2026-10-03-legacy-group-cancellation-local-acceptance.md`. Native Luna used TesterArmy for three synthetic program scenarios; coordinator independently matched the final SQL ledger. No commit, remote delivery or production access.

## Review Focus
- Money arriving while cancellation decision runs: capture-before and capture-after ordering, no invalid restore.
- Multiple captures, prior refunds and competing claims: aggregate cap and replay-safe requests.
- Missing legacy expiry and reception unpaid confirmation: no newly invented timeout or downgrade.
- Group starts or payment changes while dialog open: 409 and explicit new confirmation.
- Concurrent terminal transition/scheduling/cancel: no history overwrite or resurrection; bounded lock behavior.
