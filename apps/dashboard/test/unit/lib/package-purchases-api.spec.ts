import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: vi.fn(), delete: vi.fn() },
}))

import {
  createPackagePurchase,
  fetchClientPackagePurchases,
} from "@/lib/api/package-purchases"

describe("package-purchases api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("createPackagePurchase POSTs the payload verbatim with method (not paymentMethod)", async () => {
    postMock.mockResolvedValueOnce({
      purchase: { id: "pp-1" },
      invoiceId: "inv-1",
      paymentId: "pay-1",
      credits: [],
    })
    const payload = {
      packageId: "pkg-1",
      clientId: "cl-1",
      branchId: "br-1",
      method: "CASH" as const,
      notes: "Walk-in sale",
    }
    await createPackagePurchase(payload)
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/finance/package-purchases",
      payload,
    )
  })

  it("createPackagePurchase forwards the optional notes field when empty string is omitted", async () => {
    postMock.mockResolvedValueOnce({
      purchase: { id: "pp-2" },
      invoiceId: "inv-2",
      paymentId: "pay-2",
      credits: [],
    })
    const payload = {
      packageId: "pkg-1",
      clientId: "cl-1",
      branchId: "br-1",
      method: "MADA" as const,
    }
    await createPackagePurchase(payload)
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/finance/package-purchases",
      payload,
    )
    // notes should NOT be an empty string in the wire payload (caller is
    // expected to strip it). The api function does not strip itself.
    const calledWith = postMock.mock.calls[0][1]
    expect(calledWith.notes).toBeUndefined()
  })

  it("fetchClientPackagePurchases GETs the per-client purchases endpoint with no query when empty", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchClientPackagePurchases("cl-1")
    expect(getMock).toHaveBeenCalledWith(
      "/dashboard/finance/clients/cl-1/package-purchases",
      { status: undefined },
    )
  })

  it("fetchClientPackagePurchases forwards the optional status filter", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchClientPackagePurchases("cl-1", { status: "ACTIVE" })
    expect(getMock).toHaveBeenCalledWith(
      "/dashboard/finance/clients/cl-1/package-purchases",
      { status: "ACTIVE" },
    )
  })
})
