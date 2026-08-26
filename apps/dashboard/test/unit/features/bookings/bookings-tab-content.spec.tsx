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

const DEFAULT_TODAY = "2026-08-26"

const { useBookings, useBookingMutations, exportMutateAsync, useBookingsExport } = vi.hoisted(() => {
  // Default filter state mirrors the real hook after BK-TODAY-DEFAULT: today
  // is the baseline so the dashboard opens on the today tab and the very
  // first query is today-scoped (not all-time).
  const buildBookingsReturn = () => ({
    bookings: [],
    stats: null,
    meta: null,
    loading: false,
    statsLoading: false,
    error: null,
    filters: {
      status: "all",
      type: "all",
      delivery: "all",
      isGuest: "all",
      dateFrom: DEFAULT_TODAY,
      dateTo: DEFAULT_TODAY,
      employeeId: "",
      search: "",
    },
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
    hasFilters: false,
    setPage: vi.fn(),
    query: { page: 1, limit: 20, dateFrom: DEFAULT_TODAY, dateTo: DEFAULT_TODAY },
  })
  return {
    useBookings: vi.fn(buildBookingsReturn),
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
  }
})

const { useEmployees } = vi.hoisted(() => ({
  useEmployees: vi.fn(() => ({ employees: [] })),
}))

const { useOrganizationConfig } = vi.hoisted(() => ({
  useOrganizationConfig: vi.fn(() => ({ weekStartDayNumber: 0, dateFormat: "Y-m-d" })),
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
    tabs,
    hasFilters,
    onReset,
    trailing,
  }: {
    selects: Array<{ options: Array<{ value: string }> }>
    search?: { value: string; onChange: (value: string) => void }
    tabs?: { items: Array<{ key: string; label: string }>; activeKey: string; onTabChange: (key: string) => void }
    hasFilters: boolean
    onReset: () => void
    trailing?: ReactNode
  }) => (
    <div data-testid="filter-bar">
      {search && <input aria-label="booking-search" value={search.value} onChange={(e) => search.onChange(e.target.value)} />}
      {trailing}
      {tabs && (
        <div role="tablist">
          {tabs.items.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              type="button"
              data-testid={`tab-${tab.key}`}
              aria-selected={tabs.activeKey === tab.key}
              onClick={() => tabs.onTabChange(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      {hasFilters && (
        <button type="button" data-testid="reset-button" onClick={onReset}>
          common.reset
        </button>
      )}
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
import { clinicMonthRange, clinicWeekRange, todayClinicYmd } from "@/lib/utils"

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

/**
 * Override the default `useBookings()` return for a single test — lets us
 * inject a fresh `setFilters`/`resetFilters` spy and toggle `hasFilters` to
 * cover specific UI branches (e.g. reset-button visibility).
 */
function withBookings(overrides: Record<string, unknown>) {
  useBookings.mockImplementation(() => ({
    bookings: [],
    stats: null,
    meta: null,
    loading: false,
    statsLoading: false,
    error: null,
    filters: {
      status: "all",
      type: "all",
      delivery: "all",
      isGuest: "all",
      dateFrom: DEFAULT_TODAY,
      dateTo: DEFAULT_TODAY,
      employeeId: "",
      search: "",
    },
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
    hasFilters: false,
    setPage: vi.fn(),
    query: { page: 1, limit: 20, dateFrom: DEFAULT_TODAY, dateTo: DEFAULT_TODAY },
    ...overrides,
  }))
}

describe("BookingsTabContent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    withBookings({})
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
      page: 1,
      limit: 20,
      dateFrom: "2026-08-26",
      dateTo: "2026-08-26",
      search: "new search",
    }))
  })

  it("disables the export button and shows the translated pending label", () => {
    useBookingsExport.mockReturnValue({ mutateAsync: exportMutateAsync, isPending: true })
    render(<BookingsTabContent onRowClick={vi.fn()} />, { wrapper: makeWrapper() })
    const button = screen.getByRole("button", { name: "bookings.export.exporting" })
    expect(button).toBeDisabled()
  })

  // ─── BK-TODAY-DEFAULT: today tab default + clinic-local date ranges ──────

  it("opens with the today tab selected (not all)", () => {
    render(<BookingsTabContent onRowClick={vi.fn()} />, { wrapper: makeWrapper() })

    const todayTab = screen.getByTestId("tab-today")
    const allTab = screen.getByTestId("tab-all")
    expect(todayTab.getAttribute("aria-selected")).toBe("true")
    expect(allTab.getAttribute("aria-selected")).toBe("false")
  })

  it("does not show the reset button on first paint (today is the baseline)", () => {
    render(<BookingsTabContent onRowClick={vi.fn()} />, { wrapper: makeWrapper() })

    expect(screen.queryByTestId("reset-button")).toBeNull()
  })

  it("clicking «الكل» (all) clears dateFrom and dateTo (all-time)", () => {
    const setFilters = vi.fn()
    withBookings({ setFilters })
    render(<BookingsTabContent onRowClick={vi.fn()} />, { wrapper: makeWrapper() })

    fireEvent.click(screen.getByTestId("tab-all"))

    expect(setFilters).toHaveBeenCalledWith({ dateFrom: "", dateTo: "" })
  })

  it("clicking the today tab sets dateFrom and dateTo to today's clinic ymd (Asia/Riyadh, not UTC)", () => {
    const setFilters = vi.fn()
    withBookings({ setFilters })
    render(<BookingsTabContent onRowClick={vi.fn()} />, { wrapper: makeWrapper() })

    fireEvent.click(screen.getByTestId("tab-today"))

    const today = todayClinicYmd()
    expect(setFilters).toHaveBeenCalledWith({ dateFrom: today, dateTo: today })
  })

  it("clicking the week tab sets a clinic-local week range (not UTC getDay())", () => {
    const setFilters = vi.fn()
    withBookings({ setFilters })
    render(<BookingsTabContent onRowClick={vi.fn()} />, { wrapper: makeWrapper() })

    fireEvent.click(screen.getByTestId("tab-week"))

    const expected = clinicWeekRange(0)
    expect(setFilters).toHaveBeenCalledWith({
      dateFrom: expected.dateFrom,
      dateTo: expected.dateTo,
    })
  })

  it("clicking the month tab sets a clinic-local calendar month range", () => {
    const setFilters = vi.fn()
    withBookings({ setFilters })
    render(<BookingsTabContent onRowClick={vi.fn()} />, { wrapper: makeWrapper() })

    fireEvent.click(screen.getByTestId("tab-month"))

    const expected = clinicMonthRange()
    expect(setFilters).toHaveBeenCalledWith({
      dateFrom: expected.dateFrom,
      dateTo: expected.dateTo,
    })
  })

  it("reset restores the today tab (not all) and clears the local search", () => {
    const resetFilters = vi.fn()
    withBookings({ resetFilters, hasFilters: true })
    render(<BookingsTabContent onRowClick={vi.fn()} />, { wrapper: makeWrapper() })

    // User first clicked "all", so the tab moved off "today".
    fireEvent.click(screen.getByTestId("tab-all"))
    expect(screen.getByTestId("tab-all").getAttribute("aria-selected")).toBe("true")

    fireEvent.click(screen.getByTestId("reset-button"))

    expect(resetFilters).toHaveBeenCalledTimes(1)
    // Reset must put the tab back on "today", not "all" (all-time).
    expect(screen.getByTestId("tab-today").getAttribute("aria-selected")).toBe("true")
    expect(screen.getByTestId("tab-all").getAttribute("aria-selected")).toBe("false")
  })
})
