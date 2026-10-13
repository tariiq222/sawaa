import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  booking: undefined as undefined | { payAtClinicEnabled: boolean },
  orgEnabled: true,
  paymentSettings: { paymentAtClinicEnabled: true, bankTransferAccounts: [] },
  moyasarConfig: { publishableKey: "pk_test_placeholder", secretKeyMasked: "masked", hasWebhookSecret: true, isLive: false },
  permissions: ["setting:read", "setting:update", "providerconfig:read", "providerconfig:manage"],
  settingsReads: vi.fn(),
  providerReads: vi.fn(),
  testProvider: vi.fn(),
  saveProvider: vi.fn(),
  mutateBooking: vi.fn(),
  mutatePayment: vi.fn(),
}))
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ canDo: (module: string, action: string) => state.permissions.includes(`${module}:${action}`) }) }))
vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ t: (key: string) => key }) }))
vi.mock("@/hooks/use-organization-settings", () => ({
  useBookingSettings: () => ({ data: state.booking }),
  useBookingSettingsMutation: () => ({ mutate: state.mutateBooking, isPending: false }),
  usePaymentSettings: () => { state.settingsReads(); state.paymentSettings.paymentAtClinicEnabled = state.orgEnabled; return { data: state.paymentSettings, isLoading: false } },
  usePaymentSettingsMutation: () => ({ mutate: state.mutatePayment, isPending: false }),
}))
vi.mock("@/hooks/use-moyasar-config", () => ({
  useMoyasarConfig: () => { state.providerReads(); return { data: state.moyasarConfig, isLoading: false } },
  useTestMoyasarConfig: () => ({ mutate: state.testProvider, isPending: false }),
  useUpsertMoyasarConfig: () => ({ mutate: state.saveProvider, isPending: false }),
}))
import { SettingsPaymentTab } from "@/components/features/settings/settings-payment-tab"

