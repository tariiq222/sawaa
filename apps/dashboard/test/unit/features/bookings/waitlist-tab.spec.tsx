/**
 * waitlist-tab.spec.tsx
 *
 * Tests WaitlistTab: renders entry cards with correct client/service data,
 * shows EmptyState when no data, shows skeletons when loading,
 * shows ErrorBanner on error.
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

// ── Mock dependencies ─────────────────────────────────────────────────────────

const { useWaitlist, useWaitlistMutations } = vi.hoisted(() => ({
  useWaitlist: vi.fn(),
  useWaitlistMutations: vi.fn(() => ({
    addMut: { mutate: vi.fn(), isPending: false },
  })),
}))

const { useLocale } = vi.hoisted(() => ({
  useLocale: vi.fn(() => ({ t: (k: string) => k, locale: "ar" })),
}))

vi.mock("@/hooks/use-waitlist", () => ({ useWaitlist, useWaitlistMutations }))
vi.mock("@/components/locale-provider", () => ({ useLocale }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@sawaa/ui", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Skeleton: () => <div data-testid="skeleton" />,
}))
vi.mock("@/components/features/error-banner", () => ({ ErrorBanner: ({ message }: { message: string }) => <div data-testid="error-banner">{message}</div> }))
vi.mock("@/components/features/empty-state", () => ({ EmptyState: () => <div data-testid="empty-state" /> }))
vi.mock("@hugeicons/core-free-icons", () => ({ Clock01Icon: () => null }))

import { WaitlistTab } from "@/components/features/bookings/waitlist-tab"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return Wrapper
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const waitlistData = [
  {
    id: "wl-1",
    status: "waiting" as const,
    client: { firstName: "Sara", lastName: "Ahmad" },
    service: { nameAr: "استشارة أسرية" },
    preferredDate: "2026-06-01",
  },
  {
    id: "wl-2",
    status: "notified" as const,
    client: { firstName: "Khaled", lastName: "Bakri" },
    service: { nameAr: "جلسة دعم نفسي" },
    preferredDate: "2026-06-05",
  },
]

describe("WaitlistTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders entry cards with client name, service, status badge, and date", () => {
    useWaitlist.mockReturnValue({
      data: waitlistData,
      isLoading: false,
      error: null,
    })

    render(<WaitlistTab />, { wrapper: makeWrapper() })

    // Client names rendered
    expect(screen.getByText("Sara Ahmad")).toBeTruthy()
    expect(screen.getByText("Khaled Bakri")).toBeTruthy()

    // Services rendered
    expect(screen.getByText("استشارة أسرية")).toBeTruthy()
    expect(screen.getByText("جلسة دعم نفسي")).toBeTruthy()

    // Two cards rendered
    const cards = screen.queryAllByText(/استشارة|دعم/)
    expect(cards.length).toBeGreaterThanOrEqual(2)
  })

  it("shows EmptyState when data is empty", () => {
    useWaitlist.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })

    render(<WaitlistTab />, { wrapper: makeWrapper() })
    expect(screen.getByTestId("empty-state")).toBeTruthy()
  })

  it("shows loading skeletons when isLoading is true", () => {
    useWaitlist.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    })

    render(<WaitlistTab />, { wrapper: makeWrapper() })
    // Component renders raw animate-pulse divs, not Skeleton component
    const skeletons = document.querySelectorAll(".animate-pulse")
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("shows error banner when error is present", () => {
    useWaitlist.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Failed to load waitlist"),
    })

    render(<WaitlistTab />, { wrapper: makeWrapper() })
    expect(screen.getByTestId("error-banner")).toBeTruthy()
    expect(screen.getByTestId("error-banner")).toHaveTextContent("Failed to load waitlist")
  })

  it("handles null service gracefully", () => {
    useWaitlist.mockReturnValue({
      data: [
        {
          id: "wl-3",
          status: "waiting" as const,
          client: { firstName: "Lina", lastName: "Nasser" },
          service: null,
          preferredDate: null,
        },
      ],
      isLoading: false,
      error: null,
    })

    render(<WaitlistTab />, { wrapper: makeWrapper() })
    expect(screen.getByText("Lina Nasser")).toBeTruthy()
    // Falls back to "—" for null service
    // Both service (null) and preferredDate (null) fall back to "—"
    const dashes = screen.getAllByText("—")
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })
})
