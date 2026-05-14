/**
 * waitlist-tab.spec.tsx
 */

import { render } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

// ── Mock dependencies ─────────────────────────────────────────────────────────

const mockEntries: unknown[] = []

const { useWaitlist, useWaitlistMutations } = vi.hoisted(() => ({
  useWaitlist: vi.fn(() => ({
    entries: mockEntries,
    isLoading: false,
    error: null,
    status: undefined,
    setStatus: vi.fn(),
    resetFilters: vi.fn(),
    refetch: vi.fn(),
  })),
  useWaitlistMutations: vi.fn(() => ({
    removeMut: { mutate: vi.fn(), isPending: false },
  })),
}))

const { useLocale } = vi.hoisted(() => ({
  useLocale: vi.fn(() => ({ t: (k: string) => k, locale: "ar" })),
}))

vi.mock("@/hooks/use-waitlist", () => ({ useWaitlist, useWaitlistMutations }))
vi.mock("@/components/locale-provider", () => ({ useLocale }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@deqah/ui", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Skeleton: () => <div data-testid="skeleton" />,
}))
vi.mock("@/components/features/error-banner", () => ({ ErrorBanner: () => null }))
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

describe("WaitlistTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders normally", () => {
    useWaitlist.mockReturnValue({
      entries: [],
      isLoading: false,
      error: null,
      status: undefined,
      setStatus: vi.fn(),
      resetFilters: vi.fn(),
      refetch: vi.fn(),
    })

    const { container } = render(<WaitlistTab />, { wrapper: makeWrapper() })
    expect(container.firstChild).not.toBeNull()
  })
})
