import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ invoices: vi.fn(), bookings: vi.fn() }))
vi.mock("@/lib/api/invoices", () => ({ fetchInvoices: mocks.invoices }))
vi.mock("@/lib/api/bookings", () => ({ fetchBookings: mocks.bookings }))
import { useClientInvoices, useClientBookingStatistics } from "@/hooks/use-client-records"
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider> }
}
describe("client record panels", () => {
  beforeEach(() => vi.clearAllMocks())
  it("loads real invoices for the resolved client, including later pages", async () => {
    const response = { items: [{ id: "inv-22", number: 22, total: 4950 }], meta: { total: 25 } }
    mocks.invoices.mockResolvedValue(response)
    const { result } = renderHook(() => useClientInvoices("client-uuid", 2), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mocks.invoices).toHaveBeenCalledWith({ clientId: "client-uuid", page: 2, limit: 20 })
    expect(result.current.data).toEqual(response)
  })
  it("uses server totals across every page rather than the returned booking row count", async () => {
    mocks.bookings.mockImplementation(async ({ status }) => ({ items: [{ id: "one-row" }], meta: { total: status === "completed" ? 21 : status === "cancelled" ? 7 : 42 } }))
    const { result } = renderHook(() => useClientBookingStatistics("client-uuid"), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ total: 42, completed: 21, cancelled: 7 })
    expect(mocks.bookings).toHaveBeenCalledTimes(3)
    for (const [query] of mocks.bookings.mock.calls) expect(query.clientId).toBe("client-uuid")
  })
  it("surfaces an invoice failure instead of claiming there are no invoices", async () => {
    mocks.invoices.mockRejectedValue(new Error("unavailable"))
    const { result } = renderHook(() => useClientInvoices("client-uuid", 1), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })
})
