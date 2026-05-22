/**
 * Report Types — Sawaa Dashboard
 * Mirrors apps/backend/src/modules/ops/generate-report/*.builder.ts
 */

/* ─── Query ─── */

export interface ReportDateQuery {
  dateFrom: string
  dateTo: string
}

export interface ReportQuery extends ReportDateQuery {
  branchId?: string
  compareWithPrevious?: boolean
}

export interface PractitionerReportQuery extends ReportQuery {
  employeeId?: string
}

/** Wraps any report with optional previous-period data */
export type WithPrevious<T> = T & { previous?: T }

/* ─── Overview ─── */

export interface OverviewReport {
  totalRevenue: number
  totalBookings: number
  completedBookings: number
  completionRate: number
  newClients: number
  trend: { date: string; revenue: number; bookings: number }[]
  topServices: {
    serviceId: string
    nameAr: string
    nameEn: string | null
    count: number
  }[]
  topPractitioners: {
    employeeId: string
    name: string
    revenue: number
    bookings: number
  }[]
}

/* ─── Revenue ─── */

export type PaymentStatusKey =
  | "PENDING"
  | "PENDING_VERIFICATION"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED"

export interface RevenueReport {
  totalRevenue: number
  netRevenue: number
  totalBookings: number
  averagePerBooking: number
  refundsTotal: number
  byMethod: { method: string; amount: number; count: number }[]
  byStatus: { status: PaymentStatusKey; amount: number; count: number }[]
  byDay: { date: string; amount: number; count: number }[]
  couponsUsed: {
    code: string
    uses: number
    discountAmount: number
    isActive: boolean
  }[]
  recentPayments: {
    id: string
    date: string
    clientName: string
    serviceName: string
    method: string
    amount: number
    status: PaymentStatusKey
  }[]
}

/* ─── Bookings ─── */

export interface BookingReport {
  total: number
  byStatus: { status: string; count: number }[]
  byType: { type: string; count: number }[]
  byDay: { date: string; count: number }[]
  noShowRate: number
  cancelRate: number
  avgDurationMins: number
  byHourDow: { dow: number; hour: number; count: number }[]
  byCancelReason: { reason: string; count: number }[]
}

/* ─── Clients ─── */

export type ClientGenderKey = "MALE" | "FEMALE" | "UNKNOWN"
export type ClientAgeGroup = "<18" | "18-29" | "30-44" | "45-59" | "60+" | "UNKNOWN"

export interface ClientsReport {
  total: number
  newClients: number
  returningClients: number
  retentionRate: number
  byGender: { gender: ClientGenderKey; count: number }[]
  byAgeGroup: { group: ClientAgeGroup; count: number }[]
  topByRevenue: {
    clientId: string
    name: string
    bookings: number
    revenue: number
  }[]
}

/* ─── Practitioners ─── */

export interface PractitionerRow {
  employeeId: string
  name: string
  role: string | null
  bookings: number
  completedBookings: number
  completionRate: number
  revenue: number
  utilization: number
  averageRating: number
}

export interface PractitionersReport {
  totalActive: number
  avgRevenue: number
  avgUtilization: number
  avgRating: number
  totalCompleted: number
  rows: PractitionerRow[]
}

/** Per-employee detail (when employeeId is passed) */
export interface PractitionerDetail extends PractitionerRow {
  byDay: { date: string; bookings: number; revenue: number }[]
}

/* ─── Services ─── */

export interface ServicesReport {
  rows: {
    serviceId: string
    nameAr: string
    nameEn: string | null
    bookings: number
    completedBookings: number
    revenue: number
    cancelRate: number
    averageRating: number
  }[]
}

/* ─── Ratings ─── */

export interface RatingsReport {
  averageScore: number
  totalRatings: number
  positiveCount: number
  negativeCount: number
  distribution: { score: 1 | 2 | 3 | 4 | 5; count: number }[]
  trend: { date: string; average: number; count: number }[]
  recentNegative: {
    id: string
    bookingId: string
    score: number
    comment: string | null
    clientName: string
    employeeName: string
    serviceName: string
    createdAt: string
  }[]
}

/* ─── Backwards-compat exports ─── */

/** Legacy alias kept while we delete the old tab components */
export type EmployeeReport = PractitionerDetail
export type TopPractitionersReport = OverviewReport["topPractitioners"][number]
