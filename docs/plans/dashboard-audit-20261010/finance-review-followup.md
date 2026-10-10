# Finance review follow-up — bank refund request approval

Date: 2026-10-10. Scoped follow-up baseline: `330cd5446e7b4233b5529423dfcfe5f62a63719d` on `codex/dashboard-audit-finance-20261010`; original finance branch base: `5f6b9ad0b71d55953d16562c8726c92652759ed4` (PR191). The coordinator already incorporated the preceding finance commits.

## Finding and resolution

A BANK_TRANSFER payment can carry an administrative `gatewayRef`. The review UI classified it as a gateway payment and displayed provider approval, while ApproveRefundHandler claimed PENDING_REVIEW → PROCESSING before the shared provider finalizer rejected the non-ONLINE_CARD method. That left the request unavailable for manual settlement.

- UI now classifies provider refunds exclusively by `method === ONLINE_CARD`. Cash and bank transfers, with or without an administrative reference, use manual settlement with the existing `canDo("payment", "update")` permission. Card review retains `canDo("setting", "manage")`.
- ApproveRefundHandler selects the payment method and rejects non-ONLINE_CARD with BadRequestException before changing status, processor metadata, idempotency/provider state, or calling the shared refund engine. Pending manual requests remain PENDING_REVIEW.
- Card approval still claims status with its existing compare-and-set and delegates to the same leased reconciliation engine. Missing card reference, balance validation, concurrent approval conflict, provider failure propagation and provider completion responses remain covered.

Permission source proof: `apps/backend/src/api/dashboard/finance.controller.ts:411` gates manual refunds on update:Payment; `apps/backend/src/api/dashboard/refunds.controller.ts:48` gates provider approval on manage:Setting. These controllers, guards and CASL definitions were not changed.

## Changed paths

1. `apps/dashboard/components/features/payments/payment-refund-requests.tsx`
2. `apps/dashboard/test/unit/features/payments/payment-refund-requests.spec.tsx`
3. `apps/backend/src/modules/finance/refund-payment/approve-refund.handler.ts`
4. `apps/backend/src/modules/finance/refund-payment/approve-refund.handler.spec.ts`
5. `apps/backend/src/modules/finance/payment-mutations.handler.spec.ts` (additional coordinator-approved stale card-fixture correction only).
6. This evidence file.

No endpoint/DTO response shape changed, no generated sources or translation registries edited, and no provider engine, lease, accounting or encryption changes.

## RED → GREEN evidence

All test commands used the coordinator's synthetic-environment wrapper, without reading live .env files or accessing a database/provider:

```sh
node /Users/tariq/.codex/release-evidence/2026-10-10-four-groups-integration/run-safe.mjs pnpm --filter=dashboard exec vitest run test/unit/features/payments/payment-refund-requests.spec.tsx
node /Users/tariq/.codex/release-evidence/2026-10-10-four-groups-integration/run-safe.mjs pnpm --filter=backend exec jest --runInBand src/modules/finance/refund-payment/approve-refund.handler.spec.ts
```

RED before source fixes: dashboard 4 failed / 10 passed. Tests demonstrated incorrect manual permissions for bank transfers both with/without references, incorrect cash permission, and incorrect referenced-bank permission. Backend 2 failed / 5 passed: the stateful bank regression observed PROCESSING, processedBy, idempotencyKey and providerState after the finalizer rejected the method; cash returned the missing-reference error rather than rejecting the unsupported method.

GREEN after source fixes: dashboard 14/14 passed; backend 8/8 passed. Bank tests actually enter a reason, confirm funds returned, and assert manual-refund PATCH with the exact request ID and 2500 halalas, with no approve POST. Backend tests assert the complete pending request is unchanged and no status claim/finalizer/read-after-settlement occurs. Existing card success, denial, retry, duplicate submission, permission and terminal-state UI cases remain passing; backend card CAS/engine/balance/failure cases remain passing. Added explicit missing card-reference guard coverage.

Additional integrated failure reproduced locally: `payment-mutations.handler.spec.ts` was RED (1 failed / 7 passed) because the refund card fixture omitted method in both locked payment row and provider-finalizer lookup. Updated only that test's card row/select result to ONLINE_CARD; GREEN 8/8 passed, including refund event/outbox completion and bank verification CAS cases. Command:

```sh
node /Users/tariq/.codex/release-evidence/2026-10-10-four-groups-integration/run-safe.mjs pnpm --filter=backend exec jest --runInBand src/modules/finance/payment-mutations.handler.spec.ts
```

Final focused result: 3 specs, 30 tests passed. `git diff --check` passed. The scoped commit uses normal staged lint/legacy hooks; hook results are supplied to the coordinator with its SHA.

## Verification boundary

Focused local mocked regressions establish the corrected classification and pre-claim guard. Integrated dashboard smoke and real Moyasar Sandbox verification remain coordinator-owned. No full suite, push, merge, deploy, live database or real provider calls were performed in this lane. Existing previously stuck live rows are not mutated by this code change or by these tests.
