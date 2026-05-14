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

import { LegalContentTab } from "@/components/features/settings/legal-content-tab"

describe("LegalContentTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useOrganizationSettingsMock.mockReturnValue({
      isLoading: false,
      data: {
        companyNameAr: null,
        companyNameEn: null,
        businessRegistration: null,
        vatRegistrationNumber: null,
        vatRate: null,
        sellerAddress: null,
        organizationCity: null,
        postalCode: null,
        aboutAr: null,
        aboutEn: null,
        privacyPolicyAr: null,
        privacyPolicyEn: null,
        termsAr: null,
        termsEn: null,
        cancellationPolicyAr: null,
        cancellationPolicyEn: null,
      },
    })
  })

  it("saves visible legal content values after navigating to about section", async () => {
    render(<LegalContentTab />)

    // Default section is "entity" — navigate to "about"
    // Since t() returns the key, click the "settings.legal.about" tab
    await userEvent.click(screen.getByText("settings.legal.about"))

    // Now 2 textareas should be visible (AR + EN for About)
    const textareas = screen.getAllByRole("textbox")
    expect(textareas.length).toBe(2)

    await userEvent.type(textareas[0], "نص اختبار")
    await userEvent.type(textareas[1], "QA text")
    await userEvent.click(screen.getByRole("button", { name: "settings.save" }))

    await waitFor(() =>
      expect(mutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          aboutAr: "نص اختبار",
          aboutEn: "QA text",
        }),
        expect.any(Object),
      ),
    )
  })
})
