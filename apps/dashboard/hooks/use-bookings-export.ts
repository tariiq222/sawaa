"use client"

import { useMutation } from "@tanstack/react-query"
import { exportBookingsCsv } from "@/lib/api/bookings-export"

export function useBookingsExport() {
  return useMutation({
    mutationFn: (query: Parameters<typeof exportBookingsCsv>[0]) =>
      exportBookingsCsv(query),
  })
}
