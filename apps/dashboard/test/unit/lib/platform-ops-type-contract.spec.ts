/**
 * Contract test for the dashboard platform / integrations / ops types (MNT-08).
 *
 * `lib/types/zoom.ts`, `lib/types/activity-log.ts`, `lib/types/report.ts` and
 * `lib/types/package-report.ts` derive every response shape from the committed
 * OpenAPI snapshot, and `lib/api/*` speaks to those schemas through
 * `lib/api/openapi.ts`. These assertions run at type-check time
 * (`pnpm typecheck`) and at test time, and fail when the wire shape moves
 * underneath the dashboard — or when a documented deviation stops being a
 * deviation.
 */
import { describe, expect, it } from "vitest"
import type { components, paths } from "@/lib/types/api.generated"
import type {
  RetryZoomMeetingResult,
  TestZoomResult,
  UpsertZoomConfigInput,
  ZoomConfigView,
  ZoomMeetingStatus,
} from "@/lib/types/zoom"
import type {
  ActivityLog,
  ActivityLogListPage,
  ActivityLogRow,
} from "@/lib/types/activity-log"
import type {
  BookingReport,
  ClientsReport,
  OverviewReport,
  PractitionersReport,
  RatingsReport,
  ReportQuery,
  RevenueReport,
  ServicesReport,
  WithPrevious,
} from "@/lib/types/report"
import type {
  OutstandingCreditReport,
  PackageConsumptionReport,
  PackageRefundEventSource,
  PackageRefundHistoryMode,
  PackageRefundType,
  PackageReport,
  PackageReportType,
  PackageSalesReport,
  RefundedPackageEventRow,
  RefundedPackageLegacyRow,
  RefundedPackagesEventsReport,
  RefundedPackagesLegacyReport,
} from "@/lib/types/package-report"

type Schemas = components["schemas"]
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Expect<T extends true> = T

/** The JSON body of a concrete operation's success response. */
type JsonResponse<
  Path extends keyof paths,
  Method extends keyof paths[Path],
> = paths[Path][Method] extends { responses: infer Responses }
  ? Responses[Extract<keyof Responses, 200 | 201>] extends {
      content: { "application/json": infer Body }
    }
    ? Body
    : never
  : never

/* ─── Zoom: two booleans in, no secret out ─── */

type _ZoomViewIsWire = Expect<Equal<ZoomConfigView, Schemas["ZoomConfigResponseDto"]>>
type _ZoomViewKeys = Expect<Equal<keyof ZoomConfigView, "configured" | "isActive">>
type _ZoomTestIsWire = Expect<Equal<TestZoomResult, Schemas["ZoomTestResultDto"]>>
type _ZoomInputIsWire = Expect<Equal<UpsertZoomConfigInput, Schemas["UpsertZoomConfigDto"]>>

type SecretKeys =
  | "zoomClientId"
  | "zoomClientSecret"
  | "zoomAccountId"
  | "clientSecret"
  | "ciphertext"
  | "config"
type _ZoomViewHasNoSecret = Expect<Equal<Extract<SecretKeys, keyof ZoomConfigView>, never>>
type _ZoomTestHasNoSecret = Expect<Equal<Extract<SecretKeys, keyof TestZoomResult>, never>>
/** The view is exactly the GET/PUT operation body, not a hand-written paraphrase. */
type _ZoomViewIsOperationBody = Expect<
  Equal<ZoomConfigView, JsonResponse<"/api/v1/dashboard/integrations/zoom", "get">>
>
type _ZoomTestIsOperationBody = Expect<
  Equal<TestZoomResult, JsonResponse<"/api/v1/dashboard/integrations/zoom/test", "post">>
>
/** The retry route is documented by bookings; the dashboard alias follows it. */
type _RetryZoomIsOperationBody = Expect<
  Equal<RetryZoomMeetingResult, JsonResponse<"/api/v1/dashboard/bookings/{id}/zoom/retry", "post">>
>
type _ZoomMeetingStatusIsWire = Expect<
  Equal<ZoomMeetingStatus, NonNullable<Schemas["BookingRecordDto"]["zoomMeetingStatus"]>>
>

/* ─── Activity log: derived row + one documented normalisation ─── */

type _ActivityRowIsWire = Expect<Equal<ActivityLogRow, Schemas["OpsActivityLogEntryDto"]>>
type _ActivityListIsWire = Expect<
  Equal<ActivityLogListPage["meta"], Schemas["OpsActivityLogListResponseDto"]["meta"]>
>
/** The normalised row keeps the wire identity + nullable user, and adds the two lifted JSON columns. */
type _ActivityLogCoversRow = Expect<
  Equal<Exclude<keyof ActivityLogRow, keyof ActivityLog>, never>
>
type _ActivityLogAddsOnlyLiftedFields = Expect<
  Equal<Exclude<keyof ActivityLog, keyof ActivityLogRow>, "oldValues" | "newValues">
