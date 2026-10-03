# Booking lifecycle — local acceptance

Candidate: `codex/staging-otp-search-acceptance`, based on `029f01d1e724d8fadaec0ecae5ea2dd126a9fec3`, with uncommitted implementation changes.

## Scope and data boundary

The approved lifecycle and cancellation changes are implemented in the local candidate. All database/runtime checks used synthetic data in disposable local PostgreSQL databases. No production or staging database was accessed, copied, migrated, or changed. No remote deployment, Git commit, push, or merge was performed for this implementation.

The new settings migration is additive and disabled by default. It adds configuration; it does not convert historical booking statuses or backfill customer records. Any future activation and release require their own authorized rollout.

## Implemented behavior

- Reception bookings remain operationally confirmed independently of payment.
- Deposit-paid bookings support attendance, completion, no-show, and rescheduling. Attendance and rescheduling retain their deposit status and outstanding balance.
- Expiry requires an explicit elapsed deadline. Old bookings without a deadline are not expired based on age.
- A refund alone no longer cancels a booking, releases its slot, returns package credit, or deletes its meeting.
- Enabled client cancellation policy allows immediate eligible cancellation, independently of refund review. Configurable cutoff and early/late refund terms are shown before confirmation.
- Changed quotes require review and explicit reconfirmation. Persisted refund outcomes and later notifications reflect the financial ledger rather than treating approval as money returned.
- Manual cash settlement completes the original refund request for its exact amount after staff acknowledges that the money was returned.

Existing status codes and old cancellation-request records remain supported. Existing terminal payment restrictions and the ordinary staff no-show policy were not expanded.

## Browser acceptance

Native GPT-6 Luna used TesterArmy e2e 0.16.0 / web engine 0.11.2 against local backend5218, dashboard5219 and website5220. This identifies the QA agent model; it does not claim that the SDK's model-backed `agent.act` used Luna.

| Journey | Result |
|---|---|
| Settings: explicit zero cutoff, validation, persistence, before-start/before-attendance choice, automatic/review controls | Passed |
| Unpaid cancellation | Passed; cancelled, no refund created |
| Cash deposit cancellation | Passed; SAR35 preview, immediate cancellation, pending financial review |
| Same-request manual refund settlement | Passed; client sees SAR35 completed, booking stays cancelled |
| Policy changed with confirmation dialog open | Passed; new SAR30 quote requires a second explicit confirmation |
| Late cancellation with zero refund | Passed |
| Cancellation after attendance | Passed; no confirmation action exposed |
| Unpaid reception attendance | Passed; confirmed, attended, still unpaid |
| Deposit attendance and completion | Passed; SAR100 paid and SAR200 outstanding retained |
| Deposit rescheduling | Passed; new slot and deposit status persisted |
| Website at 390×844 | Passed for cancellation preview; browser emulation only |

Testing exposed a repeated check-in action after attendance. The dashboard menu was corrected, two regression cases failed before the correction, 30 focused tests passed afterward, and Luna rechecked the actual menu and completion journey.

Eight focused TesterArmy runner cases passed individually. Three final successful JSON reports are preserved; earlier one-case reports were overwritten by the runner, and their results are recorded from completed execution outputs. Additional journeys above were driven and observed through TesterArmy MCP. This is not a claim of one eight-case batch run. See the detailed local report at `.superpowers/sdd/2026-10-03-booking-lifecycle-corrections/e2e-qa/luna-e2e-report.md` for case-level provenance, failed harness attempts, and trace paths.

Read-only follow-up found no client notification-center surface in the website's current account navigation. The cancelled booking detail correctly shows the completed SAR35 refund and partially refunded invoice, but that is status presentation rather than a notification-center acceptance result. Screenshot capture after secret login was blocked by TesterArmy's pixel-taint protection; the observation tree was used without bypassing that protection.

## Native mobile acceptance

Native GPT-6 Luna completed the following journeys interactively through TesterArmy's underlying agent-device engine on the dedicated iOS simulator. The coordinator inspected native screenshots of appointments, the cancellation preview, and the notification center.

