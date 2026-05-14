import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock },
}))

import { fetchBranding, fetchPublicBranding, updateBranding } from "@/lib/api/branding"

describe("branding api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchBranding calls /dashboard/organization/branding", async () => {
    getMock.mockResolvedValueOnce({ colorPrimary: "#354FD8" })
    await fetchBranding()
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/branding")
  })

  it("fetchPublicBranding calls /public/branding", async () => {
    getMock.mockResolvedValueOnce({ logo: "https://example.com/logo.png" })
    await fetchPublicBranding()
    expect(getMock).toHaveBeenCalledWith("/public/branding")
  })

  it("updateBranding posts to /dashboard/organization/branding", async () => {
    postMock.mockResolvedValueOnce({ colorPrimary: "#000000" })
    await updateBranding({ colorPrimary: "#000000" } as Parameters<typeof updateBranding>[0])
    expect(postMock).toHaveBeenCalledWith("/dashboard/organization/branding", expect.anything())
  })
})
