/**
 * bookings-tab-content.spec.tsx
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ButtonHTMLAttributes, ReactNode } from "react"

const { useQueryClient } = vi.hoisted(() => ({
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}))

// ── Mock all dependencies ─────────────────────────────────────────────────────

const { useBookings, useBookingMutations, exportMutateAsync, useBookingsExport } = vi.hoisted(() => ({
  useBookings: vi.fn(() => ({
    bookings: [],
    stats: null,
    meta: null,
    loading: false,
    statsLoading: false,
    error: null,
    filters: { type: "all" },
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
    hasFilters: false,
    setPage: vi.fn(),
    query: { page: 2, limit: 20, status: "confirmed", dateFrom: "2026-08-01" },
  })),
  useBookingMutations: vi.fn(() => ({
    confirmMut: { mutateAsync: vi.fn(), isPending: false },
    noShowMut: { mutateAsync: vi.fn(), isPending: false },
    checkInMut: { mutateAsync: vi.fn(), isPending: false },
    completeMut: { mutateAsync: vi.fn(), isPending: false },
    adminCancelMut: { mutateAsync: vi.fn(), isPending: false },
    deleteMut: { mutateAsync: vi.fn(), isPending: false },
  })),
  exportMutateAsync: vi.fn(),
  useBookingsExport: vi.fn(() => ({ mutateAsync: exportMutateAsync, isPending: false })),
}))

const { useEmployees } = vi.hoisted(() => ({
  useEmployees: vi.fn(() => ({ employees: [] })),
}))

const { useOrganizationConfig } = vi.hoisted(() => ({
  useOrganizationConfig: vi.fn(() => ({ weekStartDayNumber: 0 })),
}))

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>()
  return {
    ...actual,
    QueryClient: actual.QueryClient,
    QueryClientProvider: actual.QueryClientProvider,
    useQueryClient,
  }
})

const { useLocale } = vi.hoisted(() => ({
  useLocale: vi.fn(() => ({ t: (k: string) => k, locale: "ar" })),
}))

vi.mock("@/hooks/use-bookings", () => ({ useBookings, useBookingMutations }))
vi.mock("@/hooks/use-bookings-export", () => ({ useBookingsExport }))
vi.mock("@/hooks/use-employees", () => ({ useEmployees }))
vi.mock("@/hooks/use-organization-config", () => ({ useOrganizationConfig }))
vi.mock("@/lib/api/bookings", () => ({}))
vi.mock("@/lib/mutation-helpers", () => ({ showApiError: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }))
vi.mock("@/components/features/data-table", () => ({
  DataTable: ({ emptyTitle }: { emptyTitle: string }) => (
    <div data-testid="data-table">{emptyTitle}</div>
  ),
}))
vi.mock("@/components/features/filter-bar", () => ({
  FilterBar: ({
    selects,
    search,
    trailing,
  }: {
    selects: Array<{ options: Array<{ value: string }> }>
    search?: { value: string; onChange: (value: string) => void }
    trailing?: ReactNode
  }) => (
    <div data-testid="filter-bar">
      {search && <input aria-label="booking-search" value={search.value} onChange={(e) => search.onChange(e.target.value)} />}
      {trailing}
      {selects?.map((s, i) =>
        s.options.map((o) => (
          <span key={`${i}-${o.value}`} data-testid={`option-${o.value}`} />
        ))
      )}
    </div>
  ),
}))
vi.mock("@/components/features/error-banner", () => ({
  ErrorBanner: () => null,
}))
vi.mock("@sawaa/ui", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))
vi.mock("@/components/features/bookings/booking-columns", () => ({
  getBookingColumns: vi.fn(() => []),
}))
vi.mock("@/components/features/bookings/cancel-dialogs", () => ({
  AdminCancelDialog: () => null,
}))
vi.mock("@/components/features/bookings/delete-booking-dialog", () => ({
  DeleteBookingDialog: () => null,
}))
vi.mock("@/components/locale-provider", () => ({ useLocale }))

import { BookingsTabContent } from "@/components/features/bookings/bookings-tab-content"

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
  return Wrapper
}

describe("BookingsTabContent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("includes walk_in filter option", () => {
    render(<BookingsTabContent onRowClick={vi.fn()} />, {
      wrapper: makeWrapper(),
    })

    expect(screen.getByTestId("option-walk_in")).toBeTruthy()
  })

  it("exports current filters with the immediate local search value", async () => {
    exportMutateAsync.mockResolvedValueOnce({ rowCount: 1, filename: "bookings.csv" })
    render(<BookingsTabContent onRowClick={vi.fn()} />, { wrapper: makeWrapper() })
    fireEvent.change(screen.getByLabelText("booking-search"), { target: { value: "new search" } })
    fireEvent.click(screen.getByRole("button", { name: "bookings.export.csv" }))

    await waitFor(() => expect(exportMutateAsync).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      status: "confirmed",
      dateFrom: "2026-08-01",
      search: "new search",
    }))
  })

  it("disables the export button and shows the translated pending label", () => {
    useBookingsExport.mockReturnValue({ mutateAsync: exportMutateAsync, isPending: true })
    render(<BookingsTabContent onRowClick={vi.fn()} />, { wrapper: makeWrapper() })
    const button = screen.getByRole("button", { name: "bookings.export.exporting" })
    expect(button).toBeDisabled()
  })
})
