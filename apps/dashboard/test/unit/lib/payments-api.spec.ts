import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    patch: patchMock,
  },
}))

import {
  fetchPayment,
  fetchPaymentStats,
  fetchPayments,
  refundPayment,
  verifyPayment,
} from "@/lib/api/payments"

describe("payments api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("fetchPayments", () => {
    it("fetches payment list with filter params", async () => {
      getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
      await fetchPayments({ page: 1, status: "COMPLETED", method: "BANK_TRANSFER" })
      expect(getMock).toHaveBeenCalledWith(
        "/dashboard/finance/payments",
        expect.objectContaining({ page: 1, status: "COMPLETED", method: "BANK_TRANSFER" }),
      )
    })

    it("calls with default empty query when no params passed", async () => {
      getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
      await fetchPayments()
      expect(getMock).toHaveBeenCalledWith(
        "/dashboard/finance/payments",
        expect.objectContaining({}),
      )
    })

    it("passes date range filters when provided", async () => {
      getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
      await fetchPayments({ dateFrom: "2026-01-01", dateTo: "2026-01-31" })
      expect(getMock).toHaveBeenCalledWith(
        "/dashboard/finance/payments",
        expect.objectContaining({ fromDate: "2026-01-01", toDate: "2026-01-31" }),
      )
    })
  })

  describe("fetchPaymentStats", () => {
    it("fetches from the stats endpoint", async () => {
      getMock.mockResolvedValueOnce({
        total: 0,
        totalAmount: 0,
        pending: 0,
        pendingAmount: 0,
        pendingVerification: 0,
        pendingVerificationAmount: 0,
        completed: 0,
        completedAmount: 0,
        refunded: 0,
        refundedAmount: 0,
        failed: 0,
      })
      await fetchPaymentStats()
      expect(getMock).toHaveBeenCalledWith("/dashboard/finance/payments/stats")
    })
  })

  describe("fetchPayment", () => {
    it("fetches a single payment by id from the detail endpoint", async () => {
      const payment = { id: "pay-2" }
      getMock.mockResolvedValueOnce(payment)

      await expect(fetchPayment("pay-2")).resolves.toBe(payment)
      expect(getMock).toHaveBeenCalledWith("/dashboard/finance/payments/pay-2")
    })
  })

  describe("refundPayment", () => {
    it("patches the refund endpoint with id and payload", async () => {
      patchMock.mockResolvedValueOnce({ id: "pay-1" })
      await refundPayment("pay-1", { reason: "Customer request", amount: 100 })
      expect(patchMock).toHaveBeenCalledWith(
        "/dashboard/finance/payments/pay-1/refund",
        { reason: "Customer request", amount: 100 },
      )
    })

    it("patches with only reason when amount omitted", async () => {
      patchMock.mockResolvedValueOnce({ id: "pay-2" })
      await refundPayment("pay-2", { reason: "Service not rendered" })
      expect(patchMock).toHaveBeenCalledWith(
        "/dashboard/finance/payments/pay-2/refund",
        { reason: "Service not rendered" },
      )
    })
  })

  describe("verifyPayment", () => {
    it("patches the verify endpoint with approve action", async () => {
      patchMock.mockResolvedValueOnce({ id: "pay-3" })
      await verifyPayment("pay-3", { action: "approve", transferRef: "TRF123" })
      expect(patchMock).toHaveBeenCalledWith(
        "/dashboard/finance/payments/pay-3/verify",
        { action: "approve", transferRef: "TRF123" },
      )
    })

    it("patches the verify endpoint with reject action", async () => {
      patchMock.mockResolvedValueOnce({ id: "pay-4" })
      await verifyPayment("pay-4", { action: "reject" })
      expect(patchMock).toHaveBeenCalledWith(
        "/dashboard/finance/payments/pay-4/verify",
        { action: "reject" },
      )
    })

    it("omits transferRef when not provided", async () => {
      patchMock.mockResolvedValueOnce({ id: "pay-5" })
      await verifyPayment("pay-5", { action: "approve" })
      expect(patchMock).toHaveBeenCalledWith(
        "/dashboard/finance/payments/pay-5/verify",
        { action: "approve" },
      )
    })
  })
})
