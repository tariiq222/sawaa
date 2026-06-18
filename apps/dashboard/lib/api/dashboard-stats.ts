/**
 * Dashboard Top Performers API — Sawaa Dashboard
 * Endpoint: GET /dashboard/top-performers
 */

import { api } from "@/lib/api"

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
