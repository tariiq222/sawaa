# Dashboard audit remediation implementation plan

> For agentic workers: use executing-plans with systematic-debugging and test-driven-development for scoped bug fixes.

**Goal:** Resolve every remaining finding of the 2026-10-08 dashboard audit, verify the integrated candidate and merge into develop only.
**Architecture:** Preserve existing NestJS handlers, typed API adapters and TanStack Query flows. Correct data loss at the persistence boundary, money units at display/export boundaries and Saudi calendar periods at query boundaries. Align UI actions with existing server permissions; do not broaden role policy.
**Tech stack:** NestJS/Prisma/Postgres, Next.js/React, Jest/Vitest/Playwright.
**Spec:** ../../audits/2026-10-08-dashboard-pages-audit.md; checklist.md contains the complete per-section findings.

## Constraints
- Preserve DEFAULT_ORG_ID/AAD, PLATFORM_SETTINGS_KEY, VAT 0, immutable migrations and existing clinic/service booking contract.
- Synthetic disposable local infrastructure only. No production operations or live data changes.
- Report findings are hypotheses until owning source and behavior reproduce them.
- Every remaining report item is in scope, including low-severity items; corrections to false claims require source evidence.
- Coordinator owns integration, navigation/shared permissions, translation registry, OpenAPI regeneration, smoke/Sandbox verification, CI and develop PR merge.

## Review focus
- Editing schedules without exceptions must preserve leave; explicit empty arrays must clear only their own collection.
- Existing SMS secrets must survive sender-only edits and reject incomplete replacement credentials.
- Reports must include the entire Riyadh final day, display SAR from integer halala and label differing revenue bases.
- Partial refunds must retain remaining refund actions; bank transfers must never select a card gateway because of an administrative reference.
- Failed multi-step creation must retry against the same record, with UI disabled during submission.

## Task 1: People and credentials (coordinator)
Files: employees/clients/users/profile/SMS components, corresponding hooks/API/types/schemas, backend people/identity user/SMS configuration handlers and tests.
1. Reproduce employee exception deletion and SMS blank-secret replacement with failing handler regressions.
2. Preserve omitted collections/credentials; keep explicit clearing semantics and validation.
3. Test identifiers, names, service removal, empty schedules, nullable fields, permissions, feedback and all report details for these sections.
4. Use targeted Jest/Vitest RED→GREEN; record each resolution in a separate evidence document.

## Task 2: Finance/reporting (independent worker)
Files: home/reports/payments/invoices/coupons dashboard surfaces and backend finance/reporting corresponding handlers. Worker owns a new pure Riyadh date helper under lib/audit-date.ts and a translation pair ar/en.audit-finance.ts.
1. Reproduce wrong final-day periods and halala Excel/chart output, refund action and routing defects.
2. Correct units, periods and refund branches preserving payment invariants; cover fixed amount decimals/percent validation and clearing.
3. Resolve every finance/report/home/coupon/invoice report item with targeted tests; provide date helper signature to coordinator before other consumers use it.
4. Coordinator runs real Sandbox and integrated smoke after reviewing these changes.

## Task 3: Catalog (independent worker)
Files: departments/categories/services/packages dashboard surfaces and backend catalog corresponding handlers. Read clinic-service-booking-contract.md first. Worker owns ar/en.audit-catalog.ts.
1. Reproduce pagination omissions, nullable clearing, retry duplication and package-family form defects.
2. Correct fetch-by-id/list pagination, resumable creation and file upload/archive flows without changing booking mode.
3. Cover repeated submission and retained created record after upload failure; resolve all catalog report items and provide focused evidence.

## Task 4: Operations (independent worker)
Files: programs/activity-log/notifications/ratings/contact-messages/conversations/intake-forms dashboard surfaces and corresponding backend operations handlers. Worker owns ar/en.audit-operations.ts.
1. Verify each report finding against endpoints and rendered behavior, highest risk first.
2. Correct filters, pagination, details, mutation feedback, translations, preview/validation and loading/error states.
3. Keep existing permissions; if endpoint self-notification permission mismatches, scope narrowly to authenticated user's own records and cover unauthorized record access.
4. Resolve all assigned findings and provide focused RED→GREEN/test evidence.

## Task 5: Shared navigation/bookings and integration (coordinator)
1. Align sidebar/page/create actions with existing CASL/backend permissions, role display and breadcrumbs; use links and safe errors.
2. Fix booking filters/sort/retry/client terminology and report shared patterns.
3. Integrate reviewed lane commits; register translation modules, regenerate OpenAPI from owned local candidate and manually update hand-written clients where consumed.
4. Run full relevant types/lint/i18n/tests, real local endpoints, dashboard smoke and Moyasar Sandbox acceptance; fix failures before proceeding.
5. Run independent whole-candidate code review, publish task PR, require hosted gate + critical-real-e2e success on final head, then merge into develop. Verify staging revision separately; no production.
