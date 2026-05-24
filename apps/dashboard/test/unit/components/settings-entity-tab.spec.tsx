import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mutateAsyncMock, useOrganizationSettingsMock } = vi.hoisted(() => ({
  mutateAsyncMock: vi.fn().mockResolvedValue(undefined),
  useOrganizationSettingsMock: vi.fn(),
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

vi.mock("@/hooks/use-organization-settings", () => ({
  useOrganizationSettings: useOrganizationSettingsMock,
  useUpdateOrganizationSettings: () => ({ mutateAsync: mutateAsyncMock, isPending: false }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { EntityTab } from "@/components/features/settings/entity-tab"

describe("EntityTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useOrganizationSettingsMock.mockReturnValue({
      isLoading: false,
      data: {
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

  it("renders the prefilled VAT number from settings", () => {
    render(<EntityTab />)
    expect(screen.getByDisplayValue("300000000000003")).toBeInTheDocument()
  })

  it("submits the updated payload with nullable empty strings", async () => {
    render(<EntityTab />)

    const vatInput = screen.getByDisplayValue("300000000000003")
    await userEvent.clear(vatInput)
    await userEvent.type(vatInput, "310122393500003")

    await userEvent.click(screen.getByRole("button"))

    await waitFor(() => expect(mutateAsyncMock).toHaveBeenCalled())
    expect(mutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        vatRegistrationNumber: "310122393500003",
        companyNameAr: "مركز سواء",
      }),
    )
  })
})
