"use client"

// EXCEPTION: hook colocates `useBookings`, `useTodayBookings`, and
// `useBookingMutations` because they share a single QueryClient namespace and
// inverting either list hook into its own file would force callers to import
// two paths for one feature surface. Approved 2026-06-19; +16 added
// 2026-08-26 for the today-baseline default filter + reset semantics
// (BK-TODAY-DEFAULT); +10 added 2026-08-27 for the restore-no-show mutation
// (T3-dashboard-restore-noshow).

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchBookings,
  createBooking,
  rescheduleBooking,
  confirmBooking,
  completeBooking,
  markNoShow,
  restoreNoShowBooking,
  checkInBooking,
  adminCancelBooking,
  deleteBooking,
  approveCancelBooking,
  rejectCancelBooking,
} from "@/lib/api/bookings"
import type {
  Booking,
  BookingStatus,
  BookingType,
  DeliveryType,
  BookingListQuery,
} from "@/lib/types/booking"
import { todayClinicYmd } from "@/lib/utils"
import { invalidateMutationImpact } from "@/lib/query-invalidation"

/* ─── Filters ─── */

interface BookingFilters {
  status: BookingStatus | "all"
  type: BookingType | "all"
  delivery: DeliveryType | "all"
  isLateEntry: boolean | "all"
  isGuest: boolean | "all"
  dateFrom: string
  dateTo: string
  employeeId: string
  search: string
}

const defaultFilters: BookingFilters = {
  status: "all",
  type: "all",
  delivery: "all",
  isLateEntry: "all",
  isGuest: "all",
  dateFrom: "",
  dateTo: "",
  employeeId: "",
  search: "",
}

/**
 * Build a fresh filter state anchored on the clinic's current day.
 * Today (Asia/Riyadh) is the baseline; `hasFilters` treats that range as the
 * "clean" state so the Reset button doesn't appear on first paint.
 */
function defaultFiltersForToday(): BookingFilters {
  const today = todayClinicYmd()
  return { ...defaultFilters, dateFrom: today, dateTo: today }
}

/* ─── List Hook ─── */

export function useBookings() {
  const [page, setPage] = useState(1)
  const [filters, setFiltersState] = useState<BookingFilters>(defaultFiltersForToday)

  // Recompute "today" each render so a session that survives midnight doesn't
  // pin yesterday as the baseline; date dimension dirty-check is relative to
  // the current clinic day.
  const today = todayClinicYmd()

  const hasFilters =
    filters.status !== "all" ||
    filters.type !== "all" ||
    filters.delivery !== "all" ||
    filters.isLateEntry !== "all" ||
    filters.isGuest !== "all" ||
    filters.dateFrom !== today ||
    filters.dateTo !== today ||
    filters.employeeId !== "" ||
    filters.search !== ""

  const query: BookingListQuery = {
    page,
    isLateEntry: filters.isLateEntry !== "all" ? filters.isLateEntry : undefined,
    limit: 20,
    status: filters.status !== "all" ? filters.status : undefined,
    type: filters.type !== "all" ? filters.type : undefined,
    deliveryType: filters.delivery !== "all" ? filters.delivery : undefined,
    isGuest: filters.isGuest !== "all" ? filters.isGuest : undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    search: filters.search || undefined,
    employeeId: filters.employeeId || undefined,
  }

  const {
    data: bookingsData,
    isLoading: bookingsLoading,
    error: bookingsError,
  } = useQuery({
    queryKey: queryKeys.bookings.list(query),
    queryFn: () => fetchBookings(query),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })

  const setFilters = useCallback((partial: Partial<BookingFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }))
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState(defaultFiltersForToday())
    setPage(1)
  }, [])

  return {
    bookings: bookingsData?.items ?? [],
    meta: bookingsData?.meta ?? null,
    loading: bookingsLoading,
    error: bookingsError?.message ?? null,
    filters,
    setFilters,
    resetFilters,
    setPage,
    hasFilters,
    query,
  }
}