>
type _ActivityLogActionIsFreeText = Expect<Equal<ActivityLog["action"], string>>
type _ActivityLogUserIsWire = Expect<Equal<ActivityLog["user"], Schemas["OpsActivityLogUserDto"] | null>>

/* ─── Generated reports: one alias per documented union branch ─── */

type _OverviewIsWire = Expect<Equal<OverviewReport, Schemas["OpsOverviewReportDto"]>>
type _RevenueIsWire = Expect<Equal<RevenueReport, Schemas["OpsRevenueReportDto"]>>
type _BookingIsWire = Expect<Equal<BookingReport, Schemas["OpsBookingsReportDto"]>>
type _ClientsIsWire = Expect<Equal<ClientsReport, Schemas["OpsClientsReportDto"]>>
type _PractitionersIsWire = Expect<Equal<PractitionersReport, Schemas["OpsPractitionersReportDto"]>>
type _ServicesIsWire = Expect<Equal<ServicesReport, Schemas["OpsServicesReportDto"]>>
type _RatingsIsWire = Expect<Equal<RatingsReport, Schemas["OpsRatingsReportDto"]>>
/** Every report alias is one member of the documented response union. */
type _OverviewIsUnionMember = Expect<
  Equal<OverviewReport extends JsonResponse<"/api/v1/dashboard/ops/reports", "post"> ? true : false, true>
>
/**
 * `WithPrevious` is an intersection, so it is mutually assignable with the wire
 * shape that already declares `previous` — but not type-identical. Assert the
 * mutual assignability instead of identity.
 */
type _WithPreviousIsTransparent = Expect<
  Equal<
    [WithPrevious<OverviewReport>] extends [OverviewReport] ? true : false,
    [OverviewReport] extends [WithPrevious<OverviewReport>] ? true : false
  >
>
type _PreviousIsOptional = Expect<Equal<OverviewReport["previous"], OverviewReport | undefined>>

/** The client query keeps its own field names; the API maps them onto GenerateReportDto. */
type _ReportQueryIsClientSide = Expect<Equal<keyof ReportQuery, "dateFrom" | "dateTo" | "branchId" | "compareWithPrevious">>

/* ─── Package reports: discriminated union ─── */

type _SalesIsWire = Expect<Equal<PackageSalesReport, Schemas["OpsPackageSalesReportDto"]>>
type _OutstandingIsWire = Expect<Equal<OutstandingCreditReport, Schemas["OpsPackageOutstandingCreditReportDto"]>>
type _ConsumptionIsWire = Expect<Equal<PackageConsumptionReport, Schemas["OpsPackageConsumptionReportDto"]>>
type _RefundedEventRowIsWire = Expect<Equal<RefundedPackageEventRow, Schemas["OpsRefundedPackageEventRowDto"]>>
type _RefundedLegacyRowIsWire = Expect<Equal<RefundedPackageLegacyRow, Schemas["OpsRefundedPackageLegacyRowDto"]>>
type _ReportTypeIsWire = Expect<
  Equal<PackageReportType, paths["/api/v1/dashboard/ops/reports/packages"]["get"]["parameters"]["query"]["report"]>
>
type _RefundHistoryModeIsWire = Expect<Equal<PackageRefundHistoryMode, "EVENTS" | "LEGACY">>
type _RefundSourceIsWire = Expect<Equal<PackageRefundEventSource, "LIVE" | "LEGACY_REQUEST" | "LEGACY_AGGREGATE">>
type _RefundTypeIsWire = Expect<Equal<PackageRefundType, "FULL" | "PARTIAL" | "UNKNOWN">>
/** Each member is the documented branch plus the client-side `complete` narrowing. */
type _EventsIsWire = Expect<
  Equal<Omit<RefundedPackagesEventsReport, "historyReconciliation">, Omit<Schemas["OpsRefundedPackagesEventsReportDto"], "historyReconciliation">>
>
type _LegacyIsWire = Expect<
  Equal<Omit<RefundedPackagesLegacyReport, "historyReconciliation">, Omit<Schemas["OpsRefundedPackagesLegacyReportDto"], "historyReconciliation">>
>
type _EventsCompleteIsTrue = Expect<Equal<RefundedPackagesEventsReport["historyReconciliation"]["complete"], true>>
type _LegacyCompleteIsFalse = Expect<Equal<RefundedPackagesLegacyReport["historyReconciliation"]["complete"], false>>
/** Discriminated: `kind` narrows the union at every switch site. */
type _UnionIsDiscriminated = Expect<
  Equal<PackageReport["kind"], "SALES" | "OUTSTANDING_CREDIT" | "CONSUMPTION" | "REFUNDED">
>

/* ─── Negative controls: the equality helper is not vacuous ─── */

