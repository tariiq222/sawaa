import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mutateMock, useOrganizationSettingsMock, authUser } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  useOrganizationSettingsMock: vi.fn(),
  authUser: { current: { isSuperAdmin: false } as { isSuperAdmin: boolean } },
}))

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: authUser.current }),
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

vi.mock("@/hooks/use-organization-settings", () => ({
  useOrganizationSettings: useOrganizationSettingsMock,
  useUpdateOrganizationSettings: () => ({ mutate: mutateMock, isPending: false }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { GeneralContactSection } from "@/components/features/settings/general-contact-section"

describe("GeneralContactSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authUser.current = { isSuperAdmin: false }
    useOrganizationSettingsMock.mockReturnValue({
      isLoading: false,
      data: {
        contactEmail: "info@sawa.sa",
        contactPhone: "0500000000",
        address: "الرياض",
        companyNameAr: "مركز سواء",
        companyNameEn: "Sawa",
        businessRegistration: "1010101010",
        vatRegistrationNumber: "300000000000003",
        sellerAddress: "الرياض، حي العليا",
        organizationCity: "Riyadh",
        postalCode: "12345",
        vatRate: 0,
      },
    })
  })

  it("renders prefilled contact and entity fields from settings", () => {
    render(<GeneralContactSection />)
    expect(screen.getByDisplayValue("info@sawa.sa")).toBeInTheDocument()
    expect(screen.getByDisplayValue("300000000000003")).toBeInTheDocument()
  })

  it("submits contact + entity fields in a single save", async () => {
    render(<GeneralContactSection />)

    const vatInput = screen.getByDisplayValue("300000000000003")
    await userEvent.clear(vatInput)
    await userEvent.type(vatInput, "310122393500003")

    await userEvent.click(screen.getByRole("button"))

    await waitFor(() => expect(mutateMock).toHaveBeenCalled())
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contactEmail: "info@sawa.sa",
        vatRegistrationNumber: "310122393500003",
        companyNameAr: "مركز سواء",
      }),
      expect.anything(),
    )
  })

  it("hides the VAT rate from non-super-admins and never sends it", async () => {
    render(<GeneralContactSection />)
    expect(screen.queryByText("settings.entity.vatRate")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button"))
    await waitFor(() => expect(mutateMock).toHaveBeenCalled())
    expect(mutateMock.mock.calls[0][0]).not.toHaveProperty("vatRate")
  })

  it("lets a super-admin enable VAT as a percentage and saves it as a fraction", async () => {
    authUser.current = { isSuperAdmin: true }
    render(<GeneralContactSection />)

    const rate = screen.getByDisplayValue("0")
    await userEvent.clear(rate)
    await userEvent.type(rate, "15")
    await userEvent.click(screen.getByRole("button"))

    await waitFor(() => expect(mutateMock).toHaveBeenCalled())
    expect(mutateMock).toHaveBeenCalledWith(expect.objectContaining({ vatRate: 0.15 }), expect.anything())
  })

  it("lets a super-admin disable VAT by setting 0", async () => {
    authUser.current = { isSuperAdmin: true }
    useOrganizationSettingsMock.mockReturnValue({
      isLoading: false,
      data: { organizationCity: "Riyadh", vatRate: 0.15 },
    })
    render(<GeneralContactSection />)

    const rate = screen.getByDisplayValue("15")
    await userEvent.clear(rate)
    await userEvent.type(rate, "0")
    await userEvent.click(screen.getByRole("button"))

    await waitFor(() => expect(mutateMock).toHaveBeenCalled())
    expect(mutateMock).toHaveBeenCalledWith(expect.objectContaining({ vatRate: 0 }), expect.anything())
  })

  it("rejects an out-of-range rate without saving", async () => {
    authUser.current = { isSuperAdmin: true }
    render(<GeneralContactSection />)

    const rate = screen.getByDisplayValue("0")
    await userEvent.clear(rate)
    await userEvent.type(rate, "150")
    await userEvent.click(screen.getByRole("button"))

    expect(mutateMock).not.toHaveBeenCalled()
  })
})
