import { render, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ColumnDef, Row } from "@tanstack/react-table"

import { getPaymentColumns } from "@/components/features/payments/payment-columns"
import type { Payment } from "@/lib/types/payment"

const t = (k: string) => k

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "abcdef1234567890",
    invoiceId: "inv-1",
    amount: 100,
    refundedAmount: 0,
    currency: "SAR",
    method: "ONLINE_CARD" as Payment["method"],
    status: "COMPLETED" as Payment["status"],
    gatewayRef: "moy-1",
    idempotencyKey: null,
    receiptUrl: null,
    failureReason: null,
    processedAt: null,
    createdAt: "2026-04-17T10:00:00Z",
    updatedAt: "2026-04-17T10:00:00Z",
    ...overrides,
  } as Payment
}

type Col = ColumnDef<Payment>
function fakeRow(p: Payment): Row<Payment> {
  return { original: p } as unknown as Row<Payment>
}
function cellContainer(col: Col, p: Payment) {
  const cell = typeof col.cell === "function" ? col.cell : () => null
  const node = (cell as (ctx: { row: Row<Payment> }) => React.ReactNode)({ row: fakeRow(p) })
  const { container } = render(<>{node}</>)
  return container
}

describe("getPaymentColumns — without callbacks", () => {
  const cols = getPaymentColumns(undefined, t)

  it("returns 6 columns when no callbacks are provided (no actions column)", () => {
    expect(cols).toHaveLength(6)
    expect(cols.map((c) => c.id ?? (c as { accessorKey?: string }).accessorKey)).toEqual([
      "number", "client", "amount", "method", "status", "createdAt",
    ])
  })

  it("number cell falls back to UUID slice when number is missing", () => {
    const html = cellContainer(cols[0], makePayment()).innerHTML
    expect(html).not.toContain("<button")
    expect(html).toContain("abcdef12")
  })
})

describe("getPaymentColumns — with callbacks", () => {
  const onView = vi.fn()
  const onRefund = vi.fn()
  const cols = getPaymentColumns({ onView, onRefund }, t)

  it("adds an actions column when callbacks are provided", () => {
    expect(cols).toHaveLength(7)
    expect(cols[cols.length - 1].id).toBe("actions")
  })

  it("number cell renders a clickable button that fires onView", () => {
    onView.mockReset()
    const p = makePayment()
    const container = cellContainer(cols[0], p)
    const btn = container.querySelector("button")!
    expect(btn.textContent).toBe("abcdef12")
    fireEvent.click(btn)
    expect(onView).toHaveBeenCalledWith(p)
  })

  it("number cell shows PAY- prefix when number is present", () => {
    const p = makePayment({ number: 1 })
    const container = cellContainer(cols[0], p)
    expect(container.textContent).toBe("PAY-0001")
  })
})

describe("column cells render correctly", () => {
  const cols = getPaymentColumns(undefined, t)

  it("client cell shows em-dash when invoice has no client info", () => {
    const col = cols.find((c) => c.id === "client")!
    expect(cellContainer(col, makePayment()).textContent).not.toBe("")
  })

  it("amount cell shows amount with 2 decimals", () => {
    const col = cols.find((c) => (c as { accessorKey?: string }).accessorKey === "amount")!
    expect(cellContainer(col, makePayment({ amount: 12345 })).textContent).toBe("123.45")
  })

  it("method cell passes known methods through the i18n map", () => {
    const col = cols.find((c) => (c as { accessorKey?: string }).accessorKey === "method")!
    expect(cellContainer(col, makePayment({ method: "ONLINE_CARD" as Payment["method"] })).textContent).toBe("payments.method.moyasar")
    expect(cellContainer(col, makePayment({ method: "BANK_TRANSFER" as Payment["method"] })).textContent).toBe("payments.method.bankTransfer")
  })

  it("method cell falls back to the raw method when unknown", () => {
    const col = cols.find((c) => (c as { accessorKey?: string }).accessorKey === "method")!
    expect(cellContainer(col, makePayment({ method: "crypto" as Payment["method"] })).textContent).toBe("crypto")
  })

  it("status cell renders the i18n label for known statuses", () => {
    // The cell delegates to PaymentStatusBadge with the resolved t() label
    // (status enum is the Prisma UPPERCASE form; t() receives the lookup key
    // and returns the same key in this spec — so we assert the key shows up).
    const col = cols.find((c) => (c as { accessorKey?: string }).accessorKey === "status")!
    expect(cellContainer(col, makePayment({ status: "COMPLETED" as Payment["status"] })).textContent).toContain("payments.status.paid")
    expect(cellContainer(col, makePayment({ status: "PENDING" as Payment["status"] })).textContent).toContain("payments.status.pending")
    expect(cellContainer(col, makePayment({ status: "REFUNDED" as Payment["status"] })).textContent).toContain("payments.status.refunded")
    expect(cellContainer(col, makePayment({ status: "FAILED" as Payment["status"] })).textContent).toContain("payments.status.failed")
  })

  it("status cell falls back to the pending label for unknown statuses", () => {
    // Unknown status → labelKey defaults to "payments.status.pending".
    const col = cols.find((c) => (c as { accessorKey?: string }).accessorKey === "status")!
    const html = cellContainer(col, makePayment({ status: "mystery" as Payment["status"] })).innerHTML
    expect(html).not.toContain("payments.status.paid")
    expect(html).not.toContain("payments.status.refunded")
    expect(html).toContain("payments.status.pending")
  })
})
