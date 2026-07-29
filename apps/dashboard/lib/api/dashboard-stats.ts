/**
 * Dashboard Stats API — Sawaa Dashboard
 * Endpoints: GET /dashboard/stats, GET /dashboard/top-performers
 */

import { api } from "@/lib/api"

export interface DashboardStats {
  todayBookings: number
  confirmedToday: number
  pendingToday: number
  awaitingPaymentToday: number
  cancelRequests: number
  newClientsToday: number
  pendingPayments?: number
  todayRevenue?: number
}

export async function fetchDashboardStats(params?: {
  from?: string
  to?: string
}): Promise<DashboardStats> {
  const search = new URLSearchParams()
  if (params?.from) search.set("from", params.from)
  if (params?.to) search.set("to", params.to)
  const qs = search.toString()
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