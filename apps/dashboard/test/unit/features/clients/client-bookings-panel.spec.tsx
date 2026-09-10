import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { fetchBookings } = vi.hoisted(() => ({ fetchBookings: vi.fn() }))
vi.mock("@/lib/api/bookings", () => ({ fetchBookings }))
vi.mock("@/components/features/status-badge", () => ({ StatusBadge: () => <span /> }))
vi.mock("@sawaa/ui", () => ({ Skeleton: () => <div data-testid="skeleton" />, Button: (p: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...p} /> }))

import { ClientBookingsPanel } from "@/components/features/clients/client-bookings-panel"

describe("ClientBookingsPanel", () => {
  beforeEach(() => vi.clearAllMocks())

  it("can page beyond the first 20 booking-history rows", async () => {
    fetchBookings.mockImplementation(({ page }: { page: number }) => Promise.resolve({
      items: [{ id: `b-${page}`, serviceId: "s", date: "2026-01-01", startTime: "10:00", status: "CONFIRMED" }],
      meta: { total: 21, page, limit: 20, totalPages: 2, hasPreviousPage: page > 1, hasNextPage: page < 2 },
    }))
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><ClientBookingsPanel clientId="c-1" t={(k) => k} formatDate={(d) => d} /></QueryClientProvider>)

    fireEvent.click(await screen.findByRole("button", { name: "table.next" }))
    await waitFor(() => expect(fetchBookings).toHaveBeenCalledWith({ page: 2, limit: 20, clientId: "c-1" }))
  })

  it("shows a retryable error instead of an empty booking history", async () => {
    fetchBookings.mockRejectedValue(new Error("network unavailable"))
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><ClientBookingsPanel clientId="c-1" t={(k) => k} formatDate={(d) => d} /></QueryClientProvider>)

    expect(await screen.findByRole("alert")).toHaveTextContent("error.server")
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }))
    await waitFor(() => expect(fetchBookings).toHaveBeenCalledTimes(2))
  })
})
