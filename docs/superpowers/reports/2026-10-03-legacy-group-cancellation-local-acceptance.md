# Legacy and group cancellation — local acceptance

Date: 2026-10-03. Candidate: `codex/staging-otp-search-acceptance`, starting HEAD `029f01d1e724d8fadaec0ecae5ea2dd126a9fec3`.
Status: implementation, independent review, native Luna UI scenarios and synthetic ledger verification complete locally. External-provider and staging acceptance remain separate.

## Approved behavior

The owner approved full paid-amount refunds before a program starts, and explicit employee assessment per participant after it starts. Already refunded amounts and money reserved by existing requests are deducted to prevent duplicate refunds. An explicit zero is valid after start. Historical imports are protected.

- Rejection of an old cancellation request reconciles the booking with captures that arrived during the pending request. Full payment confirms; durable evidence of a qualified deposit restores deposit confirmation. An unpaid reception confirmation remains confirmed. No expiry is invented for old rows lacking one.
- Approving an old cancellation request records cancellation and the financial intent atomically, considering all captures and existing refund claims. Cash and transfers create review requests; they are not recorded as already refunded.
- Program cancellation displays each participant's paid, refunded, reserved and available amount. Before start the server determines full available refunds. After start the employee must explicitly enter each eligible amount, including zero.
- A changed payment, participant set or start condition invalidates the preview. The server returns a conflict; the dashboard refreshes the quote and requires a second deliberate confirmation.
- Durable event identities protect retries. Terminal and historical booking states are not overwritten. Scheduling updates the date of active pending cancellation requests without deciding those requests.
- Customer/staff copy identifies center-initiated program cancellation and distinguishes a pending refund from completed settlement. Program, booking and finance caches are refreshed.

The existing ten booking-state values remain. This task adds no schema migration, bulk backfill, provider credential change, permission change or financial-provider implementation change. Earlier candidate changes remain separate and preserved.

## Verification evidence

All runtime and SQL evidence used disposable local data. Backend: `http://127.0.0.1:5218`; dashboard: `http://127.0.0.1:5219`. Postgres: owned container `saw-aa-booking-lifecycle-e2e-20261003`, local port `52032`, separate UI and regression databases. No production database or external refund provider was accessed.

Evidence directory: `/Users/tariq/.codex/routing-review/evidence/legacy-group-cancellation-20261003/`.

| Check | Result | Evidence |
| --- | --- | --- |
| Integrated backend unit tests | 18 suites, 154 passed | `integrated-backend-unit.log` |
| Backend follow-up tests for final event/notification repairs | 8 suites, 59 passed; overlaps prior run, not an additional total | `final-followup-unit.log` |
| Dashboard program tests | 7 files, 88 passed | `group-ui-fixed.log` |
| Final dialog-reset/reconfirmation regression | 2 files, 5 passed | `final-repair-ui.log` |
| Real SQL booking/cancellation suites | 33 distinct cases covered across 4 suites; the initial adapter-lock error was repaired and the affected program suite rerun successfully | `integrated-real-sql.log`, `group-real-fixed.log`, `final-repair-real.log` |
| Final program SQL suite, including schedule then reject | 5 passed | `final-repair-real.log` |
| Backend build and types | Passed | `backend-build-repair.log`, `backend-types-final.log` |
| Dashboard types | Passed after generated contracts and final dialog repair | `dashboard-types-repair.log` |
| Scoped backend and dashboard lint | Passed after removal of effect-based dialog resets | `backend-lint.log`, `dashboard-lint-repair.log` |
| OpenAPI and generated dashboard types | Regenerated from current local backend | `openapi-sync.log` |
| Handwritten API-client drift and Arabic/English parity | Passed; 66 declared endpoint contracts checked | Coordinator command output |
| Dashboard smoke | 40 passed, 2 fixture-dependent skips | `dashboard-smoke.log` |
| Native Luna / TesterArmy | All three program-cancellation scenarios completed; canceled program hides the cancel action | Task QA report below |
| Synthetic post-UI financial ledger | All 3 programs and 6 bookings canceled once; SAR400/150/420 requests pending review; actual refunded amounts zero; no duplicate source requests | `program-qa-ledger.json` |

The two smoke skips were an absent disposable chat fixture and optional employee authentication without a provisioned fixture credential. Admin and receptionist flows passed. No full-repository, mobile-device or external-provider test claim is made.

Expected RED evidence was recorded before implementation. An initial dashboard command accidentally expanded the test filter; only its owned process was interrupted, and that interrupted run is excluded from acceptance. Subsequent focused runs used the corrected command. The initial Prisma adapter lock-code test failure and the final scheduling review finding were repaired with focused GREEN reruns.

## Independent review

Native Astra high reviewed the actual incremental patch relative to the already-dirty starting candidate, not only implementation summaries. Two P2 findings were repaired:

