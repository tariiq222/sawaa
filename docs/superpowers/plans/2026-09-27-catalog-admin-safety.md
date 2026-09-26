# Catalog administration safety implementation

Approved by the owner on 2026-09-27: implement the reviewed proposal; use a Luna team.

Spec: `/Users/tariq/.codex/visualizations/2026/09/26/01a0dfd9-9b12-7312-b53f-5a015585f56d/sawaa-catalog-safe-proposal-20260927.md`.
Base: `0647f627334c6de5ce4c4441b796de5eb29a1b08`.
Workspace: `/Users/tariq/.codex/worktrees/catalog-admin-safety/sawaa`.

## Global Constraints

- Preserve current IDs, category/department bindings, prices, practitioners, bookings, snapshots and package entitlements. No migration, production data mutation, commit, push, merge or deployment.
- Keep public/mobile API shapes and shared catalog selectors unchanged. Do not filter internal services out of `useAllServices` or package pickers.
- An internal clinic booking service is `isHidden === true` AND `category.bookingMode === "DIRECT"`; ordinary hidden services are not internal services.
- Read root AGENTS.md and affected CLAUDE.md. Each worker owns only its assigned files; other people are working in this repository. Do not revert others. No child agents.
- Use TDD for behavioral changes. Workers may run only their explicitly scoped tests for RED/GREEN; coordinator owns integrated checks and dashboard smoke. No broad worker build/lint/test suites.
- Use Arabic/English translation parity and existing UI primitives. Keep identity edits for internal service at clinic level; pricing/duration and booking settings remain available in its service editor.
- Shared dashboard helper supplied by coordinator: `@/lib/service-catalog`, exported `isDirectClinicBookingService(service)` accepts `{ isHidden: boolean; category?: { bookingMode?: string } | null }` and returns boolean.
- Worker 1 owns `ar.services.ts` and `en.services.ts` including `services.clinicBooking` (حجز العيادة / Clinic booking) and `services.manageClinic` (إدارة العيادة / Manage clinic) consumed by coordinator. No other task edits these translations concurrently.

## Task 1: Service form and category entry flow

Target: dashboard service create/edit flow. Own `components/features/services/create/basic-info-tab.tsx`, `service-form-page.tsx`, associated new form-only helpers/components/tests, `category-services-tab.tsx`, `lib/translations/ar.services.ts`, `en.services.ts`. Do not change list columns, service-detail-sheet, shared query hooks/API types, backend or coordinator helper.

Change:
1. Replace department/category pair with one required clinic or service-group selector; department is read-only derived text if present.
2. On create, allow only SERVICES categories (legacy missing bookingMode follows existing SERVICES default). DIRECT is not a create option.
3. Preserve origin categoryId in Add service navigation. Preselect asynchronously without overwriting user edits. Valid category context returns to originating category services tab after save/cancel; use known local routes/ref, no arbitrary return URL.
4. Invalid/missing/DIRECT category context must display a clear state and management/back link, and prevent submission; do not silently fallback to another category. Errors/loading must not be treated as missing too early.
5. On edit preserve saved categoryId even when hidden, unavailable or legacy DIRECT. Do not reset it due to filtering/fetching. Internal service name/category/visibility are readonly with clinic management link, while other settings remain editable. Ensure save payload respects existing backend constraints.
6. Clarify category type with examples and booking labels: الحجز باسم العيادة / اختيار خدمة داخل العيادة. Explain optional department organization; preserve all kind/mode values and immutable mode behavior.

Acceptance: focused component/behavior tests proving creation selection, derived department, valid context return, bad DIRECT/missing context blocking, and legacy/internal edit preservation. Run only new/affected dashboard tests using `pnpm --dir apps/dashboard exec vitest run <explicit files>` for RED/GREEN; report exact commands and results. Read TDD skill and writing-good-tests before tests. Return changed files and unresolved concerns in the assigned report.

## Task 2: Service deletion safety

Target: backend archive-service handler. Own only `apps/backend/src/modules/org-experience/services/archive-service.handler.ts` and its colocated spec (plus a scoped helper if truly necessary).

Change: reject general deletion/archival of an internal clinic service using both isHidden and category DIRECT. Inspect actual schema and protect all service references in package definitions, purchased package groups, credits/constraints: a service with package references must remain usable and must not be hard-deleted or archived. Conservatively reject deletion when referenced; do not modify entitlement data. Existing ordinary unreferenced deletion and booking-only archival behavior should remain. Preserve endpoint/DTO shape. Errors should follow existing stable error-code conventions and explain the blocked deletion. No booking/payment engine changes.

Acceptance: focused Jest tests showing internal deletion blocked with and without bookings; ordinary hidden service unaffected; package reference paths blocked even with zero bookings; existing unreferenced deletion and booking-only archival preserved. Run only `pnpm --dir apps/backend exec jest --runInBand src/modules/org-experience/services/archive-service.handler.spec.ts` for RED/GREEN. Read TDD skill and writing-good-tests first. No database writes or broad checks. Report all checked reference models and limitations.

## Task 3: Coordinator internal-service presentation and integration

Own `apps/dashboard/lib/service-catalog.ts`, `service-columns.tsx`, `service-detail-sheet.tsx`, `services-tab-content.tsx` as needed, their focused tests, architecture documentation and this plan/report.

Add shared predicate. Badge internal rows as clinic bookings. Suppress delete only for internal rows; keep edit/settings access and ordinary hidden service actions. Respect existing action permissions. Do not globally filter service data. Verify classifier/actions with focused behavior tests.

After workers: review actual patches, run affected dashboard/backend suites, translation parity, typechecks and scoped lint. Run public website/shared/mobile catalog regression coverage appropriate to unchanged contracts. Run required dashboard smoke on isolated local runtime/data; never reuse production or mutate another active worker's resources. Fresh Luna reviewer checks task compliance and quality on the combined diff. Record acceptance evidence and environment limits. Retain worktree for review, no automatic commit/deploy.
