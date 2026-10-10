# Operations audit evidence — 2026-10-10

Scope: A012–A017, A077–A083, A103–A116, A134–A140 (34 findings) from `docs/audits/2026-10-08-dashboard-pages-audit.md`. Native isolated worktree: `/Users/tariq/.codex/worktrees/dashboard-audit-operations/sawaa`. Actual checkout baseline: `5f6b9ad0b71d55953d16562c8726c92652759ed4`, descendant of requested `cfec2623b` with the OpenShip health documentation/code commits already present. Verified implementation commit: `38f3d89942bc8f2e7e2ab90066655767b5c5d4a9`. This following evidence-only commit records its immutable SHA. Staged dashboard/backend ESLint and legacy multi-tenant guard passed during that commit.

Diagnosis used current source and focused synthetic tests, not historical assertions alone. Tests only use the safe runner `/Users/tariq/.codex/release-evidence/2026-10-10-four-groups-integration/run-safe.mjs`; no live database, provider sends, root `.env`, payment workflow changes, role policy changes, or migrations. Provider keys, encryption constants, zero VAT and the booking contract were preserved. Parent owns integration, OpenAPI snapshot regeneration, generated dashboard types, full checks and smoke.

## Per-finding source, behavior and evidence

Source paths below are relative to repository root; frontend feature paths abbreviate `apps/dashboard/components/features/`, hook paths `apps/dashboard/hooks/`. Test paths abbreviate `apps/dashboard/test/unit/`; backend test names live beside their owning handler/controller.

| ID | Current source / verified cause | Result / verification |
|---|---|---|
| A012 | `activity-log/activity-log-tab.tsx`: server metadata not passed to DataTable | Server pagination, all 20 returned rows, next requests page 2; `features/activity-log/audit-activity.spec.tsx` |
| A013 | activity actions disagreed with backend Action enum | Unsupported approved/rejected removed; supported export/import/system added; rendered filter assertion in audit-activity |
| A014 | `apps/dashboard/lib/api/activity-log.ts`: date-only end boundary | Riyadh day start and inclusive .999 end; `lib/activity-log-api.spec.ts` |
| A015 | activity columns/filters used raw action/entity | Known actions/modules translated, unknown labels preserved; audit-activity + `features/activity-log/activity-log-columns.spec.tsx` |
| A016 | `app/(dashboard)/activity-log/page.tsx` requested setting while API reads Report | Page now report:read; endpoint permission unchanged (source check) |
| A017 | `apps/backend/src/api/dashboard/comms.controller.ts`: own inbox mutation required Booking update | Narrow endpoint uses existing Booking read; Jwt/CASL unchanged, handler remains recipientId=current user; `comms.controller.spec.ts` validates permission metadata and rejects supplied recipient; `mark-read.handler.spec.ts` proves outsider ID untouched |
| A077 | programs page OPEN default and no-op onSelect, unreachable edit | ALL plus six persistent status filters, real detail Link and permitted edit Link; `features/programs/audit-programs.spec.tsx`; write routes/actions aligned with backend manage:Booking via `audit-program-permissions.spec.tsx` + transition test |
| A078 | `programs/program-form-page.tsx`: await save without catch | Localized alert, preserved form, no navigation on rejection; real query/mutation/component test `components/features/program-form-page-edit-routing.spec.tsx` |
| A079 | program form basics omitted existing public fields | isPublic/publicDescriptionAr/publicDescriptionEn inputs; real edit test asserts PATCH payload values |
| A080 | enrollments table sliced clientId; handler omitted name | Batched lookup of actual enrollment client IDs, nullable clientName with localized unavailable fallback; audit-programs + `get-program.handler.spec.ts` |
| A081 | programs page lacked common shell/loading branch | ListPageShell/Breadcrumbs/PageHeader + explicit loading; audit-programs loading assertion and source shell review |
| A082 | full badge overrode terminal status | Full badge limited to OPEN/MIN_REACHED; cancelled/full test in audit-programs |
| A083 | detail omitted descriptions/supervisors | Batched supervisor name response and rendered description/names; `program-transition-errors.spec.tsx` + get-program handler |
| A103 | ratings handler omitted practitioner display data | Batched employee response and localized card names; `features/ratings/audit-ratings.spec.tsx` + `list-ratings.audit.spec.ts` |
| A104 | one shared pending mutation disabled all rating cards, errors silent | Mutation observer per card, only pending row disabled, success/error feedback; audit-ratings interactions |
| A105 | ratings view had no average | Backend aggregate over all matched ratings independently of page; card view displays average; audit-ratings and list-ratings.audit page2/total30 fixture |
| A106 | contact column truncated body | Expandable native details with full whitespace-preserved message; `features/contact-messages/audit-contact.spec.tsx` |
| A107 | contact email fallback hid phone | Both methods displayed; audit-contact |
| A108 | contact loading returned before filters | Persistent real FilterBar with loading skeleton; `contact-messages-table.spec.tsx` combobox loading test |
| A109 | contact mutations lacked callbacks | Success/error toast; audit-contact rejected mark-read interaction |
| A110 | handoff keys absent in both locale dictionaries | Two locale modules contain all summary fields and five categories; `lib/audit-operations-translations.spec.ts` checks parity, text and categories; parent registration required |
| A111 | `conversations/conversation-detail.tsx` transcript unbounded/no scroll | Fixed 420px overflow transcript and effect scrolling to latest message; conversation-inbox rendered log + source effect review |
| A112 | bubbles omitted times and treated system events as client | DateTime time elements in Riyadh and centered SYSTEM/SYSTEM_EVENT status bubbles; `features/conversations/conversation-inbox.spec.tsx` |
| A113 | conversation calendar ISO conversion used UTC | Day boundaries via finance Riyadh helper and date values round-trip; conversation-inbox filter boundary tests |
| A114 | conversation list showed only clock | Riyadh date + time + year in list; conversation-inbox/source Intl options |
| A115 | `use-conversations.ts` used every search keystroke | Search-only 300ms debounce; `hooks/audit-conversation-search.spec.tsx` fake-clock request count; other filters immediate |
| A116 | inbox cursor existence constrained by mutable unread/search/status filters | Cursor verifies durable authorization scope, final query still filters; `list-inbox.audit.spec.ts` read cursor survives and outsider rejected + existing list-inbox suite |
| A134 | `use-intake-forms.ts` read search but never applied; list API returns entire array, no paginated/search contract | Local filter of all fetched Arabic/English names, URL replace; `hooks/use-intake-forms.spec.tsx` matches later entry and clears search without unsupported API query |
| A135 | intake list unconditionally rendered empty table while loading/error | Explicit loading/error/retry; `features/intake-forms/audit-list-states.spec.tsx` never claims empty on loading/error |
| A136 | preview navigated to edit; unused condition editor had no imports | Separate interactive preview route with local input controls; audit-list-states destination + `audit-preview.spec.tsx`; dead file removed after source reference search |
| A137 | list handler returned scopeLabel:null TODO, mapper discarded it | Batched actual target IDs into service/employee/branch labels, mapper preserves label; `list-intake-forms.handler.spec.ts` resolves service outside first-page assumptions; audit-list-states rendered name |
| A138 | intake page saved empty names/questions/options without local checks | Local Arabic-required/English-optional validation, targeted scope requirement and selectable options; backend rejects blank Arabic text/empty option types; `audit-validation.spec.ts`, create/update/set-fields DTO suites. Scope existence already enforced by `intake-form.helpers.ts` and was preserved |
| A139 | intake detail redirect route rendered English Loading | Actual preview route localized loading/error; source detail route review + audit-list-states loading |
| A140 | intake page requested only limit100 once | useInfiniteQuery selectors with load-more/retry UI for employee/service/branch; `hooks/audit-intake-options.spec.tsx` later page + Arabic name |