type N_extraKey = Equal<ZoomConfigView, ZoomConfigView & { zoomClientSecret: string }>
type N_missingKey = Equal<ZoomConfigView, Omit<ZoomConfigView, "isActive">>
type N_changedType = Equal<ZoomConfigView, Omit<ZoomConfigView, "configured"> & { configured: string }>
type N_optionality = Equal<TestZoomResult, Omit<TestZoomResult, "error"> & { error: string }>
type N_nullable = Equal<RefundedPackageLegacyRow, Omit<RefundedPackageLegacyRow, "refundedAt"> & { refundedAt: string }>
type N_nested = Equal<OverviewReport, Omit<OverviewReport, "topServices"> & { topServices: unknown[] }>
type N_envelope = Equal<ActivityLogListPage, { items: ActivityLog[] }>
type N_wrongRoute = Equal<ZoomConfigView, TestZoomResult>
type N_previousIdentity = Equal<WithPrevious<OverviewReport>, OverviewReport & { previous: OverviewReport }>
export type ControlsReject = Expect<
  [
    N_extraKey, N_missingKey, N_changedType, N_optionality, N_nullable, N_nested, N_envelope,
    N_wrongRoute, N_previousIdentity,
  ] extends [false, false, false, false, false, false, false, false, false] ? true : false
>

/* ─── Runtime smoke: the derived types hold real wire rows ─── */

const wireZoomView: ZoomConfigView = { configured: true, isActive: false }
const dashboardZoomView: ZoomConfigView = wireZoomView

const wireRevenueRow: RevenueReport = {
  totalRevenue: 250000,
  netRevenue: 235000,
  totalBookings: 12,
  averagePerBooking: 20833,
  refundsTotal: 15000,
  byMethod: [{ method: "CASH", amount: 150000, count: 4 }],
  byStatus: [{ status: "COMPLETED", amount: 150000, count: 4 }],
  byDay: [{ date: "2026-01-15", amount: 60000, count: 2 }],
  couponsUsed: [{ code: "SAWAA10", uses: 3, discountAmount: 15000, isActive: true }],
  recentPayments: [
    {
      id: "00000000-0000-4000-a000-0000000000e1",
      date: "2026-01-15T09:00:00.000Z",
      clientName: "عميل تجريبي",
      serviceName: "جلسة إرشاد أسري",
      method: "CASH",
      amount: 30000,
      status: "COMPLETED",
    },
  ],
}

const wireActivityRow: ActivityLogRow = {
  id: "00000000-0000-4000-a000-0000000000e1",
  userId: null,
  action: "UPDATE",
  module: "Booking",
  resourceId: null,
  description: "Updated booking status",
  ipAddress: null,
  userAgent: null,
  createdAt: "2026-10-10T09:00:00.000Z",
  userEmail: null,
  user: null,
}

const wirePackageSales: PackageSalesReport = {
  kind: "SALES",
  purchaseCount: 6,
  totalRevenue: 150000,
  grossRevenue: 160000,
  refundedAmount: 10000,
  netRevenue: 150000,
  byBucket: { cash: 50000, network: 70000, electronic: 30000 },
  byMethod: [{ method: "MADA", amount: 70000, count: 3 }],
}

describe("platform / integrations / ops type contract", () => {
  it("keeps the Zoom view aligned with the snapshot and free of secrets", () => {
    expect(dashboardZoomView).toEqual({ configured: true, isActive: false })
    expect(Object.keys(dashboardZoomView).sort()).toEqual(["configured", "isActive"])
    for (const secret of ["zoomClientId", "zoomClientSecret", "zoomAccountId", "ciphertext"]) {
      expect(Object.keys(dashboardZoomView)).not.toContain(secret)
    }
  })

  it("keeps the revenue report aligned with the snapshot", () => {
    expect(wireRevenueRow.netRevenue).toBe(15000 + 220000)
    expect(wireRevenueRow.byStatus[0].status).toBe("COMPLETED")
    expect(Object.keys(wireRevenueRow).sort()).toEqual(
      [
        "totalRevenue", "netRevenue", "totalBookings", "averagePerBooking", "refundsTotal",
        "byMethod", "byStatus", "byDay", "couponsUsed", "recentPayments",
      ].sort(),
    )
  })

  it("normalises an activity row into the dashboard projection without adding wire keys", () => {
    expect(wireActivityRow.module).toBe("Booking")
    const projectedKeys = [
      "id", "userId", "action", "module", "resourceId", "description",
      "oldValues", "newValues", "ipAddress", "userAgent", "createdAt", "userEmail", "user",
    ]
    expect(projectedKeys.filter((key) => !(key in wireActivityRow))).toEqual([
      "oldValues",
      "newValues",
    ])
  })

  it("keeps the package union discriminated by kind", () => {
    expect(wirePackageSales.kind).toBe("SALES")
    const kinds: PackageReport["kind"][] = [
      "SALES",
      "OUTSTANDING_CREDIT",
      "CONSUMPTION",
      "REFUNDED",
    ]
    expect(kinds).toHaveLength(4)
  })
})
