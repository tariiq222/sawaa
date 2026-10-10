"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchInvoices } from "@/lib/api/invoices"
import { fetchBookings } from "@/lib/api/bookings"
import { queryKeys } from "@/lib/query-keys"

export function useClientInvoices(clientId: string, page: number) {
  const query = { clientId, page, limit: 20 }
  return useQuery({
    queryKey: queryKeys.invoices.list(query),
    queryFn: () => fetchInvoices(query),
    staleTime: 30_000,
  })
}

export function useClientBookingStatistics(clientId: string) {
  return useQuery({
    queryKey: [...queryKeys.bookings.all, "client-statistics", clientId],
    queryFn: async () => {
      const [all, completed, cancelled] = await Promise.all([
        fetchBookings({ clientId, limit: 1 }),
        fetchBookings({ clientId, limit: 1, status: "completed" }),
        fetchBookings({ clientId, limit: 1, status: "cancelled" }),
      ])
      return { total: all.meta.total, completed: completed.meta.total, cancelled: cancelled.meta.total }
    },
    staleTime: 30_000,
  })
}