## Endpoint contracts and integration dependencies

- GET `/api/v1/dashboard/programs/{id}` remains authorized by read:Booking, accepts UUID/numeric ref, returns its existing fields plus `supervisors: {id:string,name:string,nameEn:string|null}[]` and each enrollment adds `clientName:string|null`. New `ProgramDetailResponseDto`, nested booking/enrollment/supervisor DTOs and @ApiOkResponse document the full actual response (price/deposit are halala decimal strings). Program create/edit routes and actions use existing manage:Booking, matching unchanged backend writes.
- GET `/api/v1/dashboard/organization/ratings` keeps query `page`, `limit`, `employeeId`, `clientId`. Adds `items[].employee:{id,name,nameEn}|null`, `averageRating:number|null` calculated over the whole matched result. New `OrganizationRatingsResponseDto` documents actual `score` plus six-field pagination metadata, nullable client/employee and average. Dashboard separate handwritten `lib/api/ratings.ts` normalizes score to stars. No packages/api-client caller uses the altered response fields.
- Intake list existing array contract unchanged; existing `scopeLabel:string|null` now populated. Create/PATCH/PUT-fields now reject whitespace-only Arabic name/label and missing/blank RADIO/SELECT/CHECKBOX options; English stays optional. Existing scope validation remains. Parent must sync OpenAPI after DTO changes.
- Own notification mark-read body remains optional notificationId only. Narrow permission changed from Booking update to Booking read; authenticated recipient is never caller-selected. Inbox cursor response shape unchanged.
- Parent must register `arAuditOperations`/`enAuditOperations` spreads in shared locale registry. Local real LocaleProvider tests emit missing-key warnings until that integration; direct locale-module parity/text checks pass. Finance-owned `lib/audit-date.ts` was copied only for local tests and is deliberately not staged or committed; integration supplies its exact riyadhDate/riyadhDayStart/riyadhDayEnd exports. Parent owns generic date display corrections.

