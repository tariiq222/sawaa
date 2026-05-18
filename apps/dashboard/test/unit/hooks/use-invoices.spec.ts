import { describe, it, expect } from "vitest"
import type { Payment } from "@/lib/types/payment"
import { toInvoiceListItem } from "@/hooks/use-invoices"

describe("toInvoiceListItem", () => {
  it("maps payment fields to invoice list row shape", () => {
    const payment: Payment = {
      id: "pay-1",
      invoiceId: "inv-123",
      amount: 12500,
      refundedAmount: 0,
      currency: "SAR",
      method: "ONLINE_CARD",
      status: "COMPLETED",
      gatewayRef: null,
      idempotencyKey: null,
      receiptUrl: null,
      failureReason: null,
      processedAt: null,
      createdAt: "2026-05-17T10:00:00Z",
      updatedAt: "2026-05-17T10:00:00Z",
    }

    const row = toInvoiceListItem(payment)

    expect(row.id).toBe("pay-1")
    expect(row.invoiceNumber).toBe("inv-123")
    expect(row.totalAmount).toBe(12500)
    expect(row.taxAmount).toBe(0)
    expect(row.status).toBe("COMPLETED")
    expect(row.clientName).toBeNull()
  })

  it("falls back to truncated id when invoiceId is missing", () => {
    const payment: Payment = {
      id: "pay-abc-def",
      invoiceId: "",
      amount: 12000,
      refundedAmount: 0,
      currency: "SAR",
      method: "CASH",
      status: "PENDING",
      gatewayRef: null,
      idempotencyKey: null,
      receiptUrl: null,
      failureReason: null,
      processedAt: null,
      createdAt: "2026-05-17T10:00:00Z",
      updatedAt: "2026-05-17T10:00:00Z",
    }

    const row = toInvoiceListItem(payment)

    expect(row.invoiceNumber).toBe("PAY-ABC-")
    expect(row.totalAmount).toBe(12000)
  })
})
