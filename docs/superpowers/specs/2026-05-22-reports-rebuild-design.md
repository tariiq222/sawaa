# Reports Rebuild — Design Spec

**Date:** 2026-05-22
**Branch:** `feat/reports-rebuild`
**Author:** Sawa Team
**Status:** Approved (mockup signed off)

---

## 1. Problem

The current Reports page at [`apps/dashboard/app/(dashboard)/reports/page.tsx`](../../../apps/dashboard/app/(dashboard)/reports/page.tsx) suffers from:

1. **Weak information hierarchy.** Breadcrumbs → header → filter → 6 redundant KPI cards → "Top Practitioners" → 3 disconnected tabs. The tabs visually float because they are the fourth sibling in `ListPageShell` with no container that groups them with their content.
2. **Redundant data fetching.** `executive-summary.tsx` calls `POST /dashboard/ops/reports` twice (REVENUE + BOOKINGS) just to compute KPI cards, while `revenue-tab.tsx` and `bookings-tab.tsx` re-issue the same calls. Up to 4 calls on a single landing.
3. **Stale dead code.** `executive-summary.tsx` shows 6 cards where 3 are booking-status counts — a single concept fragmented across cards.
4. **Missing analytics.** Backend already returns `byDay` and `byMethod` time series, but the UI shows zero charts. `averageRating` in `EMPLOYEES` is a literal `0` TODO.
5. **Narrow scope.** Only Revenue, Bookings, and per-Employee views exist. No Clients, no Services, no Ratings, no Overview.
6. **Inflexible period filter.** Monthly/Yearly/Custom only. No "today", "last 7 days", "last month", "this year".
7. **No comparison.** The MD has no way to see "this month vs last month" without manually changing the date range twice.

## 2. Goals

- Replace the page with **7 dedicated reports** (Overview, Financial, Bookings, Clients, Practitioners, Services, Ratings), each on its own route.
- Land users on a comprehensive **Overview** that answers "how is the clinic doing this period?" in one screen.
- Add **trend charts**, **donuts**, **heatmaps**, and **comparison deltas** vs the previous period.
- Expand period presets to: today, last 7 days, this month, last month, this year, custom.
- Keep the existing `POST /dashboard/ops/reports` contract, extending its `type` enum and adding `compareWithPrevious`.
- Persist `Report` rows for every request (audit / async retrieval — already in DB, keep it).
- Export every report as Excel.
- Use the existing visual design system (frosted-glass + soft contemporary, the same primary/accent tokens, IBM Plex Sans Arabic).

## 3. Non-goals

- Real-time dashboards / WebSocket pushes. Reports remain on-demand with TanStack Query.
- Drill-down to individual transactions beyond the Financial report's "recent payments" table.
- Cross-organization aggregation (Sawa is single-tenant).
- Mobile app reports (this spec covers `apps/dashboard` only).
- Custom report builder. The 7 reports are fixed; users can adjust period and branch only.
- Multi-currency. Sawa is SAR-only; all amounts are integer halalas (see [LR-money](apps/backend/src/common/constants.ts)).
- Scheduled / emailed reports. Out of scope; revisit later.

## 4. Approved mockup

`/tmp/sawa-reports-mockup.html` (signed off 2026-05-22). The mockup covers 4 reports in full visual detail (Overview, Financial, Bookings, Practitioners) and a sidebar navigation listing all 7. Clients, Services, and Ratings follow the same visual grammar:

- Header + breadcrumbs at top, then a sticky toolbar with period presets + branch picker + export.
- Internal vertical sidebar (left in RTL) listing the 7 reports, grouped by:
  - **عام** — نظرة عامة
  - **العمليات** — المالي، الحجوزات، العملاء
  - **الفريق والجودة** — الممارسون، الخدمات، التقييمات
- A 4-card KPI row, then 1-2 charts, then 1-2 distribution panels, then a detail table.

## 5. Architecture

