import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mutateMock, useOrganizationSettingsMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  useOrganizationSettingsMock: vi.fn(),
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
})
