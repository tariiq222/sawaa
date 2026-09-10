import { render, renderHook, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { queryKeys } from "@/lib/query-keys"

const { fetchBooking } = vi.hoisted(() => ({ fetchBooking: vi.fn() }))

vi.mock("@/lib/api/bookings", () => ({ fetchBooking }))

import {
  BOOKING_PAYMENT_POLL_INTERVAL_MS,
  BookingPaymentPollingProvider,
  useBookingPaymentPolling,
} from "@/hooks/use-booking-payment-polling"

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function makeWrapper(client: QueryClient) {
  return function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function booking(status: string) {
  return { id: "bk-1", status, clientId: "cl-1", employeeId: "emp-1" }
}

describe("useBookingPaymentPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("continues after collecting a deposit-paid booking's remaining balance", async () => {
    const client = makeClient()
    fetchBooking.mockResolvedValueOnce(booking("deposit_paid"))
      .mockResolvedValueOnce(booking("confirmed"))
    const { result } = renderHook(() => useBookingPaymentPolling(), { wrapper: makeWrapper(client) })
    act(() => result.current.start("bk-1"))
    await act(async () => { await vi.advanceTimersByTimeAsync(4_000) })
    expect(client.getQueryData(queryKeys.bookings.detail("bk-1"))).toEqual(booking("confirmed"))
  })

  it("keeps both affected bookings synchronized when two payments are saved before delivery", async () => {
    const client = makeClient()
    fetchBooking.mockImplementation(async (id: string) => ({ ...booking("confirmed"), id }))
    const { result } = renderHook(() => useBookingPaymentPolling(), { wrapper: makeWrapper(client) })
    act(() => {
      result.current.start("bk-1")
      result.current.start("bk-2")
    })
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
    expect(client.getQueryData(queryKeys.bookings.detail("bk-1"))).toEqual(booking("confirmed"))
    expect(client.getQueryData(queryKeys.bookings.detail("bk-2"))).toEqual({ ...booking("confirmed"), id: "bk-2" })
  })

  it.each(["confirmed", "deposit_paid", "pending_group_fill"])("refreshes filtered list membership after the consumer reaches %s", async (status) => {
    const client = makeClient()
    const key = queryKeys.bookings.list({ status: "awaiting_payment" })
    let serverList = { items: [booking("awaiting_payment")], meta: { total: 1 } }
    await client.fetchQuery({ queryKey: key, queryFn: async () => serverList })
    serverList = { items: [], meta: { total: 0 } }
    fetchBooking.mockResolvedValue(booking(status))
    const { result } = renderHook(() => useBookingPaymentPolling(), { wrapper: makeWrapper(client) })
    act(() => result.current.start("bk-1"))
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000) })
    expect(client.getQueryData(key)).toEqual({ items: [], meta: { total: 0 } })
  })

  it("refreshes the list once at the deadline even if the detail request is still in flight", async () => {
    const client = makeClient()
    const key = queryKeys.bookings.list({ status: "awaiting_payment" })
    let serverList = { items: [booking("awaiting_payment")], meta: { total: 1 } }
    await client.fetchQuery({ queryKey: key, queryFn: async () => serverList })
    serverList = { items: [], meta: { total: 0 } }
    let resolveBooking!: (value: ReturnType<typeof booking>) => void
    fetchBooking.mockReturnValue(new Promise((resolve) => { resolveBooking = resolve }))
    const { result } = renderHook(() => useBookingPaymentPolling(), { wrapper: makeWrapper(client) })
    act(() => result.current.start("bk-1"))
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(client.getQueryData(key)).toEqual({ items: [], meta: { total: 0 } })
    await act(async () => { resolveBooking(booking("confirmed")); await Promise.resolve() })
    expect(client.getQueryData(queryKeys.bookings.detail("bk-1"))).toBeUndefined()
  })

  it("refetches a pending booking every two seconds until it confirms", async () => {
    const client = makeClient()
    fetchBooking
      .mockResolvedValueOnce(booking("awaiting_payment"))
      .mockResolvedValueOnce(booking("confirmed"))
    const { result } = renderHook(() => useBookingPaymentPolling(), {
      wrapper: makeWrapper(client),
    })

    act(() => result.current.start("bk-1"))
    expect(fetchBooking).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOOKING_PAYMENT_POLL_INTERVAL_MS)
    })
    expect(fetchBooking).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOOKING_PAYMENT_POLL_INTERVAL_MS)
    })
    expect(fetchBooking).toHaveBeenCalledTimes(2)
    expect(client.getQueryData(["bookings", "detail", "bk-1"])).toEqual(booking("confirmed"))
  })

  it("cancels the pending timer when the owner unmounts", async () => {
    const client = makeClient()
    fetchBooking.mockResolvedValue(booking("awaiting_payment"))
    const { result, unmount } = renderHook(() => useBookingPaymentPolling(), {
      wrapper: makeWrapper(client),
    })

    act(() => result.current.start("bk-1"))
    unmount()
    act(() => result.current.start("bk-1"))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOOKING_PAYMENT_POLL_INTERVAL_MS * 2)
    })

    expect(fetchBooking).not.toHaveBeenCalled()
  })

  it("keeps polling when the dialog owner unmounts, while the page provider stays mounted", async () => {
    const client = makeClient()
    fetchBooking.mockResolvedValue(booking("confirmed"))
    let controller: ReturnType<typeof useBookingPaymentPolling> | undefined
    let setVisible: ((visible: boolean) => void) | undefined

    function Owner() {
      const value = useBookingPaymentPolling()
      useEffect(() => { controller = value }, [value])
      return null
    }
    function Harness() {
      const [visible, setState] = useState(true)
      setVisible = setState
      return (
        <QueryClientProvider client={client}>
          <BookingPaymentPollingProvider>
            {visible ? <Owner /> : null}
          </BookingPaymentPollingProvider>
        </QueryClientProvider>
      )
    }

    render(<Harness />)
    act(() => controller?.start("bk-1"))
    act(() => setVisible?.(false))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOOKING_PAYMENT_POLL_INTERVAL_MS)
    })

    expect(fetchBooking).toHaveBeenCalledTimes(1)
  })

  it("cancels on provider unmount and never polls past the thirty second deadline", async () => {
    const client = makeClient()
    fetchBooking.mockResolvedValue(booking("awaiting_payment"))
    const { result, unmount } = renderHook(() => useBookingPaymentPolling(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>
          <BookingPaymentPollingProvider>{children}</BookingPaymentPollingProvider>
        </QueryClientProvider>
      ),
    })

    act(() => result.current.start("bk-1"))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOOKING_PAYMENT_POLL_INTERVAL_MS * 15)
    })
    // Fourteen reads at 2..28 seconds; the 30-second deadline refreshes the
    // related queries and cancels the next tick before another detail read.
    expect(fetchBooking).toHaveBeenCalledTimes(14)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOOKING_PAYMENT_POLL_INTERVAL_MS)
    })
    expect(fetchBooking).toHaveBeenCalledTimes(14)

    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOOKING_PAYMENT_POLL_INTERVAL_MS * 2)
    })
    expect(fetchBooking).toHaveBeenCalledTimes(14)
  })

  it("stops immediately when logout unmounts the page polling owner", async () => {
    const client = makeClient()
    fetchBooking.mockResolvedValue(booking("awaiting_payment"))
    const { result, unmount } = renderHook(() => useBookingPaymentPolling(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>
          <BookingPaymentPollingProvider>{children}</BookingPaymentPollingProvider>
        </QueryClientProvider>
      ),
    })

    act(() => result.current.start("bk-1"))
    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOOKING_PAYMENT_POLL_INTERVAL_MS)
    })

    expect(fetchBooking).not.toHaveBeenCalled()
  })

  it("does not write an in-flight booking response after logout unmounts the owner", async () => {
    const client = makeClient()
    let resolveBooking: ((value: ReturnType<typeof booking>) => void) | undefined
    fetchBooking.mockReturnValueOnce(new Promise((resolve) => {
      resolveBooking = resolve
    }))
    const { result, unmount } = renderHook(() => useBookingPaymentPolling(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>
          <BookingPaymentPollingProvider>{children}</BookingPaymentPollingProvider>
        </QueryClientProvider>
      ),
    })

    act(() => result.current.start("bk-1"))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOOKING_PAYMENT_POLL_INTERVAL_MS)
    })
    expect(fetchBooking).toHaveBeenCalledTimes(1)

    unmount()
    await act(async () => {
      resolveBooking?.(booking("confirmed"))
      await Promise.resolve()
    })

    expect(client.getQueryData(["bookings", "detail", "bk-1"])).toBeUndefined()
  })
})
