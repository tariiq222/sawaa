import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  booking: undefined as undefined | { payAtClinicEnabled: boolean },
  orgEnabled: true,
  mutateBooking: vi.fn(),
  mutatePayment: vi.fn(),
}))
vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ t: (key: string) => key }) }))
vi.mock("@/hooks/use-organization-settings", () => ({
  useBookingSettings: () => ({ data: state.booking }),
  useBookingSettingsMutation: () => ({ mutate: state.mutateBooking, isPending: false }),
  usePaymentSettings: () => ({ data: { paymentAtClinicEnabled: state.orgEnabled }, isLoading: false }),
  usePaymentSettingsMutation: () => ({ mutate: state.mutatePayment, isPending: false }),
}))
vi.mock("@/hooks/use-moyasar-config", () => ({
  useMoyasarConfig: () => ({ data: null, isLoading: false }),
  useTestMoyasarConfig: () => ({ mutate: vi.fn(), isPending: false }),
  useUpsertMoyasarConfig: () => ({ mutate: vi.fn(), isPending: false }),
}))
import { SettingsPaymentTab } from "@/components/features/settings/settings-payment-tab"

function openCenterSettings() {
  render(<SettingsPaymentTab />)
  fireEvent.click(screen.getByRole("tab", { name: "settings.booking.paymentMethods.atClinic" }))
}
describe("client pay-at-center settings", () => {
  beforeEach(() => { state.booking = undefined; state.orgEnabled = true; vi.clearAllMocks() })
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
