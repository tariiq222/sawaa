# Independent employee and Aqua button review

Reviewer: GPT-6.1 Sol / high, policy `sol61-all-v1`; session `01a117ec-bcff-7403-b7d1-d747da5242ba`.

## Spec verdict

PASS for local implementation of employee Tasks 1–5 and the narrow light-Aqua AppButton foreground remedy. Native acceptance is INCOMPLETE. This verdict permits local integration and coordinator validation; it does not close visual/runtime audit findings or authorize a release.

Reviewed the approved design, employee context/batch brief, actual orchestrator-built `employee-actual-delta.patch` against its frozen baseline, current employee worktree source and behavioral test source. Worker report and recorded logs were supporting evidence, not the basis for source acceptance. No active account/client ownership was inspected or edited.

- Task 1: `app/(employee)/(tabs)/clients.tsx` distinguishes undefined/current-key data from `keepPreviousData` placeholder data. A valid empty response counts as current data. Same-key refetch failure retains that data and an alert/retry notice; first-read failure gets danger EmptyState; pending/new-key placeholder data cannot render prior results or success-empty text. The real query hook, key shape, 400ms debounce and service parameters remain unchanged. Tests use a real QueryClient/hook with the service boundary mocked and cover failure, retry, both valid empty/nonempty retention and previous-search isolation.
- Task 2: `app/(employee)/availability.tsx` has loading/error/editor precedence, persistent read-only retry, hidden editor/footer before success, and a save guard for loading/error/saving. Returned windows are grouped without changing their object fields; exceptions are retained and sent with the existing flat-map payload. Multiple windows, exception IDs/reason, repeated rejection, pending retry, successful empty, repeated save blocking and rejection recovery are meaningfully tested. Cold/warm back and post-save role fallback use the existing helper.
- Task 3: `app/(employee)/appointment/[id].tsx` combines all four existing mutation pending flags and passes disabled to every conflicting footer action and action-specific loading. Existing handlers, alerts, haptics, mutation booking IDs, permission/cancellation decisions, eligibility and meeting-start/video branches are unchanged in the actual delta. Footer state precedes early returns; full measured height plus spacing is reserved without adding the safe inset twice. Test emits height 310 with bottom inset 34, and preserves prior error/cached-sensitive-data and role/back protections.
- Task 4: employee names/services/contact/history text can grow, current locale font/type roles are consumed, phone/email/time changes use natural LTR, and middle/status layouts can shrink or wrap. Existing order, card presses, date mapping, seven-day selection and week-shift callbacks remain intact. List staggers are capped and the existing reduce-motion hook suppresses entrances. Client record loading/error/success now retain a real header/back control with the employee clients fallback. Native geometry, reduced-motion observation and enlarged text remain unverified.
- Task 5: all three tab layouts consume the shared hook; existing route arrays and single AR reversal are preserved; employee minimize behavior remains. Client product layout already complied and needed no redundant edit. Employee profile renders the shared no-props AboutSection once and removes fabricated 1.0.0/Arabic-only copy while retaining availability/privacy/logout/profile-refresh behavior. Tests cover native version/build, Expo fallback, missing metadata and both locale tab font/order contracts. Correct Expo property `nativeApplicationVersion` is used.
- Extra remedy: current `components/ui/AppButton.tsx` changes only enabled light brand unfilled foreground selection to `palette.teal[900]`; neutral foreground, dark mint, borders, API and producer contracts are preserved. New contrast tests blend the actual white .18 light wash over the supplied darkest current Aqua sample RGB(49,151,175), then inspect rendered foreground for secondary and ghost variants. Red log demonstrates 2.45376 contrast before the remedy; green log passes both new cases and all 12 existing cases. Source matches the narrow remedy. The reported whole-asset 4.73 minimum was not recomputed by this read-only reviewer; the sample and wash are the explicit test assumption, and an asset/wash change must revisit it.

## Quality verdict

PASS; no actionable P0–P3 findings found in the reviewed employee delta or narrow Aqua remedy. The change stays within the approved presentation/read-recovery scope and reuses foundation contracts rather than introducing a competing implementation. No services, query hooks, auth, payments, encryption, migrations, provider, video activation or server contracts changed in this delta. Existing employee-appointment styles/back tests remained unchanged because source contracts already supported the consumer changes.

The pending-action tests exercise UI flag handling and rejection callbacks with mocked mutation hooks; they do not establish real provider/native request transitions. Geometry/animation edits are correctly left to native acceptance rather than style-mirroring assertions.

## Evidence read

Employee worktree: `/Users/tariq/.codex/worktrees/mobile-ui-employee/sawaa`.
Review artifacts: `/Users/tariq/.codex/worktrees/mobile-ui-unification/sawaa/.superpowers/sdd/2026-10-07-mobile-ui-foundation`.

Read actual focused logs: Task 1 5/5; Task 2 initial 3/3 (historic open-handle warning); Task 3 32/32; Task 4 11/11; Task 5 18/18; final focused regression 43/43. Later Task 4/final logs exit cleanly after the unused transport boundary mock, with real toggle helper retained. Read Aqua red (2 fail, 12 pass) and green (14 pass) logs and test/production source. No test/lint/build/typecheck or native validation command was run by this reviewer; coordinator owns final integrated checks.

## Outstanding acceptance

Employee AR/EN × light/dark × 320pt/large phone × 100%/200% text matrix is not supplied here. Still required: long identity/service/contact/date/status readability; seven WeekStrip dates and both week shifts; actual last list/history row and footer reachability; pending/error/retry native presentation; immediate scroll of 30+ rows with reduced motion on/off; native role tab font/label fit. Any foundation AR light/dark examples already observed do not substitute for these employee cases. Android, physical devices and real backend/provider flows remain unverified. Dormant R18–R20 stay deferred.

## Measurement

Baseline captured before source review: `/Users/tariq/.codex/routing-review/employee-review-before-20261007.json`, fixed window `20261007`, upstream total 119322. Initial review brief/policy reads preceded baseline; measurement scope is partial and whole-task consumption is unknown. Coordinator was notified of actual session and path early. This review report is not task acceptance or permission to mark a complete usage receipt.
