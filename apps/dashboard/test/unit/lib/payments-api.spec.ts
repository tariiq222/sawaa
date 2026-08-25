import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, patchMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    patch: patchMock,
    post: postMock,
  },
}))

import {
  collectBookingPayment,
  fetchPayment,
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

  describe("collectBookingPayment", () => {
    it("posts to the booking collect path with the full payload", async () => {
      const expected = {
        bookingId: "bk-1",
        invoice: { id: "inv-1", subtotal: 0, vatRate: 0, total: 1000, outstanding: 0, status: "PAID" },
        payment: { id: "pay-7", amount: 1000, method: "CASH", status: "COMPLETED" },
      }
      postMock.mockResolvedValueOnce(expected)

      const payload = {
        method: "CASH" as const,
        amount: 1000,
        discountAmt: 0,
        discountReasonId: "reason-1",
        note: "Paid in full at reception",
        idempotencyKey: "idem-abc",
      }

      await expect(collectBookingPayment("bk-1", payload)).resolves.toBe(expected)
      expect(postMock).toHaveBeenCalledWith(
        "/dashboard/finance/bookings/bk-1/collect",
        payload,
      )
    })

    it("posts a minimal payload with only method", async () => {
      postMock.mockResolvedValueOnce({
        bookingId: "bk-2",
        invoice: { id: "inv-2", subtotal: 0, vatRate: 0, total: 500, outstanding: 0, status: "PAID" },
        payment: null,
      })

      await collectBookingPayment("bk-2", { method: "BANK_TRANSFER" })
      expect(postMock).toHaveBeenCalledWith(
        "/dashboard/finance/bookings/bk-2/collect",
        { method: "BANK_TRANSFER" },
      )
    })

    it("routes TABBY and MADA methods without hitting Moyasar", async () => {
      postMock.mockResolvedValueOnce({
        bookingId: "bk-3",
        invoice: { id: "inv-3", subtotal: 0, vatRate: 0, total: 0, outstanding: 0, status: "PAID" },
        payment: { id: "pay-9", amount: 0, method: "MADA", status: "COMPLETED" },
      })

      await collectBookingPayment("bk-3", { method: "MADA" })
      expect(postMock).toHaveBeenCalledWith(
        "/dashboard/finance/bookings/bk-3/collect",
        { method: "MADA" },
      )
    })
  })
})
