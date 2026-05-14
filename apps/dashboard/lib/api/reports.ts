/**
 * Reports API — Deqah Dashboard
 * Controller: dashboard/ops/reports
 */

import { api } from "@/lib/api"
import type { RevenueReport, BookingReport, EmployeeReport } from "@/lib/types/report"

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

export async function fetchEmployeeReport(params: {
  dateFrom: string
  dateTo: string
  employeeId?: string
}): Promise<EmployeeReport> {
  return api.post<EmployeeReport>("/dashboard/ops/reports", {
    type: "EMPLOYEES",
    from: params.dateFrom,
    to: params.dateTo,
    employeeId: params.employeeId,
  })
}
