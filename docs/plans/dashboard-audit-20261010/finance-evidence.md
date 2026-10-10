# Finance/home/reporting audit evidence — 2026-10-10

Lane: `codex/dashboard-audit-finance-20261010`; actual starting HEAD `5f6b9ad0b` (PR191), not `cfec262` from the dispatch brief. Isolated worktree `/Users/tariq/.codex/worktrees/dashboard-audit-finance/sawaa`. No push, merge, deployment, shared database, credential change, real gateway call, migration, AAD change, or VAT change. Parent coordinates integrated OpenAPI, translations, smoke, real Moyasar Sandbox and acceptance.

## Resolution of all 37 assigned checklist IDs

Paths below are relative to `apps/dashboard`, unless prefixed `backend:` (`apps/backend/src`). “Local” means source and focused unit verification; live acceptance is still required.

| ID | Resolution and owning source/evidence |
|---|---|
| A001 | Local: `lib/dashboard-widgets.ts` gates monthly overview on report read; `lib/api/reports.ts` sends the current Riyadh day end. `hooks/use-dashboard-home.ts` returns errors; `app/(dashboard)/page.tsx` renders an error banner and suppresses failed KPI values. Widget and period/API regressions. |
| A002 | Local: pending-payment indicators appear only for the existing backend roles OWNER/ADMIN/ACCOUNTANT with payment read. No backend role-policy change. Widget regression preserves reception daily bookings. |
| A003 | Local: `components/features/dashboard/attention-alerts.tsx` links to `/bookings?tab=all&status=cancel_requested`. Parent owns consumption of this agreed URL filter. |
| A004 | Local: `components/features/dashboard/greeting-header.tsx` search button dispatches the existing CommandPalette keyboard shortcut. Existing `command-palette.tsx` document handler accepts Meta/Ctrl+K. |
| A005 | Local: greeting new-appointment action checks `canDo("booking","create")`. Backend guard unchanged. |
| A006 | Local: home date and greeting hour explicitly use `Asia/Riyadh`, with Gregorian Arabic date. |
| A084 | Local: coupon value Input has `step=.01`, `min=.01`; existing SAR↔halala conversion retained. Coupon schema accepts 49.50 and form-helper tests preserve 4950 halalas. |
| A085 | Local: `lib/audit-date.ts` provides deterministic Riyadh datetime input/display roundtrip; coupon form no longer takes a UTC slice or parses browser-local datetime. Column dates use existing `lib/date.ts`, whose shared Riyadh display fix is parent-owned. |
| A086 | Local: edit form sends null for cleared minOrderAmt/maxUses/maxUsesPerUser/expiresAt. `backend:modules/finance/coupons/update-coupon.dto.ts` declares nullable fields and handler explicitly clears expiry. Coupon audit regression observes persisted nulls. |
| A087 | Local: percentage max100 validated in dashboard schema and create/update backend handlers, including updates omitting discountType. Localized validation message. RED 101 accepted; GREEN rejected before persistence. |
| A088 | Local: `components/features/coupons/coupon-columns.tsx` uses `FormattedCurrency` with locale instead of literal SAR. |
| A089 | Local: discount type selector disabled on edit; backend rejects actual type change while accepting the current immutable value. Coupon audit regression. |
| A090 | Local: active filter requires active plus null expiry or expiry later than now. Coupon audit regression excludes expired active row. |
| A091 | Local: coupon active mutation supplies success toast and API error toast. New finance translations supplied to parent registry. |
| A092 | Local: existing PDF uses GET fetchInvoicePdf; only missing PDFs use generation POST and only for invoice manage. Regression simulates read-only access to existing PDF. |
| A093 | Local: `hooks/use-invoices.ts`/invoice list pass and cache all seven supported status filters, resetting pagination. |
| A094 | Local: `backend:modules/finance/list-invoices/list-invoices.handler.ts` parses INV-0012 into invoice number12; regression. `useInvoices` consumes Next URL search for parent client invoice links; route supplies Suspense. |
| A095 | Local: PDF opens a blank window synchronously on click, nulls opener, resolves its URL after await and closes on failure. Regression asserts open occurred before deferred request resolved. |
| A096 | Integration dependency: invoice column already uses `formatClinicDate` (lib/utils → shared lib/date.ts); parent owns Riyadh display change and its timezone regression. No duplicate helper introduced. |
| A097 | Local: verify uses actual singular receiptUrl (legacy receipts still supported); detail GET signs private finance-receipts link; partial off-gateway refund button and partial status translation fixed. Gateway rows with a positive refunded counter remain blocked even if their status is stale COMPLETED, with the same explanation. Tests cover singular receipt and remaining manual refund. **Audit overgeneralization corrected:** existing backend rejects a second ONLINE_CARD Moyasar refund; that protection remains, with an explicit accounting explanation in the UI. |
| A098 | Local: UI, manual handler, cancellation refund creation, direct gateway execute and recovered provider finalizer select gateway path only for ONLINE_CARD. Administrative bank gatewayRef is never a provider ID. Bank reference/manual partial tests and recovery no-provider-call regression. Default cancellation refund is remaining balance, not original amount. |
| A099 | Local: MADA/TABBY/COUPON translated in detail/list and all supported methods filterable. COUPON list label was already present at baseline; detail and filters needed completion. |
| A100 | Local: list status filter includes PENDING_VERIFICATION and PARTIALLY_REFUNDED. |
| A101 | Local: payment detail shows joined client name and INV-formatted invoice.number. Backend selects number, no client sensitive fields added. Get-payment regression. |
| A102 | Local: reference search applies gatewayRef alongside invoice/client matching. SQL page and Prisma count retain identical search/date conditions; parameterized wildcard escaping verified. |
| A117 | Local: toolbar passes actual API day-end for Excel; report API normalizes both bounds to Riyadh. Revenue Excel converts summary, method/day/recent amounts /100 into numeric SAR cells. RED 4950 produced "4950.00"; GREEN numeric49.5. |
| A118 | Local: all dashboard report/package queries normalize date-only bounds; backend normalizes non-revenue date-only ranges, and revenue handles inclusive Riyadh day-end by advancing to the exclusive next instant. Arbitrary explicit revenue instants retain historical half-open semantics. Common backend today/month/date helpers no longer depend on server timezone; tested UTC and America/Los_Angeles plus NY DST. Day grouping is Riyadh in overview/ratings/activity/practitioner detail. |
| A119 | Local: booking daily/hour/DOW SQL extracts Asia/Riyadh instead of UTC. Query regression pins timezone; 13:00Z maps to16:00 Riyadh. |
| A120 | Local: revenue chart values /100, localized SAR tooltip, separate bookings right axis; previous period aligned by calendar offset and missing days represented null. Sparse and empty previous-data regressions. |
| A121 | Local: new finance translation modules add DEPOSIT_PAID/PARTIALLY_REFUNDED/MADA/TABBY report keys; parent registers both exports. |
| A122 | Local: report copy explicitly separates collection date from appointment date and completed-session price from actual collection. Existing monetary recognition bases and payment statuses preserved. |
| A123 | Local: financial average excludes actual CANCELLED appointments. CANCEL_REQUESTED remains included until cancellation, preserving lifecycle semantics. Average label explicitly says collection per non-cancelled appointment; SQL regression. |
| A124 | Local: recent negative ratings use ≤2 consistently with count, matching existing negative definition. Score3 regression remains neutral. |
| A125 | Local: report period hook no longer reads/writes hidden stored branch; new session starts unfiltered. Period regression seeds old storage and observes undefined branch. |
| A126 | Local: package sales KPI layout separates four totals and three channel cards into two rows. |
| A127 | Local: ratings distribution copies before sorting. Historical services claim invalid: baseline/current `services-report-page.tsx:88` already uses `[...data.rows].sort(...)`; it never mutates query cache. |
| A128 | Local: package page exports loaded selected report as CSV, covering SALES/OUTSTANDING_CREDIT/CONSUMPTION/REFUNDED, numeric SAR conversion, UTF8 BOM and spreadsheet-formula escaping. Rendered regression clicks export and observes49.50. |

