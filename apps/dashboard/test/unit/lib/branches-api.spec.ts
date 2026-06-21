import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock },
}))

import { fetchBranches } from "@/lib/api/branches"

describe("branches api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchBranches calls /branches with filters", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchBranches({ page: 1, search: "main" })
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/branches", expect.objectContaining({ search: "main" }))
  })

})
