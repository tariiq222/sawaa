/**
 * client-detail-page.spec.tsx
 *
 * Tests for the email verification badge on ClientDetailPage:
 * - unverified email (emailVerified false) shows the «غير مؤكد» badge
 * - verified email shows no badge
 * - client without an email shows neither email nor badge
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const { useClient } = vi.hoisted(() => ({ useClient: vi.fn() }))

vi.mock("@/hooks/use-clients", () => ({ useClient }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/hooks/use-organization-config", () => ({
  useOrganizationConfig: () => ({ formatDate: (d: string) => d }),
}))
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ canDo: () => false }),
}))
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key, locale: "ar" }),
}))
vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    status?: number
  },
}))

// Heavy children — stubbed, out of scope for this spec
vi.mock("@/components/features/list-page-shell", () => ({
  ListPageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock("@/components/features/breadcrumbs", () => ({
  Breadcrumbs: () => <nav />,
}))
vi.mock("@/components/features/error-banner", () => ({
  ErrorBanner: () => <div role="alert" />,
}))
vi.mock("@/components/features/status-badge", () => ({
  ActiveBadge: () => <span />,
}))
vi.mock("@/components/features/clients/client-page-skeleton", () => ({
  ClientPageSkeleton: () => <div />,
}))
vi.mock("@/components/features/clients/delete-client-dialog", () => ({
  DeleteClientDialog: () => null,
}))
vi.mock("@/components/features/clients/client-account-toggle", () => ({
  ClientAccountToggle: () => null,
}))
vi.mock("@/components/features/clients/client-bookings-panel", () => ({
  ClientBookingsPanel: () => null,
}))
vi.mock("@/components/features/clients/client-invoices-panel", () => ({
  ClientInvoicesPanel: () => null,
}))
vi.mock("@/components/features/clients/client-package-balances-panel", () => ({
  ClientPackageBalancesPanel: () => null,
}))
vi.mock("@/components/features/clients/sell-package-dialog", () => ({
  SellPackageDialog: () => null,
}))

import { ClientDetailPage } from "@/components/features/clients/client-detail-page"
import type { Client } from "@/lib/types/client"

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "c-1",
    ref: 1,
    email: "sara@example.com",
    firstName: "Sara",
    lastName: "Al-Harbi",
    phone: "+966501234567",
    gender: "female",
    isActive: true,
    emailVerified: false,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-02",
    ...overrides,
  }
}

function renderPage(client: Client | null) {
  useClient.mockReturnValue({
    data: client,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  W.displayName = "TestWrapper"
  return render(<W><ClientDetailPage clientId="c-1" /></W>)
}

const BADGE_KEY = "clients.detail.emailUnverified"

beforeEach(() => vi.clearAllMocks())

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("ClientDetailPage — email verification badge", () => {
  it("shows the unverified badge next to the email when emailVerified is false", () => {
    renderPage(makeClient({ emailVerified: false }))
    expect(screen.getByText(BADGE_KEY)).toBeInTheDocument()
  })

  it("shows no badge when the email is verified", () => {
    renderPage(makeClient({ emailVerified: true }))
    expect(screen.queryByText(BADGE_KEY)).not.toBeInTheDocument()
    expect(screen.getAllByText("sara@example.com").length).toBeGreaterThan(0)
  })

  it("shows nothing new when the client has no email", () => {
    renderPage(makeClient({ email: null, emailVerified: false }))
    expect(screen.queryByText(BADGE_KEY)).not.toBeInTheDocument()
    expect(screen.queryByText("sara@example.com")).not.toBeInTheDocument()
  })
})
