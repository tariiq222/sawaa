import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock },
}))

import { fetchPayments } from "@/lib/api/payments"

describe("payments api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches payment list with filter params", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchPayments({ page: 1, status: "paid", method: "bank_transfer" })
    expect(getMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ page: 1 }),
    )
  })
})
