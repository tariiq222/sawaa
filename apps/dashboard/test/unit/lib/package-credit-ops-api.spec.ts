import { beforeEach, describe, expect, it, vi } from "vitest"

const { postMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { post: postMock, get: vi.fn() },
}))

import {
  transferCredit,
  refundPackagePurchase,
} from "@/lib/api/package-credit-ops"
import {
  pickTransferTargetEmployees,
  type ServiceEmployeeOption,
} from "@/lib/types/credit-ops"

describe("package-credit-ops api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /* ─── transferCredit ─── */

  it("transferCredit POSTs to the credits transfer endpoint with toEmployeeId", async () => {
    postMock.mockResolvedValueOnce({ id: "cr-1", employeeId: "emp-2" })
    await transferCredit("cr-1", { toEmployeeId: "emp-2" })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/bookings/credits/cr-1/transfer",
      { toEmployeeId: "emp-2" },
    )
  })

  it("transferCredit returns the updated credit row (id + employeeId)", async () => {
    postMock.mockResolvedValueOnce({ id: "cr-99", employeeId: "emp-77" })
    const result = await transferCredit("cr-99", { toEmployeeId: "emp-77" })
    expect(result).toEqual({ id: "cr-99", employeeId: "emp-77" })
  })

  it("transferCredit does NOT collapse the URL (creditId travels in the path)", async () => {
    postMock.mockResolvedValueOnce({ id: "cr-1", employeeId: "emp-2" })
    await transferCredit("cr-1", { toEmployeeId: "emp-2" })
    const [url] = postMock.mock.calls[0]
    expect(url).toBe("/dashboard/bookings/credits/cr-1/transfer")
    expect(url).not.toContain("creditId=")
  })

  /* ─── refundPackagePurchase ─── */

  it("refundPackagePurchase POSTs the payload as integer halalas", async () => {
    postMock.mockResolvedValueOnce({
      purchaseId: "pp-1",
      status: "REFUNDED",
      refundAmount: 150000,
      refundedAt: "2026-06-24T00:00:00.000Z",
    })
    await refundPackagePurchase("pp-1", {
      refundAmount: 150000,
      notes: "Client moved abroad",
    })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/finance/package-purchases/pp-1/refund",
      { refundAmount: 150000, notes: "Client moved abroad" },
    )
  })

  it("refundPackagePurchase forwards a 0-amount refund (no-money cancellation)", async () => {
    postMock.mockResolvedValueOnce({
      purchaseId: "pp-2",
      status: "REFUNDED",
      refundAmount: 0,
      refundedAt: "2026-06-24T00:00:00.000Z",
    })
    await refundPackagePurchase("pp-2", { refundAmount: 0 })
    const [, payload] = postMock.mock.calls[0]
    expect(payload.refundAmount).toBe(0)
  })

  it("refundPackagePurchase omits notes when the caller passes undefined", async () => {
    postMock.mockResolvedValueOnce({
      purchaseId: "pp-3",
      status: "REFUNDED",
      refundAmount: 10000,
      refundedAt: "2026-06-24T00:00:00.000Z",
    })
    await refundPackagePurchase("pp-3", { refundAmount: 10000 })
    const [, payload] = postMock.mock.calls[0]
    expect(payload.notes).toBeUndefined()
  })

  it("refundPackagePurchase never sends a SAR (decimals) value — only integer halalas", async () => {
    // This is the contract test: the form is responsible for the
    // SAR → halalas conversion (see lib/money.sarToHalalas). The
    // api fn must NOT accept / send floats.
    postMock.mockResolvedValueOnce({
      purchaseId: "pp-4",
      status: "REFUNDED",
      refundAmount: 150050,
      refundedAt: "2026-06-24T00:00:00.000Z",
    })
    await refundPackagePurchase("pp-4", {
      refundAmount: 150050, // 1500.50 SAR → 150050 halalas
    })
    const [, payload] = postMock.mock.calls[0]
    expect(payload.refundAmount).toBe(150050)
    expect(Number.isInteger(payload.refundAmount)).toBe(true)
  })
})

describe("pickTransferTargetEmployees", () => {
  const rows: ServiceEmployeeOption[] = [
    { id: "emp-1", displayName: "A", isActive: true, raw: null },
    { id: "emp-2", displayName: "B", isActive: false, raw: null },
    { id: "emp-3", displayName: "C", isActive: true, raw: null },
    { id: "emp-4", displayName: "D", isActive: true, raw: null },
  ]

  it("returns an empty list when rows is undefined", () => {
    expect(pickTransferTargetEmployees(undefined, "emp-x")).toEqual([])
  })

  it("filters out the current owner so the picker never offers a no-op", () => {
    const result = pickTransferTargetEmployees(rows, "emp-1")
    expect(result.map((r) => r.id)).toEqual(["emp-3", "emp-4"])
  })

  it("filters out inactive employees", () => {
    const result = pickTransferTargetEmployees(rows, "emp-2")
    // emp-2 is the current owner (filtered) + inactive (also filtered)
    expect(result.map((r) => r.id)).toEqual(["emp-1", "emp-3", "emp-4"])
  })

  it("returns an empty list when every active row is the current owner", () => {
    const only = [{ id: "emp-1", displayName: "A", isActive: true, raw: null }]
    expect(pickTransferTargetEmployees(only, "emp-1")).toEqual([])
  })
})
