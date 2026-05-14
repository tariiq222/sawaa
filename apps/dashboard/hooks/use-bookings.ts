"use client"

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
  checkInBooking,
  adminCancelBooking,
  createRecurringBooking,
  fetchBookingsStats,
} from "@/lib/api/bookings"
import type {
  BookingStatus,
  BookingType,
  BookingListQuery,
} from "@/lib/types/booking"

/* ─── Filters ─── */

interface BookingFilters {
  status: BookingStatus | "all"
  type: BookingType | "all"
  isGuest: boolean | "all"
  dateFrom: string
  dateTo: string
  employeeId: string
  search: string
}

const defaultFilters: BookingFilters = {
  status: "all",
  type: "all",
  isGuest: "all",
  dateFrom: "",
  dateTo: "",
  employeeId: "",
  search: "",
}

/* ─── List Hook ─── */

export function useBookings() {
  const [page, setPage] = useState(1)
  const [filters, setFiltersState] = useState<BookingFilters>(defaultFilters)

  const hasFilters =
    filters.status !== "all" ||
    filters.type !== "all" ||
    filters.isGuest !== "all" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.employeeId !== "" ||
    filters.search !== ""

  const query: BookingListQuery = {
    page,
    perPage: 20,
    status: filters.status !== "all" ? filters.status : undefined,
    type: filters.type !== "all" ? filters.type : undefined,
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
  })

  const setFilters = useCallback((partial: Partial<BookingFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }))
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters)
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
  }
}

/* ─── Today's Bookings Hook ─── */

export function useBookingsStats() {
  return useQuery({
    queryKey: queryKeys.bookings.stats(),
    queryFn: fetchBookingsStats,
    staleTime: 30_000,
  })
}

export function useTodayBookings(date: string) {
  const query: BookingListQuery = { dateFrom: date, dateTo: date, perPage: 10 }
  return useQuery({
    queryKey: queryKeys.bookings.list(query),
    queryFn: () => fetchBookings(query),
    staleTime: 30_000,
  })
}

/* ─── Mutations ─── */

export function useBookingMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all })

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
    onSuccess: invalidate,
  })

  const checkInMut = useMutation({
    mutationFn: checkInBooking,
    onSuccess: invalidate,
  })

  const adminCancelMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof adminCancelBooking>[1]) =>
      adminCancelBooking(id, payload),
    onSuccess: invalidate,
  })

  const recurringMut = useMutation({
    mutationFn: createRecurringBooking,
    onSuccess: invalidate,
  })

  return {
    createMut,
    rescheduleMut,
    confirmMut,
    completeMut,
    noShowMut,
    checkInMut,
    adminCancelMut,
    recurringMut,
  }
}