## Contracts handed to integration

- `lib/audit-date.ts`: `riyadhDate(Date|string):string`, `riyadhDayStart(string):string`, `riyadhDayEnd(string):string`, `riyadhDateRange(string,string):{dateFrom:string;dateTo:string}`. Outputs are YYYY-MM-DD or ISO UTC instants; day end is inclusive .999. Extra coupon helpers: riyadhDateTimeValue and riyadhDateTimeInstant.
- Translation exports: `arAuditFinance` / `enAuditFinance` from the two new `lib/translations/*.audit-finance.ts` files. Includes average-label override; parent registers these after base translations.
- Existing UpdateCouponDto optional numeric limits and expiry now accept explicit null (Swagger nullable). Type changes rejected, same type accepted. Existing create/update endpoint paths unchanged.
- GetPayment invoice.number added; receiptUrl transformed to signed URL from fixed private bucket. FinanceModule already imports StorageModule.
- Legacy exported `packages/api-client/src/types/coupon.ts` UpdateCouponPayload gains nullable minAmount/maxUses/maxUsesPerUser/expiresAt, preserving its existing field names. `rg` found no current coupon endpoint module consuming this legacy shape; lower-case types/minAmount were not redesigned.
- Parent generates OpenAPI snapshot/dashboard generated types after integrating endpoint source. Lane does not write those shared generated artifacts.

