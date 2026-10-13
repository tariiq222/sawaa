import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ permissions: [] as string[], query: "", replace: vi.fn() }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings", useRouter: () => ({ replace: state.replace }),
  useSearchParams: () => new URLSearchParams(state.query),
}))
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ canDo: (module: string, action: string) => state.permissions.includes(`${module}:${action}`) }) }))
vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ t: (key: string) => key }) }))
vi.mock("@/components/features/list-page-shell", () => ({ ListPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock("@/components/features/breadcrumbs", () => ({ Breadcrumbs: () => null }))
vi.mock("@/components/features/page-header", () => ({ PageHeader: () => null }))
vi.mock("@/components/features/settings/general-tab", () => ({ GeneralTab: () => <div>general-panel</div> }))
vi.mock("@/components/features/settings/booking-tab", () => ({ BookingTab: () => null }))
vi.mock("@/components/features/settings/cancellation-tab", () => ({ CancellationTab: () => null }))
vi.mock("@/components/features/settings/working-hours-tab", () => ({ WorkingHoursTab: () => null }))
vi.mock("@/components/features/settings/settings-payment-tab", () => ({ SettingsPaymentTab: () => <div>payment-panel</div> }))
vi.mock("@/components/features/settings/settings-integrations-tab", () => ({ SettingsIntegrationsTab: () => <div>integrations-panel</div> }))
vi.mock("@/components/features/settings/sawaa-ai-settings-content", () => ({ SawaaAiSettingsContent: () => <div>ai-panel</div> }))
vi.mock("@/components/features/settings/email-templates-tab", () => ({ EmailTemplatesTab: () => null }))
vi.mock("@/components/features/settings/mobile-home-cards-tab", () => ({ MobileHomeCardsTab: () => null }))
vi.mock("@/components/features/settings/discount-reasons-manager", () => ({ DiscountReasonsManager: () => null }))
import SettingsPage from "@/app/(dashboard)/settings/page"

describe("Settings page subject routing", () => {
  beforeEach(() => { state.permissions = []; state.query = ""; vi.clearAllMocks() })
  it.each(["setting:read", "providerconfig:read"])("allows the payment tab for %s", (permission) => {
    state.permissions = [permission]; state.query = "tab=payment"
    render(<SettingsPage />)
    expect(screen.getByRole("tab", { name: "settings.tabs.payment" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("payment-panel")).toBeInTheDocument()
  })
  it("shows only content tabs for a Content reader", () => {
    state.permissions = ["content:read"]
    render(<SettingsPage />)
    expect(screen.getByRole("tab", { name: "sawaaAi.menuLabel" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("ai-panel")).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "settings.tabs.payment" })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "settings.tabs.general" })).not.toBeInTheDocument()
  })
  it("rejects unauthorized requested tabs and keeps the first allowed panel", () => {
    state.permissions = ["content:read"]; state.query = "tab=payment"
    render(<SettingsPage />)
    expect(screen.getByText("ai-panel")).toBeInTheDocument()
    expect(screen.queryByText("payment-panel")).not.toBeInTheDocument()
    expect(state.replace).toHaveBeenCalledWith("/settings", { scroll: false })
  })
  it("denies users with none of the settings subjects", () => {
    render(<SettingsPage />)
    expect(screen.getByText("common.noPermission")).toBeInTheDocument()
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
  })
})
