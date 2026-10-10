import type { ReactElement } from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { it, expect, vi } from "vitest"
const { fetchInvoicePdf, generateInvoicePdf } = vi.hoisted(() => ({
  fetchInvoicePdf: vi.fn(),
  generateInvoicePdf: vi.fn(),
}))
vi.mock("@/lib/api/invoices", () => ({ fetchInvoicePdf, generateInvoicePdf }))
import { getInvoiceColumns } from "@/components/features/invoices/invoice-columns"
it("opens a window synchronously and reads an existing PDF without manage permissions", async () => {
  const popup = { location: { href: "" }, close: vi.fn(), opener: null }
  const open = vi.spyOn(window, "open").mockReturnValue(popup as never)
  let finish: (v: { url: string }) => void = () => {}
  fetchInvoicePdf.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  const columns = getInvoiceColumns((k) => k, {
    canGeneratePdf: false,
  } as never)
  const cell = columns.find((c) => c.id === "actions")!
    .cell as unknown as (context: {
    row: { original: { id: string; hasPdf: boolean } }
  }) => ReactElement
  render(cell({ row: { original: { id: "i", hasPdf: true } } }))
  fireEvent.click(screen.getByRole("button"))
  expect(open).toHaveBeenCalledTimes(1)
  finish({ url: "https://example.test/invoice.pdf" })
  await waitFor(() =>
    expect(popup.location.href).toBe("https://example.test/invoice.pdf")
  )
  expect(fetchInvoicePdf).toHaveBeenCalledWith("i")
  expect(generateInvoicePdf).not.toHaveBeenCalled()
  open.mockRestore()
})