## RED evidence and GREEN commands

All commands use `node /Users/tariq/.codex/release-evidence/2026-10-10-four-groups-integration/run-safe.mjs` (synthetic test environment, no live .env). Dashboard tests are selected with `exec vitest run`, since `test -- path` hides selection and can run the full suite.

Observed RED failures before fixes:

- Dashboard initial three-file regressions: 4 failures (percentage101, UTC period end, no bank verify with receiptUrl, no manual partial remaining action).
- Backend initial five-file regressions: 5 failures (Excel halala value under SAR, INV-0012 match, bank administrative reference rejected manually, neutral score3 included in negative list, percentage101 accepted).
- Coupon audit: 3 failures (cleared expiry persisted, type change/101 accepted, expired active row included).
- Invoice PDF: popup opened zero times before deferred API resolved. After dependency dist preparation this was an observed behavioral failure, not a module-resolution failure.
- Sparse chart: previous day's70 aligned to missing current day by index; empty previous data additionally threw Invalid time value.
- Widget permissions: reception stats enabled although report-read unavailable.
- Package CSV: no export button.
- Get-payment: raw private receipt URL returned instead of signed URL.
- Card action with stale COMPLETED/positive refundedAmount still exposed the unsupported refund button; final focused action recheck passes all9 cases.
- Backend range tests: non-revenue same-day range midnight/midnight; final revenue millisecond excluded; optional timezone/DST ignored.
- Provider recovery: Moyasar GET called with BANK-ADMIN-REF for a bank payment. GREEN no provider GET/POST.
- Reference/date search: top-level Prisma OR overwrote collection-date OR. GREEN independent AND search plus retained date OR and escaped SQL parameter.
- Invoice URL: /invoices?search=INV-0012 left search blank. GREEN Next URL-derived state (mount-effect draft failed scoped lint and was replaced).

Focused final dashboard command (15 files, **82 tests passed**, 20:07 Riyadh; URL refactor subsequently rechecked its two files, **8 tests passed**, 20:09):

```sh
SAFE=/Users/tariq/.codex/release-evidence/2026-10-10-four-groups-integration/run-safe.mjs
node "$SAFE" pnpm --filter=dashboard exec vitest run \
 test/unit/lib/coupon-schemas.spec.ts \
 test/unit/features/payments/payment-actions.spec.tsx \
 test/unit/hooks/audit-report-period.spec.tsx \
 test/unit/features/invoices/invoice-pdf-audit.spec.tsx \
 test/unit/components/reports/trend-chart-audit.spec.tsx \
 test/unit/components/reports/package-export-audit.spec.tsx \
 test/unit/lib/reports-api.spec.ts test/unit/lib/package-reports-api.spec.ts \
 test/unit/lib/dashboard-widgets.spec.ts \
 test/unit/features/invoices/invoice-columns.spec.tsx \
 test/unit/features/invoices/invoice-list-page.spec.tsx \
 test/unit/hooks/use-invoices.spec.ts \
 test/unit/features/payments/payment-detail-dialog.spec.tsx \
 test/unit/features/payments/payment-columns.spec.tsx \
 test/unit/components/coupon-form-page.spec.ts
```

Focused final backend command (**18 files, 183 tests passed**). The helper also passed separately under UTC and America/Los_Angeles (**8 tests each**):