| Journey | Result |
|---|---|
| Launch, synthetic review-account login, own appointment list | Passed |
| Deposit confirmation and remaining payment | Passed; confirmed deposit and SAR200 remaining shown. This screen does not display the SAR100 already paid numerically. Secure-payment action was not pressed. |
| Cash cancellation preview → confirmation → reopen from cancellations | Passed; SAR35 preview, immediately cancelled, financial review pending and persisted |
| Unpaid cancellation | Passed; immediately cancelled, no refund due |
| Attendance cancellation restriction | Passed; Arabic denial with no confirmation action, original status retained |
| In-app notification center | Passed; cancellation and pending refund review shown truthfully, without claiming money was returned |
| Stale quote and second explicit confirmation | Passed; old SAR35 terms rejected, refreshed SAR30 terms require a new confirmation, then cancellation persists with SAR30 pending review |

Native testing found an extra English global alert above the localized stale-quote message. Cancellation errors now remain with the screen's localized error handling. Two regressions failed before the fix; 49 focused hook/detail tests, types and lint passed afterward. Luna refreshed the candidate JavaScript and repeated the stale-quote journey on an additional synthetic booking: only the Arabic message appeared, the explicit second confirmation succeeded, and the coordinator restored the isolated branch policy to 35%.

The deterministic TesterArmy CLI installed/launched the app but its UI assertion sequence did not pass the development-overlay/navigation setup. Native acceptance above comes from the interactive engine session, **not a passing native runner suite**. The website/dashboard runner results are separate. See `.superpowers/sdd/2026-10-03-booking-lifecycle-corrections/native-luna-e2e-report.md` and `e2e-qa/mobile/evidence/` there for individual screenshots and preserved runner attempts.

Test setup required repairing only synthetic Firebase configuration in the disposable build and dismissing a React Native development warning overlay that covered navigation controls. No tracked mobile configuration or provider credentials were changed. The local endpoint is established by run configuration and the synthetic fixture session; per-request packet capture was unavailable. No physical-device, Android, or push-provider acceptance is claimed.

## Automated and source evidence

- Backend affected scope: 36 suites / 556 tests passed. Focused follow-ups for aggregate refund limits, expiry, outcome events and transaction handling also passed; these counts overlap.
- Dashboard: 106 component tests passed, then 30 focused attendance-menu tests after the browser correction. Website: 35; mobile: 170, followed by 49 hook/detail tests after the native-alert correction; API client: 11 passed. Follow-up counts overlap with previous runs.
- Disposable real SQL/HTTP: 20 lifecycle/cancellation cases passed, plus a later denial → durable event → single client notification replay case, rerun successfully after the final transaction-wrapper correction.
- Existing dashboard smoke: 42/42 passed against the local candidate. The later attendance-menu change has focused regression and actual browser evidence.
- Backend build and backend/dashboard/website/mobile/API-client type checks passed. Changed-source lint passed, with one preexisting mobile unused-import warning.
- OpenAPI regenerated from the explicit local API; 66 API-client calls and 171 dashboard calls verified; 299 routes with zero new documentation gaps. Translation parity and legacy-scaffolding guards passed.
- Independent integrated source review: aggregate refund and later outcome-notification findings corrected; no remaining actionable P1/P2 in the bounded review.

Command logs and the synthetic manual-settlement ledger are under `/Users/tariq/.codex/routing-review/evidence/booking-lifecycle-20261003`. Source review and integration records are under `.superpowers/sdd/2026-10-03-booking-lifecycle-corrections`.

## Remaining release gates

Moyasar sandbox execution, external SMS/push delivery, physical-device acceptance, owner staging acceptance and production rollout are separate from these local results. No payment/refund, email or SMS provider was exercised and real money was not moved. Native Firebase used synthetic test configuration; this is not Firebase delivery acceptance. Old backend binaries with refund-triggered cancellation must be retired during any future authorized rollout.

Routing policy: `astra-effort-v1`, with the owner's explicit Luna QA exception. Measurement began late and lacks complete participant attribution; whole-task token consumption remains unknown.
