import { renderHook, act, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { exportBookingsCsv } = vi.hoisted(() => ({ exportBookingsCsv: vi.fn() }))
vi.mock("@/lib/api/bookings-export", () => ({ exportBookingsCsv }))
import { useBookingsExport } from "@/hooks/use-bookings-export"

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={new QueryClient({
        defaultOptions: { mutations: { retry: false } },
      })}
    >
      {children}
    </QueryClientProvider>
  )
}

describe("useBookingsExport", () => {
  it("exposes mutation success and forwards the query", async () => {
    exportBookingsCsv.mockResolvedValueOnce({ rowCount: 3, filename: "bookings.csv" })
    const { result } = renderHook(() => useBookingsExport(), { wrapper })
    await act(() => result.current.mutateAsync({ search: "علي" }))
    expect(exportBookingsCsv).toHaveBeenCalledWith({ search: "علي" })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it("exposes mutation errors and pending state", async () => {
    let reject!: (error: Error) => void
    exportBookingsCsv.mockImplementationOnce(() => new Promise((_, r) => { reject = r }))
    const { result } = renderHook(() => useBookingsExport(), { wrapper })
    let promise: Promise<unknown> | undefined
    act(() => { promise = result.current.mutateAsync({}) })
    await waitFor(() => expect(result.current.isPending).toBe(true))
    act(() => reject(new Error("failed")))
    await expect(promise).rejects.toThrow("failed")
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
