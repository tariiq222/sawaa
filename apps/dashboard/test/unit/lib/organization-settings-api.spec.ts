import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, patch: patchMock },
}))

import {
  fetchOrganizationSettings,
  fetchOrganizationSettingsPublic,
  updateOrganizationSettings,
  fetchBookingFlowOrder,
  updateBookingFlowOrder,
  fetchPaymentSettings,
  updatePaymentSettings,
} from "@/lib/api/organization-settings"

describe("organization-settings api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchOrganizationSettings calls /dashboard/organization/settings", async () => {
    getMock.mockResolvedValueOnce({ id: "cs-1", organizationName: "Test" })
    await fetchOrganizationSettings()
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/settings")
  })

  it("fetchOrganizationSettingsPublic calls /dashboard/organization/settings", async () => {
    getMock.mockResolvedValueOnce({ organizationName: "Public" })
    await fetchOrganizationSettingsPublic()
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/settings")
  })

  it("updateOrganizationSettings patches /dashboard/organization/settings", async () => {
    patchMock.mockResolvedValueOnce({ id: "cs-1" })
    await updateOrganizationSettings({ organizationName: "Updated" } as Parameters<typeof updateOrganizationSettings>[0])
    expect(patchMock).toHaveBeenCalledWith("/dashboard/organization/settings", expect.anything())
  })

  it("fetchBookingFlowOrder reads from /dashboard/organization/settings", async () => {
    getMock.mockResolvedValueOnce({ bookingFlowOrder: "service_first" })
    const result = await fetchBookingFlowOrder()
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/settings")
    expect(result).toBe("service_first")
  })

  it("updateBookingFlowOrder patches /dashboard/organization/settings", async () => {
    patchMock.mockResolvedValueOnce({ bookingFlowOrder: "employee_first" })
    const result = await updateBookingFlowOrder("employee_first")
    expect(patchMock).toHaveBeenCalledWith("/dashboard/organization/settings", { bookingFlowOrder: "employee_first" })
    expect(result).toBe("employee_first")
  })

  it("fetchPaymentSettings calls /dashboard/organization/settings", async () => {
    getMock.mockResolvedValueOnce({ paymentMoyasarEnabled: true, paymentAtClinicEnabled: false })
    await fetchPaymentSettings()
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/settings")
  })

  it("updatePaymentSettings patches /dashboard/organization/settings", async () => {
    patchMock.mockResolvedValueOnce({ paymentMoyasarEnabled: false, paymentAtClinicEnabled: true })
    await updatePaymentSettings({ paymentMoyasarEnabled: false })
    expect(patchMock).toHaveBeenCalledWith("/dashboard/organization/settings", { paymentMoyasarEnabled: false })
  })
})
