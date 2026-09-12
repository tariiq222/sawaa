"use client"

/**
 * Credit Bookings Hooks — Sawaa Dashboard
 *
 * TanStack Query bindings for the Phase 3 session-packages consumption
 * endpoints:
 *   - `useMatchingCredits` → GET /dashboard/bookings/matching-credits
 *   - `useBookFromCredit` → POST /dashboard/bookings/from-credit
 *
 * Mirrors the conventions of `hooks/use-package-purchases.ts` — TanStack
 * Query only, no manual fetches, query keys centralized in
 * `lib/query-keys.ts`.
 *
 * The `useMatchingCredits` hook is GATED on all four params being
 * present (clientId, serviceId, employeeId, durationOptionId) — the
 * backend requires the full triple to FIFO-select a credit. Pass
 * `enabled` to override (e.g., if a parent already checked).
 *
 * The `useBookFromCredit` mutation invalidates bookings (a fresh
 * booking row appears), client package-purchases (one credit bucket
 * decremented), and any active package detail.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"
import { invalidateMutationImpact } from "@/lib/query-invalidation"
import {
  bookFromCredit,
  fetchMatchingCredits,
} from "@/lib/api/credit-bookings"
import type {
  BookFromCreditPayload,
  MatchingCreditsQuery,
  MatchingCredit,
} from "@/lib/types/credit-booking"

/* ─── Matching credits query ─── */

/**
 * `useMatchingCredits` returns the client's ACTIVE matching credits
 * for the given (service, employee, durationOptionId) triple, FIFO.
 *
 * Auto-disabled when ANY of the four params is missing — the backend
 * requires the full triple. Callers can still pass `enabled` to
 * override (e.g., when deferring fetch until a parent confirms the
 * user wants to see suggestions).
 */
export function useMatchingCredits(
  query: MatchingCreditsQuery,
  enabled: boolean = true,
) {
  const allPresent =
    !!query.clientId &&
    !!query.serviceId &&
    !!query.employeeId &&
    !!query.durationOptionId

  return useQuery<MatchingCredit[]>({
    queryKey: queryKeys.creditBookings.matchingCredits(query),
    queryFn: () => fetchMatchingCredits(query),
    enabled: enabled && allPresent,
    staleTime: 30_000,
  })
}

/* ─── Book from credit mutation ─── */

/**
 * Consume a credit to create a zero-value booking. On success
 * invalidates:
 *   - all bookings (the new row appears in lists + detail sheets),
 *   - all package-purchases (the credit bucket's `reservedQuantity` — the
 *     session is reserved, not yet delivered — and possibly the purchase's
 *     `status` change).
 */
export function useBookFromCredit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: BookFromCreditPayload) => bookFromCredit(payload),
    onSuccess: (_booking, payload) => {
      // The explicit-credit form may omit the matching triple. In that case
      // we cannot safely name a practitioner slot, so invalidate only the
      // entity-wide credit surfaces rather than inventing an employee ID.
      const bookingContext = readBookingContext(_booking)
      const employeeId = payload.employeeId ?? bookingContext.employeeId
      if (!employeeId) {
        return Promise.allSettled([
          queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all, refetchType: "all" }),
          queryClient.invalidateQueries({ queryKey: queryKeys.packagePurchases.all, refetchType: "all" }),
          queryClient.invalidateQueries({ queryKey: queryKeys.packagePurchases.client(payload.clientId), refetchType: "all" }),
          queryClient.invalidateQueries({ queryKey: queryKeys.creditBookings.all, refetchType: "all" }),
          queryClient.invalidateQueries({ queryKey: queryKeys.packageReports.all, refetchType: "all" }),
          queryClient.invalidateQueries({ queryKey: queryKeys.reports.bookingsFamily(), refetchType: "all" }),
        ]).then(() => undefined)
      }

      return invalidateMutationImpact(queryClient, {
        kind: "credit-booked",
        clientId: payload.clientId,
        employeeId,
        date: bookingContext.date ?? clinicDateFromIso(payload.scheduledAt),
        bookingId: bookingContext.id,
      })
    },
  })
}

function readBookingContext(value: unknown): {
  id?: string
  employeeId?: string
  date?: string
} {
  if (typeof value !== "object" || value === null) return {}
  const row = value as Record<string, unknown>
  const id = typeof row.id === "string" ? row.id : undefined
  const employeeId = typeof row.employeeId === "string" ? row.employeeId : undefined
  const dateValue = typeof row.date === "string"
    ? row.date
    : typeof row.scheduledAt === "string"
      ? row.scheduledAt
      : undefined
  return {
    id,
    employeeId,
    date: dateValue && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
      ? dateValue
      : dateValue
        ? clinicDateFromIso(dateValue)
        : undefined,
  }
}

function clinicDateFromIso(value: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value))
  const year = parts.find((part) => part.type === "year")?.value ?? "0000"
  const month = parts.find((part) => part.type === "month")?.value ?? "01"
  const day = parts.find((part) => part.type === "day")?.value ?? "01"
  return `${year}-${month}-${day}`
}