1. A Zoom creation event consumed while a cancellation request was pending could not be recovered by reusing the old booking-wide identity. Rejection now creates stable recovery work per cancellation episode while retaining the provider's existing lease protections.
2. Scheduling a program skipped `CANCEL_REQUESTED`, leaving a later-restored booking on its placeholder date. Active pending-request dates now follow the program schedule; a real-SQL schedule-then-reject test covers it.

Final scoped repair review found no remaining P1/P2. Review artifacts: `.superpowers/sdd/2026-10-03-legacy-group-cancellation/final-review-report.md` and `final-repair-review-report.md`. Review was static; execution evidence is coordinator-owned.

## UI acceptance scenarios

Three synthetic programs with two participants each were created only in the local UI database:

| Scenario | Expected financial requests | Expected settlement |
| --- | --- | --- |
| Before start: captures of SAR300 and SAR100 | SAR400 in review | SAR0 actually refunded |
| After start: employee chooses SAR150 and SAR0 | SAR150 in review | SAR0 actually refunded |
| Quote changes while dialog is open: second participant increases from SAR100 to SAR120 | First submit conflicts; second confirmation requests SAR420 | SAR0 actually refunded |

Luna completed all three scenarios. The stale-quote first submission retained the dialog and reason, displayed the conflict and refreshed SAR100 to SAR120; a deliberate second confirmation canceled two bookings and explicitly said refunds had not completed. The local backend log independently records PATCH409, a fresh preview GET200, then the deliberate PATCH200. The poststart scenario submitted SAR150 for the participant who paid SAR300 and zero for the participant who paid SAR100. The canceled program no longer exposed the cancel button.

The coordinator then ran `.superpowers/sdd/2026-10-03-legacy-group-cancellation/verify-program-qa.cjs` successfully and inspected its ledger. Each of the six bookings has exactly one cancellation audit transition. Prestart requests equal SAR300 plus SAR100; poststart requests equal SAR150 plus zero; refreshed-quote requests equal SAR300 plus SAR120. Every created cash refund request is `PENDING_REVIEW`, actual refunded amounts remain zero, and source request identities are unique. This is independent local ledger evidence, not an external settlement claim.

The browser also blocked an over-limit SAR300.01 submission. No app-authored alert appeared in its semantic tree; the input uses native number/max validation. Native browser validation bubble appearance was not independently captured, so that visual detail is outside this acceptance evidence.

QA artifacts: `.superpowers/sdd/2026-10-03-legacy-group-cancellation/luna-program-qa-report.md` and its `program-qa/` directory. The native Luna model was explicitly requested by the user; TesterArmy was used through its local runner/MCP interface, without a paid model gateway.

TesterArmy/e2e MCP version `0.16.0`, accepted session `01a102f0-f779-7e84-b4ef-b1eac9401891`. UI evidence is semantic: the tool withheld pixels after opaque password entry, so no screenshots or video are claimed. MCP sessions do not produce a runner `report.json`; the QA report retains the session identity and observations. An initial config field-name error was corrected in a session closed before login or fixture interaction.

## Limits and delivery boundary

- This is local acceptance work. Nothing was committed, pushed, merged or deployed. Production data was neither read nor changed.
- Actual Moyasar sandbox refunds and external email/push delivery remain unverified. They are required before financial release acceptance; local cash fixtures and mocked provider tests do not substitute for them. Staging deployment and the owner's staging acceptance remain separate.
- The legacy CENTER notification path deliberately uses in-app/push only: its old appointment email template would falsely describe preserved terminal bookings as canceled. V2 uses an escaped program-specific email body. Existing client-cancellation legacy email behavior is preserved.
- Old partial payments without retained durable qualified-deposit evidence cannot safely prove that an old unconfirmed appointment qualified for confirmation. The handler preserves its original state instead of inferring from today's deposit settings. No historical backfill is performed.
- Prior already-dirty booking/client-cancellation work was preserved and only its relevant dependencies were reviewed here. This report does not replace its earlier acceptance record.

## Routing receipt

Policy: `astra-effort-v1`; task class coding, high complexity. Native Astra high workers/reviewer; native GPT-6 Luna high for user-requested UI QA. Coordinator model/effort attribution was not exposed by this runtime. Participant session UUIDs and complete token counters were unavailable. The baseline began after initial investigation, so whole-task tokens and savings remain unknown; `scope_complete` stays false.

Receipt root: `/Users/tariq/.codex/routing-review/legacy-cancel-receipts`; task `legacy-and-group-cancellation-oct03`. Participant metadata: evidence `participants.json`. No exhausted-quota or paid-provider fallback was used. Local acceptance binds this report's SHA-256 in the partial receipt; source and credentials are excluded from measurement snapshots.