```sh
node "$SAFE" pnpm --filter=backend exec jest --runInBand \
 src/common/helpers/date-tz.helper.spec.ts \
 src/modules/finance/coupons/coupon-audit.spec.ts \
 src/modules/finance/coupons/create-coupon.handler.spec.ts \
 src/modules/finance/coupons/list-coupons.handler.spec.ts \
 src/modules/finance/coupons/update-coupon.handler.spec.ts \
 src/modules/finance/list-invoices/list-invoices.handler.spec.ts \
 src/modules/finance/list-payments/list-payments.handler.spec.ts \
 src/modules/finance/get-payment/get-payment.handler.spec.ts \
 src/modules/finance/refund-payment/manual-refund-payment.handler.spec.ts \
 src/modules/finance/refund-payment/refund-payment.handler.spec.ts \
 src/modules/ops/generate-report/excel-export.builder.spec.ts \
 src/modules/ops/generate-report/overview-report.builder.spec.ts \
 src/modules/ops/generate-report/revenue-report-query.helper.spec.ts \
 src/modules/ops/generate-report/revenue-report.builder.spec.ts \
 src/modules/ops/generate-report/ratings-report.builder.spec.ts \
 src/modules/ops/generate-report/generate-report.handler.spec.ts \
 src/modules/ops/generate-report/activity-report.builder.spec.ts \
 src/modules/ops/generate-report/practitioners-report.builder.spec.ts
node "$SAFE" env TZ=UTC pnpm --filter=backend exec jest --runInBand src/common/helpers/date-tz.helper.spec.ts
node "$SAFE" env TZ=America/Los_Angeles pnpm --filter=backend exec jest --runInBand src/common/helpers/date-tz.helper.spec.ts
```

After explicit test-mock typing, four new-spec files passed5 tests; package CSV label fix was rechecked with1 passing test. Final refund consistency regression was rechecked with9 passing action tests.

Other verification: backend typecheck, dashboard typecheck, api-client typecheck pass; scoped ESLint over changed dashboard production TS/TSX files passes; git diff --check passes. Dependencies installed offline/frozen, shared dist prepared only for required test imports. No full build/lint/test suite run in this lane. Normal pre-commit hooks ran the legacy guard and staged ESLint; new test mocks were given explicit types after the first dashboard hook rejected any annotations. Exact token attribution is unavailable; coordinator owns routing receipt.

## Remaining integrated acceptance

No unresolved local implementation blocker. Parent must register translations, include shared lib/date.ts display fix, consume cancel-request URL filter, regenerate OpenAPI/generated dashboard client, and verify the integrated revision. Browser smoke and real Moyasar Sandbox remain **unperformed by this lane** and required before merge acceptance. Specifically exercise bank receipt approval/rejection + signed private receipt view, manual remaining refund with bank reference, first ONLINE_CARD full/partial refund and explained second-refund restriction, invoice read-only PDF in Safari, report day-end/Excel49.50, coupon edit clear/null/Riyadh expiry and all CSV variants. Tests do not establish provider or live browser acceptance.

## Changed paths

