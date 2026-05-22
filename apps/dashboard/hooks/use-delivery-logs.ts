"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchDeliveryLogs } from "@/lib/api/delivery-logs"
import type { DeliveryLogsFilters } from "@/lib/api/delivery-logs"

export function useDeliveryLogs(filters: DeliveryLogsFilters = {}) {
  return useQuery({
    queryKey: queryKeys.deliveryLogs.list(filters),
    queryFn: () => fetchDeliveryLogs(filters),
    staleTime: 60 * 1000,
  })
}