/* ─── Today's Bookings Hook ─── */

export function useTodayBookings(date: string) {
  const query: BookingListQuery = { dateFrom: date, dateTo: date, limit: 10 }
  return useQuery({
    queryKey: queryKeys.bookings.list(query),
    queryFn: () => fetchBookings(query),
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}

/* ─── Mutations ─── */

export function useBookingMutations() {
  const queryClient = useQueryClient()
  const cachedBooking = (bookingId: string): Booking | undefined => {
    const rows = queryClient.getQueriesData<{ items?: Booking[] }>({
      queryKey: queryKeys.bookings.all,
    })
    return rows.flatMap(([, data]) => data?.items ?? []).find((item) => item.id === bookingId)
  }
  const invalidate = () => {
    // Any booking mutation changes practitioner availability — drop the cached
    // slot grids so a booked time disappears immediately instead of lingering
    // (and failing on click) under the global 5-min staleTime.
    return Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all, refetchType: "all" }),
      queryClient.invalidateQueries({ queryKey: ["employees", "slots"], refetchType: "all" }),
    ]).then(() => undefined)
  }
  const invalidateCredit = (
    kind: "credit-booked" | "credit-returned",
    bookingId: string,
    response?: Booking,
  ) => {
    // Lifecycle endpoints return the updated Prisma row without the mapped
    // packageFunding relation. Merge that response over the cached list row so
    // a consumed credit is still recognized for return/reclaim invalidation.
    const cached = cachedBooking(bookingId)
    const booking = (cached || response)
      ? ({ ...cached, ...response } as Booking)
      : undefined
    if (!booking?.clientId || !booking.employeeId || !booking.date) return invalidate()
    const extra = booking as Booking & { programId?: string }
    return Promise.allSettled([
      invalidate(),
      booking.packageFunding
        ? invalidateMutationImpact(queryClient, {
            kind,
            clientId: booking.clientId,
            employeeId: booking.employeeId,
            date: booking.date,
            bookingId: booking.id,
            programId: extra.programId,
          })
        : Promise.resolve(),
    ]).then(() => undefined)
  }

  const createMut = useMutation({
    mutationFn: createBooking,
    onSuccess: invalidate,
  })

  const rescheduleMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof rescheduleBooking>[1]) =>
      rescheduleBooking(id, payload),
    onSuccess: invalidate,
  })

  const confirmMut = useMutation({
    mutationFn: confirmBooking,
    onSuccess: invalidate,
  })

  const completeMut = useMutation({
    mutationFn: completeBooking,
    onSuccess: invalidate,
  })

  const noShowMut = useMutation({
    mutationFn: markNoShow,
    onSuccess: (booking, bookingId) => invalidateCredit("credit-returned", bookingId, booking),
  })

  const restoreNoShowMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      restoreNoShowBooking(id, reason),
    onSuccess: (booking, variables) => invalidateCredit("credit-booked", variables.id, booking),
  })

  const checkInMut = useMutation({
    mutationFn: checkInBooking,
    onSuccess: invalidate,
  })

  const adminCancelMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof adminCancelBooking>[1]) =>
      adminCancelBooking(id, payload),
    onSuccess: (booking, variables) => invalidateCredit("credit-returned", variables.id, booking),
  })

  const deleteMut = useMutation({
    mutationFn: deleteBooking,
    onSuccess: invalidate,
  })

  const approveCancelMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof approveCancelBooking>[1]) =>
      approveCancelBooking(id, payload),
    onSuccess: (booking, variables) => invalidateCredit("credit-returned", variables.id, booking),
  })

  const rejectCancelMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof rejectCancelBooking>[1]) =>
      rejectCancelBooking(id, payload),
    onSuccess: invalidate,
  })

  return {
    createMut,
    rescheduleMut,
    confirmMut,
    completeMut,
    noShowMut,
    restoreNoShowMut,
    checkInMut,
    adminCancelMut,
    deleteMut,
    approveCancelMut,
    rejectCancelMut,
  }
}
