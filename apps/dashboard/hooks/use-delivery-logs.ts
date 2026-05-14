"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchDeliveryLogs,
  fetchEmailFallbackQuota,
} from "@/lib/api/delivery-logs"
import type { DeliveryLogsFilters } from "@/lib/api/delivery-logs"

export function useDeliveryLogs(filters: DeliveryLogsFilters = {}) {
  return useQuery({
    queryKey: queryKeys.deliveryLogs.list(filters),
    queryFn: () => fetchDeliveryLogs(filters),
    staleTime: 60 * 1000,
  })
}

export function useEmailFallbackQuota() {
  return useQuery({
    queryKey: queryKeys.emailFallbackQuota.current(),
    queryFn: fetchEmailFallbackQuota,
    staleTime: 5 * 60 * 1000,
  })
}