## Focused verification

2026-10-10 local results, using the safe-runner prefix for every pnpm command:

1. Primary dashboard: 16 files / 66 tests passed at 20:10:47 Riyadh; `pnpm --dir apps/dashboard exec vitest run` with paths below.
2. Extra intake list states: 1 file / 3 tests passed at 20:11:38; `pnpm --dir apps/dashboard exec vitest run test/unit/features/intake-forms/audit-list-states.spec.tsx`.
3. Adjacent dashboard regression: 14 files / 78 tests passed at 20:06:45 (overlaps some primary tests; counts are not summed).
4. Backend: 14 files / 162 tests passed; `pnpm --dir apps/backend exec jest --runInBand --runTestsByPath` with paths below.
5. Initial staged commit lint found explicit-any test fixture types; corrected those and reran their two behavior specs. ESLint limited to changed existing/new dashboard production .ts/.tsx files (excluding finance helper) exited 0; `git diff --check` exited 0. No full build/lint/test suite run by this lane. Parent performs integrated typecheck/smoke and OpenAPI sync.

Primary dashboard test arguments:

```text
test/unit/features/programs/audit-programs.spec.tsx
test/unit/features/programs/audit-program-permissions.spec.tsx
test/unit/features/programs/program-transition-errors.spec.tsx
test/unit/features/intake-forms/audit-validation.spec.ts
test/unit/features/intake-forms/audit-preview.spec.tsx
test/unit/features/ratings/audit-ratings.spec.tsx
test/unit/features/contact-messages/audit-contact.spec.tsx
test/unit/features/activity-log/audit-activity.spec.tsx
test/unit/lib/activity-log-api.spec.ts
test/unit/features/conversations/conversation-inbox.spec.tsx
test/unit/hooks/audit-conversation-search.spec.tsx
test/unit/hooks/audit-intake-options.spec.tsx
test/unit/hooks/use-intake-forms.spec.tsx
test/unit/components/features/program-form-page-edit-routing.spec.tsx
test/unit/lib/audit-operations-translations.spec.ts
test/unit/features/contact-messages/contact-messages-table.spec.tsx
```

Adjacent regression arguments:

```text
test/unit/hooks/audit-intake-options.spec.tsx
test/unit/features/contact-messages/contact-messages-table.spec.tsx
test/unit/hooks/use-activity-log.spec.tsx
test/unit/hooks/use-programs.spec.tsx
test/unit/hooks/use-ratings.spec.tsx
test/unit/hooks/use-contact-messages.spec.tsx
test/unit/hooks/use-conversations.spec.tsx
test/unit/components/features/submit-program.spec.ts
test/unit/features/programs/program-dialog-errors.spec.tsx
test/unit/features/programs/program-transition-errors.spec.tsx
test/unit/features/intake-forms/save-flow.spec.tsx
test/unit/features/intake-forms/field-editor.spec.tsx
test/unit/lib/mappers/intake-form.spec.ts
test/unit/features/activity-log/activity-log-columns.spec.tsx
```

Backend arguments:

```text
src/modules/bookings/get-program/get-program.handler.spec.ts
src/modules/org-experience/ratings/list-ratings.audit.spec.ts
src/modules/comms/chat/staff/list-inbox.audit.spec.ts
src/modules/comms/chat/staff/list-inbox.handler.spec.ts
src/modules/comms/notifications/mark-read.handler.spec.ts
src/api/dashboard/comms.controller.spec.ts
src/modules/org-experience/intake-forms/list-intake-forms.handler.spec.ts
src/modules/org-experience/intake-forms/create-intake-form.dto.spec.ts
src/modules/org-experience/intake-forms/update-intake-form.dto.spec.ts
src/modules/org-experience/intake-forms/set-intake-fields.dto.spec.ts
src/api/dashboard/programs.controller.spec.ts
src/api/dashboard/organization-settings.controller.spec.ts
src/modules/org-experience/ratings/ratings.handler.spec.ts
src/modules/org-experience/ratings/list-ratings.handler.spec.ts
```

Observed RED→GREEN included hidden program filters/name link, cancelled badge, intake blank/options validation, rating employee/average/error behavior, search request count, notification permission metadata, and inbox cursor predicate. Added selector name regression failed with English 1 vs أخصائي 1 before correction; new program permission tests failed (3 assertions) before manage gates; Swagger response tests failed without schemas before DTOs. Focused existing mocks were updated for the new ratings aggregate/employee lookup, removing an old swallow-all-errors list test. No failures remain in the listed final commands.

Unverified here: integrated browser flows, full TypeScript checks, generated OpenAPI snapshot/types, real disposable-database acceptance, staging and owner manual acceptance. This record proves local focused behavior, not deployment or live-provider acceptance. Token attribution remains unknown; no consumption saving claim.