### 5.1 Backend (`apps/backend`)

**Cluster:** `modules/ops/generate-report` — keep the single slice; add new builders.

**Existing files (extended):**
- [`generate-report.dto.ts`](../../../apps/backend/src/modules/ops/generate-report/generate-report.dto.ts) — extend `ReportType` enum, add `compareWithPrevious?: boolean`.
- [`generate-report.handler.ts`](../../../apps/backend/src/modules/ops/generate-report/generate-report.handler.ts) — dispatch to new builders, compute "previous period" range when `compareWithPrevious` is true, attach `previous` field to the response.

**New builder files:**
- `overview-report.builder.ts` — KPIs (revenue, bookings, completion %, new clients) + `byDay` trend + top 4 services + top 3 practitioners. Single batched query.
- `clients-report.builder.ts` — new vs returning, retention rate, gender/age distribution, top-10 by revenue, geographic bucket if city stored.
- `services-report.builder.ts` — per-service: total bookings, revenue, cancellations %, average rating. Sorted by booking count.
- `ratings-report.builder.ts` — average score, star distribution (1-5 counts), recent negative comments (score ≤ 3), `byDay` trend of average.

**Builders to enhance:**
- `revenue-report.builder.ts` — add `byDay` total per day, and `byBranch` if `branchId` not provided.
- `activity-report.builder.ts` — keep as-is (used by Excel export, not surfaced in UI).
- `buildBookingsReport` (inline in handler) — extract to `bookings-report.builder.ts`, add `noShowRate`, `cancelRate`, `byHourDow` (heatmap data), `byCancelReason`, average duration.
- `buildEmployeesReport` (inline in handler) — extract to `employees-report.builder.ts`. Join with `Rating` table for real `averageRating`. Add `completedBookings`, `utilizationPercent` (booked minutes / available minutes from `EmployeeSchedule`).

**Excel export:**
- `excel-export.builder.ts` — extend with 5 new sheet builders: `buildOverviewExcel`, `buildBookingsExcel`, `buildClientsExcel`, `buildPractitionersExcel`, `buildServicesExcel`, `buildRatingsExcel`.

**Prisma schema migration:**
- Extend `ReportType` enum in `prisma/schema/ops.prisma`:
  ```prisma
  enum ReportType {
    REVENUE
    ACTIVITY
    BOOKINGS
    EMPLOYEES
    OVERVIEW    // new
    CLIENTS     // new
    SERVICES    // new
    RATINGS     // new
  }
  ```
- New migration: `prisma/migrations/<ts>_extend_report_type/migration.sql`.

**Compare-with-previous logic:**
- Length = `(to - from) + 1 day`.
- Previous range = `[from - length, from - 1 day]`.
- For weekly periods, snap to weekday alignment; for monthly, the previous month's same date range. Implementation detail: simple symmetric subtraction is good enough for v1 — document this and revisit if a user complains.

**Cross-cluster joins:**
- Ratings live in `org-experience` schema (`organization.prisma`), Bookings in `bookings`, Clients/Employees in `people`. Builders use `PrismaService` directly across schemas — that's allowed because Prisma generates a unified client.

**Money handling:** All revenue figures are integer halalas in DB. Builders return halalas; FE formats via `FormattedCurrency`. Do NOT divide by 100 in the backend.

### 5.2 Frontend (`apps/dashboard`)

**Route structure (new):**

```
app/(dashboard)/reports/
├── layout.tsx              ← shared shell: breadcrumbs + sidebar nav + period toolbar
├── page.tsx                ← server-side redirect to /reports/overview
├── overview/page.tsx
├── financial/page.tsx
├── bookings/page.tsx
├── clients/page.tsx
├── practitioners/page.tsx
├── services/page.tsx
└── ratings/page.tsx
```

**Component structure:**

