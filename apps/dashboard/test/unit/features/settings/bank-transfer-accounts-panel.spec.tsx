import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mutate, settings } = vi.hoisted(() => ({
  mutate: vi.fn(),
  settings: {
    paymentBankTransferEnabled: false,
    bankTransferAccounts: [],
  },
}))

vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ t: (key: string) => key }) }))
vi.mock("@/hooks/use-organization-settings", () => ({
  usePaymentSettings: () => ({ data: settings, isLoading: false }),
  usePaymentSettingsMutation: () => ({ mutate, isPending: false }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { BankTransferAccountsPanel } from "@/components/features/settings/bank-transfer-accounts-panel"

describe("BankTransferAccountsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settings.paymentBankTransferEnabled = false
    settings.bankTransferAccounts = []
  })

  it("requires a complete valid bank account before enabling transfer", () => {
    render(<BankTransferAccountsPanel />)
    expect(screen.getByRole("switch")).toBeDisabled()
    expect(screen.getByRole("button", { name: "settings.payment.bankTransfer.save" })).toBeEnabled()
  })

  it("saves configured accounts and the client-visible enable setting", () => {
    render(<BankTransferAccountsPanel />)
    fireEvent.click(screen.getByRole("button", { name: "settings.payment.bankTransfer.addAccount" }))
    fireEvent.change(screen.getByLabelText("settings.payment.bankTransfer.label"), { target: { value: "Main" } })
    fireEvent.change(screen.getByLabelText("settings.payment.bankTransfer.bankName"), { target: { value: "Sawa Bank" } })
    fireEvent.change(screen.getByLabelText("settings.payment.bankTransfer.beneficiaryName"), { target: { value: "Sawa Center" } })
    fireEvent.change(screen.getByLabelText("settings.payment.bankTransfer.iban"), { target: { value: "SA03 8000 0000 6080 1016 7519" } })
    fireEvent.click(screen.getByRole("switch"))
    fireEvent.click(screen.getByRole("button", { name: "settings.payment.bankTransfer.save" }))

    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
      paymentBankTransferEnabled: true,
      bankTransferAccounts: [expect.objectContaining({
        label: "Main",
        bankName: "Sawa Bank",
        beneficiaryName: "Sawa Center",
        iban: "SA03 8000 0000 6080 1016 7519",
      })],
    }), expect.any(Object))
  })
})
