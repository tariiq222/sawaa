/**
 * Reports API — Sawaa Dashboard
 * Backend: POST /dashboard/ops/reports — single polymorphic endpoint, type discriminator.
 */

import { api } from "@/lib/api"
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
  q: ReportQuery & { employeeId?: string },
): Record<string, unknown> {
  return {
    type,
    from: q.dateFrom,
    to: q.dateTo,
    branchId: q.branchId,
    employeeId: q.employeeId,
    compareWithPrevious: q.compareWithPrevious,
  }
}

export async function fetchOverviewReport(
  q: ReportQuery,
): Promise<WithPrevious<OverviewReport>> {
  return api.post("/dashboard/ops/reports", buildBody("OVERVIEW", q))
}

export async function fetchRevenueReport(
  q: ReportQuery,
): Promise<WithPrevious<RevenueReport>> {
  return api.post("/dashboard/ops/reports", buildBody("REVENUE", q))
}

export async function fetchBookingReport(
  q: ReportQuery,
): Promise<WithPrevious<BookingReport>> {
  return api.post("/dashboard/ops/reports", buildBody("BOOKINGS", q))
}

export async function fetchClientsReport(
  q: ReportQuery,
): Promise<WithPrevious<ClientsReport>> {
  return api.post("/dashboard/ops/reports", buildBody("CLIENTS", q))
}

export async function fetchPractitionersReport(
  q: ReportQuery,
): Promise<WithPrevious<PractitionersReport>> {
  return api.post("/dashboard/ops/reports", buildBody("EMPLOYEES", q))
}

export async function fetchServicesReport(
  q: ReportQuery,
): Promise<WithPrevious<ServicesReport>> {
  return api.post("/dashboard/ops/reports", buildBody("SERVICES", q))
}

export async function fetchRatingsReport(
  q: ReportQuery,
): Promise<WithPrevious<RatingsReport>> {
  return api.post("/dashboard/ops/reports", buildBody("RATINGS", q))
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
    from: params.dateFrom,
    to: params.dateTo,
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