function openCenterSettings() {
  render(<SettingsPaymentTab />)
  fireEvent.click(screen.getByRole("tab", { name: "settings.booking.paymentMethods.atClinic" }))
}
describe("client pay-at-center settings", () => {
  beforeEach(() => { state.booking = undefined; state.orgEnabled = true; state.permissions = ["setting:read", "setting:update", "providerconfig:read", "providerconfig:manage"]; vi.clearAllMocks() })
  it("loads only Moyasar configuration for ProviderConfig-only readers", () => {
    state.permissions = ["providerconfig:read"];
    render(<SettingsPaymentTab />)
    expect(screen.getByText("settings.moyasarKey")).toBeInTheDocument()
    expect(state.settingsReads).not.toHaveBeenCalled()
    expect(state.providerReads).toHaveBeenCalled()
    expect(screen.queryByRole("tab", { name: "settings.booking.paymentMethods.atClinic" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("settings.moyasarKey")).toBeDisabled()
    expect(screen.getByLabelText("settings.moyasarSecret")).toBeDisabled()
    expect(screen.getByLabelText("settings.moyasar.webhookSecret")).toBeDisabled()
    expect(screen.getByRole("button", { name: "settings.save" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "settings.moyasar.test" })).toBeDisabled()
  })
  it("loads payment preferences without provider configuration for Setting-only readers", () => {
    state.permissions = ["setting:read"];
    render(<SettingsPaymentTab />)
    expect(state.providerReads).not.toHaveBeenCalled()
    expect(state.settingsReads).toHaveBeenCalled()
    expect(screen.queryByText("settings.moyasarKey")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "settings.booking.paymentMethods.atClinic" }))
    expect(screen.getByRole("switch", { name: "settings.payment.clientAtClinic.title" })).toBeDisabled()
    fireEvent.click(screen.getByRole("tab", { name: "settings.payment.bankTransfer.title" }))
    expect(screen.getByRole("button", { name: "settings.payment.bankTransfer.addAccount" })).toBeDisabled()
    expect(state.mutatePayment).not.toHaveBeenCalled()
  })
  it("lets provider managers configure Moyasar without Setting write permission", () => {
    state.permissions = ["providerconfig:read", "providerconfig:manage"];
    render(<SettingsPaymentTab />)
    expect(screen.getByRole("button", { name: "settings.save" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "settings.save" }))
    expect(state.saveProvider).toHaveBeenCalled()
    expect(state.settingsReads).not.toHaveBeenCalled()
    expect(state.mutatePayment).not.toHaveBeenCalled()
  })
  it("keeps provider credentials read-only while a Setting writer changes payment preferences", () => {
    state.permissions = ["setting:read", "setting:update", "providerconfig:read"];
    render(<SettingsPaymentTab />)
    expect(screen.getByRole("button", { name: "settings.save" })).toBeDisabled()
    fireEvent.click(screen.getByRole("switch", { name: "settings.booking.paymentMethods.moyasar" }))
    expect(state.mutatePayment).toHaveBeenCalledWith({ paymentMoyasarEnabled: true }, expect.any(Object))
    expect(state.saveProvider).not.toHaveBeenCalled(); expect(state.testProvider).not.toHaveBeenCalled()
  })
  it("keeps Setting preferences read-only for a provider manager with only Setting read", () => {
    state.permissions = ["setting:read", "providerconfig:read", "providerconfig:manage"];
    render(<SettingsPaymentTab />)
    expect(screen.getByRole("switch", { name: "settings.booking.paymentMethods.moyasar" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "settings.save" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "settings.save" }))
    expect(state.saveProvider).toHaveBeenCalled(); expect(state.mutatePayment).not.toHaveBeenCalled()
  })

  it("preserves all-or-none credential rotation for an authorized provider manager", () => {
    state.permissions = ["providerconfig:read", "providerconfig:manage"];
    render(<SettingsPaymentTab />)
    fireEvent.change(screen.getByLabelText("settings.moyasarKey"), { target: { value: "pk_test_new" } })
    fireEvent.click(screen.getByRole("button", { name: "settings.save" }))
    expect(state.saveProvider).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText("settings.moyasarSecret"), { target: { value: "sk_test_new" } })
    fireEvent.change(screen.getByLabelText("settings.moyasar.webhookSecret"), { target: { value: "whsec_test_new" } })
    fireEvent.click(screen.getByRole("button", { name: "settings.save" }))
    expect(state.saveProvider).toHaveBeenCalledWith({ publishableKey: "pk_test_new", secretKey: "sk_test_new", webhookSecret: "whsec_test_new", isLive: false }, expect.any(Object))
    expect(state.settingsReads).not.toHaveBeenCalled()
  })

  it("mounts neither settings nor provider reads for unrelated Content-only roles", () => {
    state.permissions = ["content:read"];
    render(<SettingsPaymentTab />)
    expect(state.settingsReads).not.toHaveBeenCalled(); expect(state.providerReads).not.toHaveBeenCalled()
    expect(screen.queryByText("settings.moyasarKey")).not.toBeInTheDocument()
  })

  it("requires explicit opt-in before showing the client switch enabled", () => {
    openCenterSettings()
    expect(screen.getByRole("switch", { name: "settings.payment.clientAtClinic.title" })).not.toBeChecked()
  })
  it.each([false, true])("shows effective client availability when the client switch is %s", (enabled) => {
    state.booking = { payAtClinicEnabled: enabled }
    openCenterSettings()
    expect(screen.getByText(enabled ? "settings.payment.atClinicClientOn" : "settings.payment.atClinicClientOff")).toBeInTheDocument()
  })
  it("shows clients unavailable when organization collection is disabled", () => {
    state.booking = { payAtClinicEnabled: true }; state.orgEnabled = false
    openCenterSettings()
    expect(screen.getByText("settings.payment.atClinicClientOff")).toBeInTheDocument()
  })
  it("changes only the client booking setting", () => {
    state.booking = { payAtClinicEnabled: false }
    openCenterSettings()
    fireEvent.click(screen.getByRole("switch", { name: "settings.payment.clientAtClinic.title" }))
    expect(state.mutateBooking).toHaveBeenCalledWith({ payAtClinicEnabled: true }, expect.any(Object))
    expect(state.mutatePayment).not.toHaveBeenCalled()
  })
})
