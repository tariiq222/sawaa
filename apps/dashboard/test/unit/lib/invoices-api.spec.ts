import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock },
}))

import { fetchInvoices, fetchInvoicePdf, generateInvoicePdf } from "@/lib/api/invoices"

describe("invoices api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchInvoices maps dateFrom/dateTo to the backend's fromDate/toDate params", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchInvoices({
      page: 2,
      limit: 50,
      status: "PAID",
      clientId: "c-1",
      bookingId: "b-1",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-30",
    })
    expect(getMock).toHaveBeenCalledWith("/dashboard/finance/invoices", {
      page: 2,
      limit: 50,
      status: "PAID",
      clientId: "c-1",
      bookingId: "b-1",
      fromDate: "2026-06-01",
      toDate: "2026-06-30",
    })
  })

  it("fetchInvoices defaults to an all-undefined params object", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchInvoices()
    expect(getMock).toHaveBeenCalledWith("/dashboard/finance/invoices", {
      page: undefined,
      limit: undefined,
      status: undefined,
      clientId: undefined,
      bookingId: undefined,
      fromDate: undefined,
      toDate: undefined,
    })
  })

  it("fetchInvoicePdf GETs the invoice pdf link endpoint", async () => {
    getMock.mockResolvedValueOnce({ url: "https://minio/invoice.pdf" })
    const result = await fetchInvoicePdf("inv-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/finance/invoices/inv-1/pdf")
    expect(result.url).toBe("https://minio/invoice.pdf")
  })

  it("generateInvoicePdf POSTs to the pdf endpoint with an empty body", async () => {
    postMock.mockResolvedValueOnce({ url: "https://minio/generated.pdf" })
    await generateInvoicePdf("inv-2")
    expect(postMock).toHaveBeenCalledWith("/dashboard/finance/invoices/inv-2/pdf", {})
  })
})