```text
docs/plans/dashboard-audit-20261010/finance-evidence.md
apps/backend/src/modules/finance/coupons/coupon-audit.spec.ts
apps/dashboard/lib/audit-date.ts
apps/dashboard/lib/package-report-export.ts
apps/dashboard/lib/translations/ar.audit-finance.ts
apps/dashboard/lib/translations/en.audit-finance.ts
apps/dashboard/test/unit/components/reports/package-export-audit.spec.tsx
apps/dashboard/test/unit/components/reports/trend-chart-audit.spec.tsx
apps/dashboard/test/unit/features/invoices/invoice-pdf-audit.spec.tsx
apps/dashboard/test/unit/hooks/audit-report-period.spec.tsx
apps/backend/src/common/helpers/date-tz.helper.spec.ts
apps/backend/src/common/helpers/date-tz.helper.ts
apps/backend/src/modules/finance/coupons/create-coupon.handler.spec.ts
apps/backend/src/modules/finance/coupons/create-coupon.handler.ts
apps/backend/src/modules/finance/coupons/list-coupons.handler.ts
apps/backend/src/modules/finance/coupons/update-coupon.dto.ts
apps/backend/src/modules/finance/coupons/update-coupon.handler.ts
apps/backend/src/modules/finance/get-payment/get-payment.handler.spec.ts
apps/backend/src/modules/finance/get-payment/get-payment.handler.ts
apps/backend/src/modules/finance/list-invoices/list-invoices.handler.spec.ts
apps/backend/src/modules/finance/list-invoices/list-invoices.handler.ts
apps/backend/src/modules/finance/list-payments/list-payments.handler.spec.ts
apps/backend/src/modules/finance/list-payments/list-payments.handler.ts
apps/backend/src/modules/finance/refund-payment/manual-refund-payment.handler.spec.ts
apps/backend/src/modules/finance/refund-payment/manual-refund-payment.handler.ts
apps/backend/src/modules/finance/refund-payment/refund-payment.handler.spec.ts
apps/backend/src/modules/finance/refund-payment/refund-payment.handler.ts
apps/backend/src/modules/ops/generate-report/activity-report.builder.ts
apps/backend/src/modules/ops/generate-report/excel-export.builder.spec.ts
apps/backend/src/modules/ops/generate-report/excel-export.builder.ts
apps/backend/src/modules/ops/generate-report/generate-report.handler.spec.ts
apps/backend/src/modules/ops/generate-report/generate-report.handler.ts
apps/backend/src/modules/ops/generate-report/overview-report.builder.ts
apps/backend/src/modules/ops/generate-report/practitioners-report.builder.ts
apps/backend/src/modules/ops/generate-report/ratings-report.builder.spec.ts
apps/backend/src/modules/ops/generate-report/ratings-report.builder.ts
apps/backend/src/modules/ops/generate-report/revenue-report-query.helper.spec.ts
apps/backend/src/modules/ops/generate-report/revenue-report-query.helper.ts
apps/dashboard/app/(dashboard)/invoices/page.tsx
apps/dashboard/app/(dashboard)/page.tsx
apps/dashboard/components/features/coupons/coupon-columns.tsx
apps/dashboard/components/features/coupons/coupon-form-fields.tsx
apps/dashboard/components/features/coupons/coupon-form-page.tsx
apps/dashboard/components/features/coupons/coupon-list-page.tsx
apps/dashboard/components/features/dashboard/attention-alerts.tsx
apps/dashboard/components/features/dashboard/greeting-header.tsx
apps/dashboard/components/features/invoices/invoice-columns.tsx
apps/dashboard/components/features/invoices/invoice-list-page.tsx
apps/dashboard/components/features/payments/payment-actions.tsx
apps/dashboard/components/features/payments/payment-columns.tsx
apps/dashboard/components/features/payments/payment-detail-dialog.tsx
apps/dashboard/components/features/payments/payment-list-page.tsx
apps/dashboard/components/features/payments/payment-refund-step.tsx
apps/dashboard/components/features/reports/pages/financial-report-page.tsx
apps/dashboard/components/features/reports/pages/overview-report-page.tsx
apps/dashboard/components/features/reports/pages/packages-report-bodies.tsx
apps/dashboard/components/features/reports/pages/packages-report-page.tsx
apps/dashboard/components/features/reports/pages/ratings-report-page.tsx
apps/dashboard/components/features/reports/reports-toolbar.tsx
apps/dashboard/components/features/reports/trend-chart.tsx
apps/dashboard/hooks/use-dashboard-home.ts
apps/dashboard/hooks/use-invoices.ts
apps/dashboard/hooks/use-reports-period.ts
apps/dashboard/lib/api/package-reports.ts
apps/dashboard/lib/api/reports.ts
apps/dashboard/lib/dashboard-widgets.ts
apps/dashboard/lib/schemas/coupon.schema.ts
apps/dashboard/lib/types/coupon.ts
apps/dashboard/lib/types/payment.ts
apps/dashboard/test/unit/features/invoices/invoice-list-page.spec.tsx
apps/dashboard/test/unit/features/payments/payment-actions.spec.tsx
apps/dashboard/test/unit/hooks/use-invoices.spec.ts
apps/dashboard/test/unit/lib/coupon-schemas.spec.ts
apps/dashboard/test/unit/lib/dashboard-widgets.spec.ts
apps/dashboard/test/unit/lib/package-reports-api.spec.ts
apps/dashboard/test/unit/lib/reports-api.spec.ts
packages/api-client/src/types/coupon.ts
```
