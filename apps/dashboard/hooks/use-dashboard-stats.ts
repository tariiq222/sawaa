"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchDashboardStats } from "@/lib/api/dashboard-stats"
import type { DashboardStatsRange } from "@/lib/api/dashboard-stats"

export function useDashboardStats(range?: DashboardStatsRange) {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(range),
    queryFn: () => fetchDashboardStats(range),
    staleTime: 30_000,
  })
}
