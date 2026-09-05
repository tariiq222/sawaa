"use client"

import { createContext, createElement, useCallback, useContext, useEffect, useRef, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { fetchBooking } from "@/lib/api/bookings"
import { queryKeys } from "@/lib/query-keys"
import type { Booking } from "@/lib/types/booking"
import type { PaginatedResponse } from "@/lib/types/common"

export const BOOKING_PAYMENT_POLL_INTERVAL_MS = 2_000
export const BOOKING_PAYMENT_POLL_TIMEOUT_MS = 30_000

type BookingPaymentPollingController = {
  start: (bookingId: string) => void
  cancel: () => void
}

const BookingPaymentPollingContext = createContext<BookingPaymentPollingController | null>(null)

const WAITING_FOR_PAYMENT_EVENT = new Set([
  "pending", "awaiting_payment", "deposit_paid", "pending_group_fill",
])

type PollingJob = {
  timer: ReturnType<typeof setTimeout> | null
  deadlineTimer: ReturnType<typeof setTimeout> | null
  deadline: number
  lastStatus?: string
}

/**
 * Refetch one booking while the payment event is being consumed.
 *
 * This controller is intentionally owned by the mounted payment surface. It
 * never creates application-wide polling, and its job identity guard prevents a
 * late response from a cancelled/unmounted controller from writing to cache.
 */
function useBookingPaymentPollingController(): BookingPaymentPollingController {
  const queryClient = useQueryClient()
  const mountedRef = useRef(false)
  const jobsRef = useRef(new Map<string, PollingJob>())

  const cancel = useCallback(() => {
    for (const job of jobsRef.current.values()) {
      if (job.timer) clearTimeout(job.timer)
      if (job.deadlineTimer) clearTimeout(job.deadlineTimer)
    }
    jobsRef.current.clear()
  }, [])

  const start = useCallback((bookingId: string) => {
    if (!mountedRef.current) return
    const previous = jobsRef.current.get(bookingId)
    if (previous?.timer) clearTimeout(previous.timer)
    if (previous?.deadlineTimer) clearTimeout(previous.deadlineTimer)
    const job: PollingJob = {
      timer: null, deadlineTimer: null, deadline: Date.now() + BOOKING_PAYMENT_POLL_TIMEOUT_MS,
    }
    jobsRef.current.set(bookingId, job)
    const isCurrent = () => mountedRef.current && jobsRef.current.get(bookingId) === job
      && Date.now() <= job.deadline
    const refreshRelated = () => Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.lists(), refetchType: "all" }),
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.statusLog(bookingId), refetchType: "all" }),
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.timeline(bookingId), refetchType: "all" }),
    ])
    const finish = (refresh = false) => {
      if (jobsRef.current.get(bookingId) !== job) return
      if (job.timer) clearTimeout(job.timer)
      if (job.deadlineTimer) clearTimeout(job.deadlineTimer)
      jobsRef.current.delete(bookingId)
      if (refresh && mountedRef.current) void refreshRelated()
    }

    const poll = async () => {
      if (!isCurrent()) { finish(); return }

      try {
        // Fetch outside TanStack Query: fetchQuery writes into the shared cache
        // before its promise resolves, which would bypass the job identity guard
        // when logout or navigation unmounts this owner mid-request.
        const booking = await fetchBooking(bookingId)
        if (!isCurrent()) { finish(); return }

        queryClient.setQueryData(queryKeys.bookings.detail(bookingId), booking)
        queryClient.setQueriesData<PaginatedResponse<Booking>>(
          { queryKey: queryKeys.bookings.lists() },
          (current) => {
            if (!current?.items) return current
            return {
              ...current,
              items: current.items.map((item) =>
                item.id === booking.id ? booking : item,
              ),
            }
          },
        )

        // The server owns filtered membership/totals, including intermediate
        // deposit/group states. Refresh only on observed changes, not every tick.
        if (job.lastStatus !== booking.status) {
          job.lastStatus = booking.status
          void refreshRelated()
        }
        if (!WAITING_FOR_PAYMENT_EVENT.has(booking.status)) {
          finish()
          return
        }
      } catch {
        // A transient read failure should not erase the successful payment or
        // turn it into a retry action. Continue until the bounded deadline.
      }

      if (isCurrent() && Date.now() + BOOKING_PAYMENT_POLL_INTERVAL_MS <= job.deadline) {
        job.timer = setTimeout(poll, BOOKING_PAYMENT_POLL_INTERVAL_MS)
      }
    }

    job.timer = setTimeout(poll, BOOKING_PAYMENT_POLL_INTERVAL_MS)
    // A hung detail read must not keep a job alive beyond its deadline.
    job.deadlineTimer = setTimeout(() => finish(true), BOOKING_PAYMENT_POLL_TIMEOUT_MS)
  }, [queryClient])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      cancel()
    }
  }, [cancel])

  return { start, cancel }
}

/** Stable owner for payment synchronization across wizard/dialog unmounts. */
export function BookingPaymentPollingProvider({ children }: { children: ReactNode }) {
  const controller = useBookingPaymentPollingController()
  return createElement(
    BookingPaymentPollingContext.Provider,
    { value: controller },
    children,
  )
}

export function useBookingPaymentPolling(): BookingPaymentPollingController {
  const contextController = useContext(BookingPaymentPollingContext)
  const localController = useBookingPaymentPollingController()
  return contextController ?? localController
}