```
components/features/reports/
├── reports-sidebar.tsx                ← internal vertical nav (3 groups, 7 items)
├── reports-toolbar.tsx                ← period presets + branch + export
├── reports-period-filter.tsx          ← (replaces existing period-filter.tsx, extended)
├── kpi-card.tsx                       ← title + big value + colored delta chip + optional sparkline
├── kpi-row.tsx                        ← 4-up grid wrapper
├── trend-chart.tsx                    ← recharts AreaChart, RTL-aware, supports compare overlay
├── donut-list.tsx                     ← donut + list-with-amounts combo
├── distribution-bars.tsx              ← horizontal bar list (used by status, cancel reasons)
├── heatmap.tsx                        ← day × hour grid
├── empty-state.tsx                    ← single shared empty illustration
├── insight-banner.tsx                 ← "💡 ..." callout
└── pages/
    ├── overview-report.tsx
    ├── financial-report.tsx
    ├── bookings-report.tsx
    ├── clients-report.tsx
    ├── practitioners-report.tsx
    ├── services-report.tsx
    └── ratings-report.tsx
```

Each page file:
- Owns its TanStack Query (`use-{report}-report.ts` hook).
- Receives `dateFrom`, `dateTo`, optional `branchId`, `compareWithPrevious` from `useReportsPeriod()` (hoisted via context in the layout).
- Renders KPI row → charts/donuts → tables in the order shown in the mockup.

**API client (`lib/api/reports.ts`):** Extend with `fetchOverviewReport`, `fetchClientsReport`, `fetchServicesReport`, `fetchRatingsReport`. Each accepts `{ dateFrom, dateTo, branchId?, compareWithPrevious? }` and returns the typed response.

**Types (`lib/types/report.ts`):** Add `OverviewReport`, `ClientsReport`, `ServicesReport`, `RatingsReport`, and `WithPrevious<T>` generic for compare-mode responses.

**Charts library:** **recharts** (v3). Reasons:
- React 19 compatible (peer-dep verified).
- Tree-shakable per chart component (only AreaChart, PieChart, BarChart needed).
- RTL works by passing `reverseStackOrder` and a custom axis order; tested in similar Stripe-like dashboards.
- Bundle impact: ~80 KB gzipped for the 3 chart types we use — acceptable for an admin page that loads on-demand.

**Period filter (extended):**
- New presets: `today`, `last7`, `thisMonth`, `lastMonth`, `thisYear`, `custom`.
- `useReportsPeriod` hook returns same shape + `period`, `presetLabel`, and a `previousRange` helper for compare deltas.

**Sidebar context:**
- `LayoutShell` reads `pathname` and highlights the active item.
- On mobile (< 768px), sidebar collapses into a horizontal scrollable tab strip at the top.

**State persistence:**
- Period preset persists in `localStorage` under `sawa.reports.period` (existing behavior in `use-reports-period.ts` — keep).
- Active branch persists similarly under `sawa.reports.branch`.

**Permission:** All 7 routes wrapped in `<PermissionGuard module="report" action="read">` (existing pattern).

### 5.3 i18n

New translation keys grouped under `reports.<area>.<key>`:
- `reports.nav.{overview,financial,bookings,clients,practitioners,services,ratings}` + section labels.
- `reports.overview.*` (e.g. `.newClients`, `.completionRate`).
- `reports.financial.{netRevenue,pendingPayments,refunds,coupons,paymentMethods.*}`.
- `reports.bookings.{noShowRate,avgDuration,heatmap.*,cancelReasons.*}`.
- `reports.clients.{new,returning,retention,topByRevenue,ageGroup,gender}`.
- `reports.practitioners.{activeCount,utilization,avgRating,completed}`.
- `reports.services.{topBooked,avgRating,cancelRate}`.
- `reports.ratings.{average,distribution,negativeComments,trend}`.

`scripts/verify-translation-parity.mjs` must pass — every new AR key has an EN twin.

## 6. Data contracts

### 6.1 Request

