/**
 * bookings-tab-content.spec.tsx
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

const { useQueryClient } = vi.hoisted(() => ({
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}))

// ── Mock all dependencies ─────────────────────────────────────────────────────

const { useBookings, useBookingMutations } = vi.hoisted(() => ({
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
  })),
  useBookingMutations: vi.fn(() => ({
    confirmMut: { mutateAsync: vi.fn(), isPending: false },
    noShowMut: { mutateAsync: vi.fn(), isPending: false },
    adminCancelMut: { mutateAsync: vi.fn(), isPending: false },
    deleteMut: { mutateAsync: vi.fn(), isPending: false },
  })),
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
vi.mock("@/hooks/use-employees", () => ({ useEmployees }))
vi.mock("@/hooks/use-organization-config", () => ({ useOrganizationConfig }))
vi.mock("@/lib/api/bookings", () => ({}))
vi.mock("@/components/features/data-table", () => ({
  DataTable: ({ emptyTitle }: { emptyTitle: string }) => (
    <div data-testid="data-table">{emptyTitle}</div>
  ),
}))
vi.mock("@/components/features/filter-bar", () => ({
  FilterBar: ({
    selects,
  }: {
    selects: Array<{ options: Array<{ value: string }> }>
  }) => (
    <div data-testid="filter-bar">
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
    render(<BookingsTabContent onRowClick={vi.fn()} onEditClick={vi.fn()} />, {
      wrapper: makeWrapper(),
    })

    expect(screen.getByTestId("option-walk_in")).toBeTruthy()
  })
})
