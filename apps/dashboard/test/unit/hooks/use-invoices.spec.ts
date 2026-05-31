import { describe, it, expect } from "vitest"
import type { InvoiceListRow } from "@/lib/types/invoice"
import { toInvoiceListItem } from "@/hooks/use-invoices"

function buildRow(overrides: Partial<InvoiceListRow> = {}): InvoiceListRow {
  return {
    id: "inv-1",
    number: 1,
    clientId: "client-1",
    bookingId: "booking-1",
    clientName: "Sara Ali",
    subtotal: "10000",
    vatAmt: "1500",
    total: "11500",
    refundedAmount: "0",
    currency: "SAR",
    status: "PAID",
    issuedAt: "2026-05-17T10:00:00Z",
    paidAt: "2026-05-18T10:00:00Z",
    sentToClientAt: null,
    hasPdf: true,
    createdAt: "2026-05-17T09:00:00Z",
    ...overrides,
  }
}

describe("toInvoiceListItem", () => {
  it("maps real invoice fields to the list-row shape", () => {
    const row = toInvoiceListItem(buildRow())

    expect(row.id).toBe("inv-1")
    expect(row.invoiceNumber).toBe("INV-0001")
    expect(row.totalAmount).toBe(11500)
    expect(row.taxAmount).toBe(1500)
    expect(row.status).toBe("PAID")
    expect(row.clientName).toBe("Sara Ali")
    expect(row.hasPdf).toBe(true)
  })

  it("uses issuedAt for the displayed date, falling back to createdAt", () => {
    expect(toInvoiceListItem(buildRow()).createdAt).toBe("2026-05-17T10:00:00Z")
    expect(
      toInvoiceListItem(buildRow({ issuedAt: null })).createdAt,
    ).toBe("2026-05-17T09:00:00Z")
  })

  it("coerces Decimal-as-string monetary fields to numbers", () => {
    const row = toInvoiceListItem(buildRow({ total: 23000, vatAmt: 3000 }))
    expect(row.totalAmount).toBe(23000)
    expect(row.taxAmount).toBe(3000)
  })

  it("preserves a null client name", () => {
    const row = toInvoiceListItem(buildRow({ clientName: null }))
    expect(row.clientName).toBeNull()
  })
})
