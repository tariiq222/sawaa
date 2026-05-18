/**
 * Reports API — Sawaa Dashboard
 * Controller: dashboard/ops/reports
 */

import { api, getAccessToken } from "@/lib/api"
import type { RevenueReport, BookingReport, EmployeeReport, TopPractitionersReport } from "@/lib/types/report"

export async function fetchRevenueReport(params: {
  dateFrom: string
  dateTo: string
  branchId?: string
}): Promise<RevenueReport> {
  return api.post<RevenueReport>("/dashboard/ops/reports", {
    type: "REVENUE",
    from: params.dateFrom,
    to: params.dateTo,
    branchId: params.branchId,
  })
}

export async function fetchBookingReport(params: {
  dateFrom: string
  dateTo: string
  branchId?: string
}): Promise<BookingReport> {
  return api.post<BookingReport>("/dashboard/ops/reports", {
    type: "BOOKINGS",
    from: params.dateFrom,
    to: params.dateTo,
    branchId: params.branchId,
  })
}

/**
 * Fetch EMPLOYEES report. Pass employeeId to get per-employee data,
 * or omit it to get the top-5 practitioners list.
 */
export async function fetchEmployeeReport(params: {
  dateFrom: string
  dateTo: string
  employeeId?: string
}): Promise<EmployeeReport | TopPractitionersReport[]> {
  if (params.employeeId) {
    return api.post<EmployeeReport>("/dashboard/ops/reports", {
      type: "EMPLOYEES",
      from: params.dateFrom,
      to: params.dateTo,
      employeeId: params.employeeId,
    })
  }
  // No employeeId → returns top-5 practitioners list
  return api.post<TopPractitionersReport[]>("/dashboard/ops/reports", {
    type: "EMPLOYEES",
    from: params.dateFrom,
    to: params.dateTo,
  })
}

/* ─── Excel Export ─── */

export type ExportableReportType = "REVENUE" | "ACTIVITY"

/**
 * Downloads an Excel report as a binary blob and triggers browser download.
 * Backend supports EXCEL format for REVENUE and ACTIVITY report types.
 */
export async function exportReportExcel(params: {
  type: ExportableReportType
  dateFrom: string
  dateTo: string
  branchId?: string
  employeeId?: string
}): Promise<void> {
  const token = getAccessToken()
  const res = await fetch("/api/proxy/dashboard/ops/reports", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      type: params.type,
      format: "EXCEL",
      from: params.dateFrom,
      to: params.dateTo,
      branchId: params.branchId,
      employeeId: params.employeeId,
    }),
  })

  if (!res.ok) {
    throw new Error(`Export failed: ${res.status}`)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `report-${params.type.toLowerCase()}-${params.dateFrom}-${params.dateTo.split("T")[0]}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
