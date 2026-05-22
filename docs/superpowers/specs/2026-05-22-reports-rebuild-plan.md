# Reports Rebuild — Implementation Plan

**Date:** 2026-05-22
**Branch:** `feat/reports-rebuild`
**Companion spec:** [`2026-05-22-reports-rebuild-design.md`](./2026-05-22-reports-rebuild-design.md)

This plan executes in 7 stages. Stages 1–2 are sequential foundations. Stages 3–6 run in parallel. Stage 7 finalizes.

---

## Stage 1 — Backend foundation (sequential)

**Goal:** Extend the contract so the dashboard has something to call against.

### 1.1 Prisma — extend `ReportType` enum

File: `apps/backend/prisma/schema/ops.prisma`

```prisma
enum ReportType {
  REVENUE
  ACTIVITY
  BOOKINGS
  EMPLOYEES
  OVERVIEW
  CLIENTS
  SERVICES
  RATINGS
}
```

Create migration:
```bash
cd apps/backend
npx prisma migrate dev --name extend_report_type --create-only
# inspect SQL — should be ALTER TYPE … ADD VALUE statements
npm run prisma:migrate
```

### 1.2 DTO — extend type enum + add compare flag

File: `apps/backend/src/modules/ops/generate-report/generate-report.dto.ts`

Add:
```ts
@ApiPropertyOptional({ description: 'Include previous-period comparison', example: false })
@IsOptional()
@IsBoolean()
compareWithPrevious?: boolean;
```

The `@IsEnum(ReportType)` automatically picks up the new values from the Prisma client. Re-generate: `npx prisma generate`.

### 1.3 Handler — dispatch + compare

File: `apps/backend/src/modules/ops/generate-report/generate-report.handler.ts`

Refactor:
- Extract the inline `buildBookingsReport` and `buildEmployeesReport` to new files: `bookings-report.builder.ts` and `employees-report.builder.ts`.
- Add `switch (dto.type)` over all 8 types.
- When `dto.compareWithPrevious === true`, compute `previousFrom`, `previousTo` (length-symmetric), run main and previous builders via `Promise.all`, return `{ ...current, previous }`.

### 1.4 New builders (4 files)

Create under `apps/backend/src/modules/ops/generate-report/`:

- `overview-report.builder.ts`
- `clients-report.builder.ts`
- `services-report.builder.ts`
- `ratings-report.builder.ts`

Each exports `async function build<Name>Report(prisma: PrismaService, args): Promise<<Name>Report>`. See spec §6.2 for return shapes.

**Overview builder query plan** (single trip via `Promise.all`):
- Revenue sum + booking counts: `prisma.payment.aggregate` + `prisma.booking.count`.
- Booking status counts (for completion %): `prisma.booking.groupBy({ by: ['status'] })`.
- New clients in range: `prisma.client.count({ where: { createdAt: { gte: from, lte: to } } })`.
- Trend: `prisma.booking.findMany({ select: { scheduledAt, price, status } })` then group in TS by day.
- Top services: `prisma.booking.groupBy({ by: ['serviceId'], _count: { _all: true }, take: 4 })` + lookup nameAr/En.
- Top practitioners: same pattern as services, grouped by `employeeId`.

**Clients builder:**
- `new` = clients whose `createdAt` falls inside range.
- `returning` = clients with ≥ 1 booking inside range AND `createdAt < from`.
- `retention` = `returning / (returning + new)`.
- By gender / age: group clients (joined to bookings in range) by `gender` and bucketed `dateOfBirth`.

**Services builder:** group bookings in range by `serviceId`; for each, count + sum revenue from related `Payment` rows (status COMPLETED) + cancel rate = cancelled count / total count + averageRating via Rating join on bookingId.

**Ratings builder:**
- `prisma.rating.aggregate({ _avg: { score }, _count: true })`.
- Distribution: `prisma.rating.groupBy({ by: ['score'] })`.
- Trend: ratings in range grouped by day, average per day.
- Negative: `findMany({ where: { score: { lte: 3 } }, take: 20, orderBy: { createdAt: 'desc' }, include: { client, employee, booking: { include: { service } } } })`.

### 1.5 Enhance existing builders

