/**
 * Report Types — Sawaa Dashboard
 */

/* ─── Query ─── */

export interface ReportDateQuery {
  dateFrom: string
  dateTo: string
}

export interface RevenueReportQuery extends ReportDateQuery {
  employeeId?: string
}

/* ─── Response ─── */

export interface RevenueReport {
  totalRevenue: number
  totalBookings: number
  averagePerBooking: number
  byMethod: { method: string; amount: number; count: number }[]
  byDay: { date: string; amount: number; count: number }[]
}

export interface BookingReport {
  total: number
  byStatus: { status: string; count: number }[]
  byType: { type: string; count: number }[]
  byDay: { date: string; count: number }[]
}

export interface EmployeeReport {
  employeeId: string
  totalBookings: number
  completedBookings: number
  totalRevenue: number
  averageRating: number
  byDay: { date: string; bookings: number; revenue: number }[]
}

/** Top-5 practitioners returned when employeeId is omitted */
export interface TopPractitionersReport {
  employeeId: string
  displayName: string
  totalBookings: number
  completedBookings: number
  totalRevenue: number
  averageRating: number
}