```ts
POST /dashboard/ops/reports
{
  type: "OVERVIEW" | "REVENUE" | "BOOKINGS" | "EMPLOYEES" | "CLIENTS" | "SERVICES" | "RATINGS" | "ACTIVITY",
  format?: "JSON" | "EXCEL",                    // default JSON
  from: string,                                  // ISO date
  to: string,                                    // ISO date
  branchId?: string,                             // optional filter
  employeeId?: string,                           // EMPLOYEES only
  compareWithPrevious?: boolean,                 // default false
}
```

### 6.2 Response shapes (JSON only — Excel returns binary)

```ts
// Common envelope when compareWithPrevious=true
type WithPrevious<T> = T & { previous?: T };

interface OverviewReport {
  totalRevenue: number;               // halalas
  totalBookings: number;
  completionRate: number;             // 0..1
  newClients: number;
  trend: { date: string; revenue: number; bookings: number }[];
  topServices: { serviceId: string; nameAr: string; nameEn: string; count: number }[];
  topPractitioners: { employeeId: string; name: string; revenue: number; bookings: number }[];
}

interface RevenueReport {            // EXTENDED
  totalRevenue: number;
  netRevenue: number;                 // total - refunds
  averagePerBooking: number;
  totalBookings: number;
  byMethod: { method: string; amount: number; count: number }[];
  byStatus: { status: "COMPLETED" | "PENDING" | "FAILED" | "REFUNDED"; amount: number; count: number }[];
  byDay: { date: string; amount: number }[];
  refundsTotal: number;
  couponsUsed: { code: string; uses: number; discountAmount: number; revenueImpact: number; isActive: boolean }[];
  recentPayments: { id: string; date: string; clientName: string; serviceName: string; method: string; amount: number; status: string }[];
}

interface BookingReport {            // EXTENDED
  total: number;
  byStatus: { status: string; count: number }[];
  byType: { type: string; count: number }[];
  byDay: { date: string; count: number }[];
  noShowRate: number;                 // 0..1
  cancelRate: number;                 // 0..1
  avgDurationMins: number;
  byHourDow: { dow: 0|1|2|3|4|5|6; hour: number; count: number }[];   // heatmap
  byCancelReason: { reason: string; count: number }[];
}

interface ClientsReport {
  total: number;
  newClients: number;
  returningClients: number;
  retentionRate: number;              // 0..1
  byGender: { gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN"; count: number }[];
  byAgeGroup: { group: "<18" | "18-29" | "30-44" | "45-59" | "60+" | "UNKNOWN"; count: number }[];
  topByRevenue: { clientId: string; name: string; bookings: number; revenue: number }[];
}

interface PractitionersReport {      // EXTENDED EmployeesReport
  totalActive: number;
  avgRevenue: number;
  avgUtilization: number;             // 0..1
  avgRating: number;                  // 0..5
  rows: {
    employeeId: string;
    name: string;
    role: string;
    bookings: number;
    completedBookings: number;
    completionRate: number;           // 0..1
    revenue: number;
    utilization: number;              // 0..1
    averageRating: number;            // 0..5
  }[];
}

interface ServicesReport {
  rows: {
    serviceId: string;
    nameAr: string;
    nameEn: string;
    bookings: number;
    revenue: number;
    cancelRate: number;               // 0..1
    averageRating: number;            // 0..5
  }[];
}

interface RatingsReport {
  averageScore: number;               // 0..5
  totalRatings: number;
  distribution: { score: 1|2|3|4|5; count: number }[];
  trend: { date: string; average: number }[];
  recentNegative: { id: string; bookingId: string; score: number; comment: string; clientName: string; employeeName: string; serviceName: string; createdAt: string }[];
}
```

### 6.3 Single-employee detail (kept for drill-down)

Existing `EmployeeReport` shape stays for the per-practitioner modal drill-down. Frontend may issue a second `EMPLOYEES` call with `employeeId` to populate the modal.

## 7. Component sizing & layer compliance