- `revenue-report.builder.ts`: add `byDay`, `byStatus`, `refundsTotal`, `couponsUsed`, `recentPayments` to existing output.
- `bookings-report.builder.ts` (new file extracted from handler): add `noShowRate`, `cancelRate`, `avgDurationMins`, `byHourDow`, `byCancelReason`.
- `employees-report.builder.ts` (new file extracted from handler): rename output to match `PractitionersReport` shape; join `Rating` for real `averageRating`; compute `utilization` from `EmployeeSchedule` (if present).

### 1.6 Excel export

File: `apps/backend/src/modules/ops/generate-report/excel-export.builder.ts`

Add 5 new builder functions following the existing pattern. Each receives the JSON shape and returns a `Buffer`. Use the existing `xlsx` helper.

Wire into the handler's `if (format === ReportFormat.EXCEL)` branch via a small dispatch map:
```ts
const excelBuilders: Record<ReportType, ((data: unknown) => Promise<Buffer>) | undefined> = {
  REVENUE: buildRevenueExcel,
  ACTIVITY: buildActivityExcel,
  BOOKINGS: buildBookingsExcel,
  EMPLOYEES: buildPractitionersExcel,
  OVERVIEW: buildOverviewExcel,
  CLIENTS: buildClientsExcel,
  SERVICES: buildServicesExcel,
  RATINGS: buildRatingsExcel,
};
```

### 1.7 Controller — no changes

The endpoint `POST /dashboard/ops/reports` stays. Its DTO already covers everything via the extended enum + new flag.

### 1.8 Tests

For each new builder, create `<builder>.spec.ts`. Pattern:
```ts
describe('buildOverviewReport', () => {
  it('returns zero KPIs when no bookings', async () => { … });
  it('aggregates revenue, bookings, new clients across range', async () => { … });
  it('top services sorted by count desc with at most 4 rows', async () => { … });
});
```

E2E: `apps/backend/test/reports.e2e-spec.ts` — POST each type, assert 200, JSON shape sanity.

### 1.9 OpenAPI

```bash
cd apps/backend && npm run openapi:build-and-snapshot
```
Commit `apps/backend/openapi.json` changes in the same commit as the handler changes.

### 1.10 Verify backend stage

```bash
cd apps/backend && npm run typecheck && npm run test && npm run test:e2e
```
All green before moving on.

---

## Stage 2 — Frontend foundation (sequential, after stage 1)

### 2.1 Install recharts

```bash
pnpm --filter=dashboard add recharts
```

### 2.2 Update types

File: `apps/dashboard/lib/types/report.ts`

Add interfaces from spec §6.2. Add `WithPrevious<T>` generic.

### 2.3 Update query keys

File: `apps/dashboard/lib/query-keys.ts`

Add:
```ts
reports: {
  overview: (params) => [...],
  revenue: (params) => [...],          // exists
  bookings: (params) => [...],         // exists
  clients: (params) => [...],
  practitioners: (params) => [...],
  services: (params) => [...],
  ratings: (params) => [...],
  employeeDetail: (id, params) => [...], // for modal drill-down
}
```

### 2.4 Update API client

File: `apps/dashboard/lib/api/reports.ts`

Add 4 new fetchers: `fetchOverviewReport`, `fetchClientsReport`, `fetchServicesReport`, `fetchRatingsReport`. Extend `fetchRevenueReport`, `fetchBookingReport`, `fetchEmployeeReport` to accept `compareWithPrevious?: boolean`.

### 2.5 Extend period hook

File: `apps/dashboard/hooks/use-reports-period.ts`

Add preset values: `today`, `last7`, `thisMonth`, `lastMonth`, `thisYear`, `custom`. Add `previousRange` getter returning `{ from, to }` for the previous symmetric range.

### 2.6 Verify frontend foundation

```bash
pnpm --filter=dashboard run typecheck
```

---

## Stages 3–6 (parallel) — UI build

Once Stage 2 lands, four independent tracks run together.

### Stage 3 — Shared primitives + layout shell

Owner deliverables:

