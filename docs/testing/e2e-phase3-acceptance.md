# Phase 3 local acceptance — 2026-10-08

Status: **in progress; not full acceptance**. Worktree `codex/e2e-phase1`; no commit or deployment by this task.

| Scenario | Observed result | Evidence |
| --- | --- | --- |
| Financial lifecycle contracts | 7 suites, 49 passed, 0 skipped; real isolated Postgres, mocked external providers | `.e2e/sawaa-e2e-contracts-1791449791420/results.json` |
| Pay-at-center cancellation | Real local API/DB: cancelled, one status log/outbox event, no invoice; duplicate action did not duplicate effects | `.e2e/local-1791450058365/cancellation-receipt.json` |
| Native declined card | Native form + test 3DS submitted; payment FAILED, invoice DRAFT, booking awaiting payment | `.e2e/local-1791450058365/native-card-recovery.ad` |
| Native retry paid after hold elapsed | Sandbox 300 SAR completed once, invoice PAID; booking remains AWAITING_PAYMENT and app shows review. Hold expired 09:20:52Z; paid 09:21:10Z. This is late-payment coverage, **not successful booking confirmation** | `.e2e/local-1791450058365/native-late-payment-receipt.json` |
| Actual provider webhook | Received both payment_failed and payment_paid over the dedicated HTTPS relay. Both HTTP 200/invalid_transition after native reconciliation; delivery verified, first settlement by webhook not proven | `.e2e/local-1791450058365/webhook-receipt.json` |
| Webhook authentication/replay | Invalid signature rejected; valid duplicate skipped; invoice and payments unchanged | `.e2e/local-1791450058365/webhook-replay-receipt.json` |
| Apple Pay physical device | Fresh local Debug built and installed; initial iOS launch failed; device step pending | `.e2e/phase3-device/install.json` |
| Native automated decline/retry | **PASS**, fresh fixture: one failed and one completed payment, one PAID invoice, confirmed exact appointment and native success screen, 148.99 seconds | `.e2e/phase3-mobile-payment/report.json`; `.e2e/local-1791451499071/payment-receipt.json` |
| Native package purchase → booking → cancel | **PASS**, observed native UI: Sandbox 600 SAR, ACTIVE two-credit purchase; one credit reserved for exact slot, then native cancellation returned it. One paid invoice/payment, no extra booking invoice | `.e2e/local-1791451499071/native-package.ad`; `package-reserved-receipt.json`; `package-cancelled-receipt.json` |

Runtime: dedicated local backend 55200, dashboard 55203, website 55205, synthetic clients, test-only Moyasar. No production database or TestFlight acceptance.

First-run cleanup verified: dedicated provider webhook receipt has `deleted: true`; owned relay, LAN Metro and stack stopped, volumes retained. Fresh card/package run is complete; its stack and dedicated simulator are stopped. No listener remains on 55200, 55207 or 8081. Volumes retained. Never remove another task's resources.

Observed display limitation: the retained simulator artifact showed the home appointment time three hours later than the selected slot and appointment details (home 11:00, details 08:00). The database matched the selected 08:00 Riyadh slot. This display discrepancy is recorded, not fixed or accepted; reproduce on the fresh physical Debug build before attributing it to current native code.

Apple Pay: two bounded app launch attempts failed with CoreDeviceError 10002. Developer Mode is enabled and device booted. Awaiting owner observation after unlocking/opening the installed app. No Apple Pay sheet or payment was created.

Final review: added exact payment amount and invoice/payment SAR assertions; real persisted package verification passed again after cancellation. JS syntax, E2E TypeScript and git diff whitespace checks passed. Usage attribution remains incomplete due receipt participant schema error; account/session totals are not attributed to this task.