- Page files ≤ 150 lines. Each page file is orchestration only — query + props passing.
- Feature components ≤ 300 lines. The biggest one (`trend-chart.tsx`) projected ~180 lines with formatting helpers extracted.
- Hooks ≤ 200 lines.
- API functions ≤ 200 lines (current `reports.ts` is 105; will grow to ~180).
- No cross-feature imports. Shared chart components live under `components/features/reports/` only.

## 8. Testing strategy

### 8.1 Backend (Jest)

- Unit spec per builder: `*-report.builder.spec.ts` — feed it a mocked PrismaService that returns canned rows, assert the shape.
- Handler spec covers: dispatch by `type`, the `compareWithPrevious` branch, Report row lifecycle (PENDING → COMPLETED on success, FAILED on throw).
- E2E (`test/jest-e2e.json`): POST each of the 8 types and confirm 200 + JSON schema with at least one row per array field.

### 8.2 Dashboard (Vitest)

- Unit per page: render with mocked TanStack Query response, assert KPI labels + counts + chart `data-testid` present.
- Unit for each primitive: KpiCard, DonutList, Heatmap, TrendChart (snapshot the SVG path counts).
- Unit for `useReportsPeriod`: presets produce correct ranges across DST boundaries (Riyadh has no DST, but we still test).

### 8.3 Playwright (`apps/dashboard/e2e/smoke/reports.smoke.spec.ts`)

One spec that:
1. Logs in.
2. Visits each of the 7 reports.
3. Waits for `[data-testid=kpi-row]` to populate (no skeleton).
4. Asserts at least one chart canvas rendered.
5. Switches period to "آخر 7 أيام" and verifies query refetches.

### 8.4 i18n verification

`pnpm --filter=dashboard run i18n:verify` exits 0 — every new key has both AR and EN.

### 8.5 OpenAPI snapshot

`pnpm openapi:sync` regenerates `apps/backend/openapi.json`; committed in same PR.

## 9. Migration / deletion plan

**Delete after PR merges (in one cleanup commit at the end):**
- `components/features/reports/executive-summary.tsx`
- `components/features/reports/top-practitioners.tsx`
- `components/features/reports/reports-tabs.tsx`
- `components/features/reports/revenue-tab.tsx`
- `components/features/reports/bookings-tab.tsx`
- `components/features/reports/employees-tab.tsx`
- `components/features/reports/employee-combobox.tsx` (replaced by inline combobox in practitioners report modal)
- `components/features/reports/period-filter.tsx` (replaced by `reports-period-filter.tsx`)

**Keep:**
- `hooks/use-reports-period.ts` — extend; do not rewrite.
- `lib/api/reports.ts` — extend.
- `lib/types/report.ts` — extend.

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| recharts breaks under React 19 | Verify peer deps before installing; fallback plan = hand-rolled SVG (already prototyped in mockup) |
| Utilization calc requires `EmployeeSchedule` which may be sparse | Return `null` if no schedule rows; FE shows "—" |
| Compare-with-previous doubles query latency | Run both ranges in parallel inside the handler via `Promise.all` |
| Migration adds enum values; consumers might lag | Enum extensions are non-breaking in Postgres; no downtime |
| Large `Report` table rows storing full JSON results | Already happens today; not a regression. Add a future cleanup cron in a follow-up. |
| Heatmap query (bookings grouped by DOW × hour) slow on large datasets | Index already exists on `scheduledAt`; SQL is `GROUP BY EXTRACT(dow), EXTRACT(hour)` — acceptable up to ~100k bookings, then revisit. |

## 11. Open questions

None — all decisions made. Implementation plan follows.

## 12. Out of scope (deferred)

- Scheduled email/PDF reports.
- Comparing arbitrary custom ranges (only "same length immediately before" is supported).
- Real-time refresh (will rely on TanStack Query's default 30s `staleTime`).
- Mobile app reports.
- Drill-down beyond the practitioner modal.
