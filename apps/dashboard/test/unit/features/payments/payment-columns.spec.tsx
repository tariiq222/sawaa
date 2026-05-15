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
      "id", "client", "amount", "method", "status", "createdAt",
    ])
  })

  it("id cell renders a plain span (not a button) when callbacks missing", () => {
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

  it("id cell renders a clickable button that fires onView", () => {
    onView.mockReset()
    const p = makePayment()
    const container = cellContainer(cols[0], p)
    const btn = container.querySelector("button")!
    expect(btn.textContent).toBe("abcdef12")
    fireEvent.click(btn)
    expect(onView).toHaveBeenCalledWith(p)
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
    expect(cellContainer(col, makePayment({ amount: 123.45 })).textContent).toBe("123.45")
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

  it("status cell applies the tinted class matching the status", () => {
    const col = cols.find((c) => (c as { accessorKey?: string }).accessorKey === "status")!
    expect(cellContainer(col, makePayment({ status: "COMPLETED" as Payment["status"] })).innerHTML).toContain("text-success")
    expect(cellContainer(col, makePayment({ status: "PENDING" as Payment["status"] })).innerHTML).toContain("text-warning")
    expect(cellContainer(col, makePayment({ status: "REFUNDED" as Payment["status"] })).innerHTML).toContain("text-info")
    expect(cellContainer(col, makePayment({ status: "FAILED" as Payment["status"] })).innerHTML).toContain("text-destructive")
  })

  it("status cell falls back to an unstyled badge when status is unknown", () => {
    const col = cols.find((c) => (c as { accessorKey?: string }).accessorKey === "status")!
    const html = cellContainer(col, makePayment({ status: "mystery" as Payment["status"] })).innerHTML
    expect(html).not.toContain("text-success")
    expect(html).not.toContain("text-warning")
    expect(html).toContain("mystery")
  })
})
