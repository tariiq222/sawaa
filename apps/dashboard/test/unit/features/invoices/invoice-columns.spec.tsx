import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { ColumnDef, Row } from "@tanstack/react-table"

import { getInvoiceColumns } from "@/components/features/invoices/invoice-columns"
import type { InvoiceListItem } from "@/lib/types/invoice"

const t = (k: string) => k

type Col = ColumnDef<InvoiceListItem>

function makeInvoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: "inv-1",
    invoiceNumber: "INV-0001",
    clientName: "Fatimah",
    totalAmount: 30000,
    taxAmount: 0,
    createdAt: "2026-07-01T00:00:00.000Z",
    status: "PAID",
    sentAt: null,
    hasPdf: true,
    ...overrides,
  }
}

function fakeRow(invoice: InvoiceListItem): Row<InvoiceListItem> {
  return { original: invoice } as unknown as Row<InvoiceListItem>
}

function renderCell(col: Col, invoice: InvoiceListItem) {
  const cell = typeof col.cell === "function" ? col.cell : () => null
  const node = (cell as (ctx: { row: Row<InvoiceListItem> }) => React.ReactNode)({
    row: fakeRow(invoice),
  })
  render(<>{node}</>)
}

describe("getInvoiceColumns", () => {
  it("renders a direct icon-only PDF action instead of a generic actions menu", () => {
    const columns = getInvoiceColumns(t)
    const actionColumn = columns.find((col) => col.id === "actions")!

    renderCell(actionColumn, makeInvoice({ hasPdf: true }))

    expect(screen.getByRole("button", { name: "invoices.downloadPdf" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "invoices.col.actions" })).toBeNull()
    expect(screen.getByRole("button", { name: "invoices.downloadPdf" })).toHaveTextContent("")
  })

  it("labels the direct PDF action as generation when the invoice has no PDF yet", () => {
    const columns = getInvoiceColumns(t)
    const actionColumn = columns.find((col) => col.id === "actions")!

    renderCell(actionColumn, makeInvoice({ hasPdf: false }))

    expect(screen.getByRole("button", { name: "invoices.generatePdf" })).toBeInTheDocument()
  })
})
