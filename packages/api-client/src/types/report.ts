export interface RevenueByMonth {
  month: string
  revenue: number
  bookings: number
}

export interface RevenueByEmployee {
  employeeId: string
  name: string
  revenue: number
  bookings: number
}

export interface RevenueByService {
  serviceId: string
  name: string
  revenue: number
  bookings: number
}

export interface RevenueReport {
  totalRevenue: number
  totalBookings: number
  paidBookings: number
  averagePerBooking: number
  byMonth: RevenueByMonth[]
  byEmployee: RevenueByEmployee[]
  byService: RevenueByService[]
}

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

export interface DashboardStats {
  totalRevenue: number
  totalBookings: number
  totalClients: number
  totalEmployees: number
}

export interface ReportDateParams {
  dateFrom?: string
  dateTo?: string
}
