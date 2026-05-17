/**
 * Dashboard Stats API — Sawaa Dashboard
 * Endpoint: GET /dashboard/stats
 */

import { api } from "@/lib/api"

export interface DashboardStats {
  todayBookings: number
  confirmedToday: number
  pendingToday: number
  newClientsToday: number
  pendingPayments: number
  cancelRequests: number
  todayRevenue: number
}

export interface DashboardStatsRange {
  from?: string
  to?: string
}

export async function fetchDashboardStats(
  range?: DashboardStatsRange,
): Promise<DashboardStats> {
  const params = new URLSearchParams()
  if (range?.from) params.set("from", range.from)
  if (range?.to) params.set("to", range.to)
  const qs = params.toString()
  return api.get<DashboardStats>(`/dashboard/stats${qs ? `?${qs}` : ""}`)
}

export interface TopPerformer {
  employeeId: string
  displayName: string
  avatarUrl: string | null
  bookingsCount: number
  revenue: number
}

export async function fetchTopPerformers(): Promise<TopPerformer[]> {
  return api.get<TopPerformer[]>("/dashboard/top-performers?period=month")
}