- `components/features/reports/reports-sidebar.tsx` — 3 groups × 7 items, sticky, RTL.
- `components/features/reports/reports-toolbar.tsx` — period chips + branch select + export button.
- `components/features/reports/reports-period-filter.tsx` — replaces existing `period-filter.tsx`.
- `components/features/reports/kpi-card.tsx` — title, big tabular value, colored delta chip (up/down/flat).
- `components/features/reports/kpi-row.tsx` — 4-col responsive grid (collapses to 2 then 1).
- `components/features/reports/trend-chart.tsx` — recharts AreaChart wrapper with compare overlay support.
- `components/features/reports/donut-list.tsx` — donut + adjacent legend list.
- `components/features/reports/distribution-bars.tsx` — horizontal bar list with percentages.
- `components/features/reports/heatmap.tsx` — 7-day × 5-hour grid, intensity by token opacity.
- `components/features/reports/insight-banner.tsx` — colored callout for "💡 …".
- `components/features/reports/empty-state.tsx` — shared illustration + CTA "غيّر الفترة".
- `app/(dashboard)/reports/layout.tsx` — wraps `ReportsSidebar` + `ReportsToolbar` and renders `{children}` inside the right column.
- `app/(dashboard)/reports/page.tsx` — server redirect to `/reports/overview`.

Unit tests for each primitive under `apps/dashboard/test/unit/components/reports/`.

### Stage 4 — Pages 1-4 (Overview, Financial, Bookings, Practitioners)

These match the signed-off mockup directly.

- `app/(dashboard)/reports/overview/page.tsx` + `components/features/reports/pages/overview-report.tsx`
- `app/(dashboard)/reports/financial/page.tsx` + `financial-report.tsx`
- `app/(dashboard)/reports/bookings/page.tsx` + `bookings-report.tsx`
- `app/(dashboard)/reports/practitioners/page.tsx` + `practitioners-report.tsx`
- `hooks/use-overview-report.ts`, `use-financial-report.ts`, `use-bookings-report.ts`, `use-practitioners-report.ts` — each thin wrapper around `useQuery` keyed on the spec's range.

Each page wires the primitives from Stage 3 to its specific data. Unit tests render with mocked query data and assert KPI labels + chart presence.

### Stage 5 — Pages 5-7 (Clients, Services, Ratings)

Designed in this plan; visual grammar matches Stages 3-4.

**Clients:**
- KPIs: عملاء جدد، عملاء عائدون، معدل الاحتفاظ، متوسط الجلسات / عميل.
- Donut: ذكور / إناث / غير محدد.
- Distribution bars: فئات عمرية.
- Table: top 10 by revenue.

**Services:**
- KPIs: عدد الخدمات، أعلى خدمة حجزاً، أعلى خدمة إيراداً، متوسط التقييم العام.
- Table sortable by: عدد الحجوزات، الإيراد، معدل الإلغاء، التقييم.
- Distribution bars: top خدمات إيراداً.

**Ratings:**
- KPIs: متوسط التقييم، عدد التقييمات، نسبة الإيجابية (≥4)، نسبة السلبية (≤2).
- Donut: distribution of 1-5 stars.
- Trend chart: average per day over the period.
- Table: recent negative comments (limit 10) with link to booking.

Files mirror Stage 4 layout (`pages/<name>-report.tsx`, `use-<name>-report.ts`, `<name>/page.tsx`).

### Stage 6 — i18n + Translations

