/**
 * Reports API — Sawaa Dashboard
 *
 * Backend: `POST /dashboard/ops/reports` — a single polymorphic endpoint with
 * a `type` discriminator. Every call goes through the typed helper in
 * `lib/api/openapi.ts`, so a renamed route or a changed body is a type error
 * here. Response types come from the committed OpenAPI snapshot through
 * `lib/types/report.ts`.
 *
 * Request bodies are byte-identical to before: the same `buildBody` object,
 * the same Riyadh-day start/end conversion and the same field order.
 */

import { api } from "@/lib/api"
import { openApi, type OpenApiRequestBody } from "@/lib/api/openapi"
import { riyadhDayStart, riyadhDayEnd } from "@/lib/audit-date"
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

const REPORTS_PATH = "/api/v1/dashboard/ops/reports"
type ReportsPath = typeof REPORTS_PATH
type ReportsBody = OpenApiRequestBody<ReportsPath, "post">

const startInstant = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? riyadhDayStart(value) : value
const endInstant = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? riyadhDayEnd(value) : value

type ReportType =
  | "OVERVIEW"
  | "REVENUE"
  | "BOOKINGS"
  | "EMPLOYEES"
  | "CLIENTS"
  | "SERVICES"
  | "RATINGS"
  | "ACTIVITY"

function buildBody(
  type: ReportType,
  q: ReportQuery & { employeeId?: string }
): ReportsBody {
  return {
    type,
    from: startInstant(q.dateFrom),
    to: endInstant(q.dateTo),
    branchId: q.branchId,
    employeeId: q.employeeId,
    compareWithPrevious: q.compareWithPrevious,
  }
}

export async function fetchOverviewReport(
  q: ReportQuery
): Promise<WithPrevious<OverviewReport>> {
  const body = buildBody("OVERVIEW", q)
  return openApi.post(REPORTS_PATH, { body }) as Promise<WithPrevious<OverviewReport>>
}

export async function fetchRevenueReport(
  q: ReportQuery
): Promise<WithPrevious<RevenueReport>> {
  const body = buildBody("REVENUE", q)
  return openApi.post(REPORTS_PATH, { body }) as Promise<WithPrevious<RevenueReport>>
}

export async function fetchBookingReport(
  q: ReportQuery
): Promise<WithPrevious<BookingReport>> {
  const body = buildBody("BOOKINGS", q)
  return openApi.post(REPORTS_PATH, { body }) as Promise<WithPrevious<BookingReport>>
}

export async function fetchClientsReport(
  q: ReportQuery
): Promise<WithPrevious<ClientsReport>> {
  const body = buildBody("CLIENTS", q)
  return openApi.post(REPORTS_PATH, { body }) as Promise<WithPrevious<ClientsReport>>
}

export async function fetchPractitionersReport(
  q: ReportQuery
): Promise<WithPrevious<PractitionersReport>> {
  const body = buildBody("EMPLOYEES", q)
  return openApi.post(REPORTS_PATH, { body }) as Promise<WithPrevious<PractitionersReport>>
}

export async function fetchServicesReport(
  q: ReportQuery
): Promise<WithPrevious<ServicesReport>> {
  const body = buildBody("SERVICES", q)
  return openApi.post(REPORTS_PATH, { body }) as Promise<WithPrevious<ServicesReport>>
}

export async function fetchRatingsReport(
  q: ReportQuery
): Promise<WithPrevious<RatingsReport>> {
  const body = buildBody("RATINGS", q)
  return openApi.post(REPORTS_PATH, { body }) as Promise<WithPrevious<RatingsReport>>
}

/* ─── Excel Export ─── */

export type ExportableReportType =
  | "OVERVIEW"
  | "REVENUE"
  | "BOOKINGS"
  | "EMPLOYEES"
  | "CLIENTS"
  | "SERVICES"
  | "RATINGS"
  | "ACTIVITY"

/**
 * Downloads the xlsx branch. It stays on the plain client: the response is a
 * binary body, which the JSON-typed helper does not model, and the request is
 * byte-identical to before.
 */
export async function exportReportExcel(params: {
  type: ExportableReportType
  dateFrom: string
  dateTo: string
  branchId?: string
  employeeId?: string
}): Promise<void> {
  const blob = await api.postBlob("/dashboard/ops/reports", {
    type: params.type,
    format: "EXCEL",
    from: startInstant(params.dateFrom),
    to: endInstant(params.dateTo),
    branchId: params.branchId,
    employeeId: params.employeeId,
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `report-${params.type.toLowerCase()}-${params.dateFrom}-${params.dateTo.split("T")[0]}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
