import { apiRequest } from '../client'
import { buildQueryString } from '../types/api'
import type {
  RevenueReport,
  BookingReport,
  DashboardStats,
  ReportDateParams,
} from '../types/report'

export async function revenue(params: ReportDateParams = {}): Promise<RevenueReport> {
  return apiRequest<RevenueReport>(
    `/reports/revenue${buildQueryString(params as Record<string, unknown>)}`,
  )
}

export async function bookings(params: ReportDateParams = {}): Promise<BookingReport> {
  return apiRequest<BookingReport>(
    `/reports/bookings${buildQueryString(params as Record<string, unknown>)}`,
  )
}

export async function dashboard(): Promise<DashboardStats> {
  return apiRequest<DashboardStats>('/reports/dashboard')
}

export async function exportRevenue(params: ReportDateParams = {}): Promise<Blob> {
  return apiRequest<Blob>(
    `/reports/revenue/export${buildQueryString(params as Record<string, unknown>)}`,
  )
}

export async function exportBookings(params: ReportDateParams = {}): Promise<Blob> {
  return apiRequest<Blob>(
    `/reports/bookings/export${buildQueryString(params as Record<string, unknown>)}`,
  )
}

export async function exportClients(): Promise<Blob> {
  return apiRequest<Blob>('/reports/clients/export')
}
