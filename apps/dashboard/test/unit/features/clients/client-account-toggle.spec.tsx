/**
 * client-account-toggle.spec.tsx
 *
 * Tests for ClientAccountToggle:
 * - renders "Active" badge + "Disable account" button when client is active
 * - renders "Disabled" badge + "Re-enable account" button when client is disabled
 * - opens confirm dialog on button click
 * - submits mutation with { isActive: false, reason } when disabling
 * - submits mutation with { isActive: true } when enabling
 * - hides entirely for walk-in clients (no password / accountType WALK_IN)
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

// ── Hoist mocks ────────────────────────────────────────────────────────────────

const mutateFn = vi.hoisted(() => vi.fn())

const { useSetClientActiveWithToast } = vi.hoisted(() => ({
  useSetClientActiveWithToast: vi.fn(),
}))

vi.mock("@/hooks/use-set-client-active", () => ({
  useSetClientActiveWithToast,
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => key,
    locale: "ar",
  }),
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  W.displayName = "TestWrapper"
  return W
}

import type { Client } from "@/lib/types/client"

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "c-1",
    firstName: "Ahmed",
    lastName: "Ali",
    email: "a@b.com",
    phone: null,
    gender: null,
    isActive: true,
    emailVerified: false,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    accountType: "FULL",
    ...overrides,
  }
}

// ── Import after mocks ─────────────────────────────────────────────────────────

import { ClientAccountToggle } from "@/components/features/clients/client-account-toggle"

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("ClientAccountToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSetClientActiveWithToast.mockReturnValue({
      mutate: mutateFn,
      isPending: false,
    })
  })

  it("renders active badge and Disable button for active FULL account", () => {
    render(<ClientAccountToggle client={makeClient({ isActive: true })} />, {
      wrapper: makeWrapper(),
    })

    expect(screen.getByText("clients.account.active")).toBeInTheDocument()
    expect(screen.getByText("clients.account.disableButton")).toBeInTheDocument()
  })

  it("renders disabled badge and Re-enable button for inactive FULL account", () => {
    render(<ClientAccountToggle client={makeClient({ isActive: false })} />, {
      wrapper: makeWrapper(),
    })

    expect(screen.getByText("clients.account.disabled")).toBeInTheDocument()
    expect(screen.getByText("clients.account.enableButton")).toBeInTheDocument()
  })

  it("opens confirm dialog when toggle button is clicked", async () => {
    render(<ClientAccountToggle client={makeClient({ isActive: true })} />, {
      wrapper: makeWrapper(),
    })

    fireEvent.click(screen.getByText("clients.account.disableButton"))

    await waitFor(() => {
      expect(screen.getByText("clients.account.disableTitle")).toBeInTheDocument()
    })
  })

  it("submits mutation with isActive=false and reason when disabling", async () => {
    render(<ClientAccountToggle client={makeClient({ isActive: true })} />, {
      wrapper: makeWrapper(),
    })

    // Open dialog
    fireEvent.click(screen.getByText("clients.account.disableButton"))

    await waitFor(() => {
      expect(screen.getByLabelText("clients.account.reason")).toBeInTheDocument()
    })

    // Fill reason
    fireEvent.change(screen.getByLabelText("clients.account.reason"), {
      target: { value: "reason text" },
    })

    // Confirm — click the Disable button inside the dialog footer
    const buttons = screen.getAllByText("clients.account.disableButton")
    // Last one is inside the dialog footer
    fireEvent.click(buttons[buttons.length - 1])

    expect(mutateFn).toHaveBeenCalledWith(
      { isActive: false, reason: "reason text" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it("submits mutation with isActive=true when enabling (no reason field)", async () => {
    render(<ClientAccountToggle client={makeClient({ isActive: false })} />, {
      wrapper: makeWrapper(),
    })

    fireEvent.click(screen.getByText("clients.account.enableButton"))

    await waitFor(() => {
      expect(screen.getByText("clients.account.enableTitle")).toBeInTheDocument()
    })

    expect(screen.queryByLabelText("clients.account.reason")).not.toBeInTheDocument()

    const buttons = screen.getAllByText("clients.account.enableButton")
    fireEvent.click(buttons[buttons.length - 1])

    expect(mutateFn).toHaveBeenCalledWith(
      { isActive: true, reason: undefined },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it("renders nothing for WALK_IN clients (no password)", () => {
    const { container } = render(
      <ClientAccountToggle client={makeClient({ accountType: "WALK_IN" })} />,
      { wrapper: makeWrapper() },
    )

    expect(container.firstChild).toBeNull()
  })

  it("renders nothing for walk_in (lowercase) clients", () => {
    const { container } = render(
      <ClientAccountToggle
        client={makeClient({ accountType: "walk_in" })}
      />,
      { wrapper: makeWrapper() },
    )

    expect(container.firstChild).toBeNull()
  })
})
