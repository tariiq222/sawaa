"use client"

import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { exportBookingsCsv } from "@/lib/api/bookings-export"
import { showApiError } from "@/lib/mutation-helpers"
import type { BookingListQuery } from "@/lib/types/booking"

export interface BookingsExportLabels {
  pending: string
  success: (count: number) => string
  errorFallback: string
  tooLarge: (total: number, max: number) => string
}

interface MutationContext {
  t?: (key: string) => string
}

/**
 * TanStack mutation around `exportBookingsCsv`. The component owns the
 * toasts and the translated messages so the hook stays UI-agnostic and
 * test-friendly.
 */
export function useBookingsExport(labels: BookingsExportLabels) {
  return useMutation({
    mutationFn: async (query: BookingListQuery) => exportBookingsCsv(query),
  })
}

/**
 * Drive the export from a component: shows a pending toast on start,
 * resolves with a translated success/error toast, and routes 4xx/5xx
 * through `showApiError` so the dashboard's existing error UX is reused.
 */
export async function runBookingsExport(
  query: BookingListQuery,
  labels: BookingsExportLabels,
  context: MutationContext = {},
): Promise<{ rowCount: number }> {
  const { MAX_EXPORT_ROWS } = await import("@/lib/api/bookings-export")
  const toastId = "bookings-export"
  const loadingToastId = toast.loading(labels.pending, { id: toastId })
  try {
    const result = await exportBookingsCsv(query)
    toast.success(labels.success(result.rowCount), { id: loadingToastId })
    return { rowCount: result.rowCount }
  } catch (err) {
    const { BookingsExportTooLargeError } = await import("@/lib/api/bookings-export")
    if (err instanceof BookingsExportTooLargeError) {
      toast.error(labels.tooLarge(err.total, MAX_EXPORT_ROWS), { id: loadingToastId })
      throw err
    }
    showApiError(err, {
      fallback: labels.errorFallback,
      t: context.t,
      dedupeKey: loadingToastId,
    })
    throw err
  }
}