- Add new keys to `apps/dashboard/lib/translations/ar.reports.ts` and `en.reports.ts`.
- Add new keys to `ar.nav.ts` / `en.nav.ts` if the top-level sidebar entry label needs adjusting (it doesn't today — keep "التقارير").
- Run `pnpm --filter=dashboard run i18n:verify` after every batch.

---

## Stage 7 — Finalization (sequential, after stages 3–6 merge into branch)

### 7.1 Delete obsolete files

```
git rm apps/dashboard/components/features/reports/executive-summary.tsx
git rm apps/dashboard/components/features/reports/top-practitioners.tsx
git rm apps/dashboard/components/features/reports/reports-tabs.tsx
git rm apps/dashboard/components/features/reports/revenue-tab.tsx
git rm apps/dashboard/components/features/reports/bookings-tab.tsx
git rm apps/dashboard/components/features/reports/employees-tab.tsx
git rm apps/dashboard/components/features/reports/employee-combobox.tsx
git rm apps/dashboard/components/features/reports/period-filter.tsx
```

(Replace `period-filter.tsx` with `reports-period-filter.tsx` to avoid an in-place rename complicating diff review.)

### 7.2 Playwright smoke

File: `apps/dashboard/e2e/smoke/reports.smoke.spec.ts`

Steps for the spec:
1. Use the test-user fixture to log in.
2. `goto('/reports')` → expect redirect to `/reports/overview`.
3. For each of the 7 routes, click the sidebar item and:
   - assert `data-testid="report-kpi-row"` has ≥1 visible KPI value
   - assert at least one chart or table is in the DOM
4. On the overview, switch period to "آخر 7 أيام" and assert the URL doesn't change but the query refetches (visible by skeleton → value).

Helper update: `apps/dashboard/e2e/utils/test-helpers.ts` — ensure `loginAsAdmin()` covers the `report:read` permission.

### 7.3 Full verification matrix

Run in order — stop if anything fails:

```bash
pnpm typecheck                                  # root turbo
pnpm lint                                       # root turbo
pnpm --filter=backend run test
pnpm --filter=backend run test:e2e
pnpm --filter=dashboard run test
pnpm --filter=dashboard run i18n:verify
pnpm --filter=dashboard run e2e:smoke
pnpm openapi:sync                              # confirm no drift
```

### 7.4 Commit strategy

Final state lands as ~6 commits on the branch:

1. `feat(backend/reports): extend ReportType enum + add OVERVIEW/CLIENTS/SERVICES/RATINGS builders`
2. `feat(backend/reports): enhance Revenue/Bookings/Practitioners + compareWithPrevious + Excel`
3. `chore(openapi): regenerate snapshot for reports rebuild`
4. `feat(dashboard/reports): shared primitives + layout shell + 7 sub-routes`
5. `feat(dashboard/reports): implement 7 report pages with charts`
6. `chore(dashboard/reports): delete obsolete tab components + e2e smoke`

### 7.5 PR

```bash
gh pr create --title "feat(reports): rebuild as 7 dedicated reports with charts and comparison" --body "$(cat <<'EOF'
## Summary
- Replaces the 3-tab Reports page with 7 dedicated reports (Overview, Financial, Bookings, Clients, Practitioners, Services, Ratings) each on its own route under `/reports/<slug>`.
- Adds backend `OVERVIEW`, `CLIENTS`, `SERVICES`, `RATINGS` report types, extracts existing inline builders, and adds `compareWithPrevious` flag.
- Adds recharts-based trend/donut/bar/heatmap primitives.
- Excel export now works for all 8 report types.

## Test plan
- [ ] `pnpm typecheck` clean
- [ ] backend unit + e2e green
- [ ] dashboard unit green
- [ ] `i18n:verify` clean
- [ ] Playwright `reports.smoke.spec.ts` green
- [ ] OpenAPI snapshot regenerated and committed
- [ ] Manual: open each of 7 reports, switch periods, export Excel

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Parallelism map

| Track | Owner | Depends on | Can start after |
|---|---|---|---|
| 1. Backend foundation | agent: backend | — | stage 0 (branch exists) |
| 2. Frontend foundation | agent: frontend | 1.2 (types known) | stage 1.2 |
| 3. Shared primitives | agent: shared-ui | 2.x | stage 2 |
| 4. Pages 1-4 | agent: pages-a | 3.x partial | stage 3 (KPI/Trend/Donut ready) |
| 5. Pages 5-7 | agent: pages-b | 3.x partial | stage 3 (Distribution/Trend ready) |
| 6. i18n | agent: i18n | parallel to 4 & 5 | stage 3 (key names finalized) |
| 7. Finalization | claude main | all | all merged into branch |

I will dispatch Stages 3, 4, 5, 6 in parallel using subagents once Stage 2 lands.

## Definition of done

- ✅ All 7 reports load and render real (or zero-state) data from real backend queries.
- ✅ Period filter persists across reloads.
- ✅ Compare-with-previous shows delta chips on Overview KPIs.
- ✅ Excel export downloads a non-empty file for each of the 8 types.
- ✅ All tests in §7.3 pass.
- ✅ PR opened, CI green, ready for review.
