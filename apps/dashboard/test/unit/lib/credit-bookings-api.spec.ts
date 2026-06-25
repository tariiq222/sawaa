import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock },
}))

import {
  fetchMatchingCredits,
  bookFromCredit,
} from "@/lib/api/credit-bookings"

describe("credit-bookings api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchMatchingCredits GETs the matching-credits endpoint with the 4 query params", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchMatchingCredits({
      clientId: "cl-1",
      serviceId: "svc-1",
      employeeId: "emp-1",
      durationOptionId: "dur-1",
    })
    expect(getMock).toHaveBeenCalledWith(
      "/dashboard/bookings/matching-credits",
      {
        clientId: "cl-1",
        serviceId: "svc-1",
        employeeId: "emp-1",
        durationOptionId: "dur-1",
      },
    )
  })

  it("fetchMatchingCredits returns an array (FIFO match rows)", async () => {
    getMock.mockResolvedValueOnce([
      {
        creditId: "cr-1",
        purchaseId: "pp-1",
        serviceId: "svc-1",
        employeeId: "emp-1",
        durationOptionId: "dur-1",
        totalQuantity: 4,
        usedQuantity: 1,
        remaining: 3,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ])
    const result = await fetchMatchingCredits({
      clientId: "cl-1",
      serviceId: "svc-1",
      employeeId: "emp-1",
      durationOptionId: "dur-1",
    })
    expect(result).toHaveLength(1)
    expect(result[0].creditId).toBe("cr-1")
  })

  it("bookFromCredit POSTs to /dashboard/bookings/from-credit with the explicit creditId", async () => {
    postMock.mockResolvedValueOnce({ id: "bk-new" })
    const scheduledAt = "2026-12-31T09:00:00.000Z"
    await bookFromCredit({
      clientId: "cl-1",
      creditId: "cr-1",
      branchId: "br-1",
      scheduledAt,
      deliveryType: "IN_PERSON",
      notes: "VIP client",
    })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/bookings/from-credit",
      {
        clientId: "cl-1",
        creditId: "cr-1",
        branchId: "br-1",
        scheduledAt,
        deliveryType: "IN_PERSON",
        notes: "VIP client",
      },
    )
  })

  it("bookFromCredit forwards the FIFO-select triple when creditId is omitted", async () => {
    postMock.mockResolvedValueOnce({ id: "bk-new" })
    const scheduledAt = "2026-12-31T10:00:00.000Z"
    await bookFromCredit({
      clientId: "cl-2",
      serviceId: "svc-2",
      employeeId: "emp-2",
      durationOptionId: "dur-2",
      branchId: "br-1",
      scheduledAt,
    })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/bookings/from-credit",
      {
        clientId: "cl-2",
        serviceId: "svc-2",
        employeeId: "emp-2",
        durationOptionId: "dur-2",
        branchId: "br-1",
        scheduledAt,
      },
    )
  })

  it("bookFromCredit forwards ISO scheduledAt verbatim (no client-side conversion)", async () => {
    postMock.mockResolvedValueOnce({ id: "bk-new" })
    const iso = "2026-06-30T13:30:00.000Z"
    await bookFromCredit({
      clientId: "cl-3",
      creditId: "cr-3",
      branchId: "br-1",
      scheduledAt: iso,
    })
    const [, payload] = postMock.mock.calls[0]
    expect(payload.scheduledAt).toBe(iso)
  })
})