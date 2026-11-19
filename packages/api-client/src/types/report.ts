import type { components } from './generated/openapi'

type Schemas = components['schemas']

/**
 * NOT derived: the only documented revenue report
 * (`POST /dashboard/ops/reports` → `OpsRevenueReportDto`) is bucketed by
 * `byDay`/`byMethod`/`byStatus`, not by month. No module in this package calls
 * it. Kept hand-written.
 */
export interface RevenueByMonth {
  month: string
  revenue: number
  bookings: number
}

/** Field-for-field `OpsOverviewTopPractitionerDto` (from `OpsOverviewReportDto.topPractitioners`). */
export type RevenueByEmployee = Schemas['OpsOverviewTopPractitionerDto']

/** NOT derived: `OpsOverviewTopServiceDto` is `{count,nameAr,nameEn,serviceId}`, a different shape. */
export interface RevenueByService {
  serviceId: string
  name: string
  revenue: number
  bookings: number
}

/** NOT derived: see `RevenueByMonth` — the documented report has no byMonth/by Employee/byService rollups. */
export interface RevenueReport {
  totalRevenue: number
  totalBookings: number
  paidBookings: number
  averagePerBooking: number
  byMonth: RevenueByMonth[]
  byEmployee: RevenueByEmployee[]
  byService: RevenueByService[]
}

/** NOT derived: `OpsBookingsReportDto` uses `byStatus`/`byType` arrays and different counter names. */
export interface BookingReport {
  total: number
  byStatus: {
    pending: number
    confirmed: number
    completed: number
    cancelled: number
    pending_cancellation: number
  }
  byType: {
    in_person: number
    online: number
    walk_in: number
  }
  byDay: Array<{ date: string; count: number }>
}

/** NOT derived: `GET /dashboard/stats` returns today's counters (`todayBookings`, `todayRevenue`, …), not these totals. */
export interface DashboardStats {
  totalRevenue: number
  totalBookings: number
  totalClients: number
  totalEmployees: number
}

/** NOT derived: no documented report request uses `dateFrom`/`dateTo` (the ops report takes `from`/`to`). */
export interface ReportDateParams {
  dateFrom?: string
  dateTo?: string
}
