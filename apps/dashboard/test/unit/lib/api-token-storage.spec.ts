import { beforeEach, describe, expect, it, vi } from "vitest"

const { initClientMock, apiRequestMock } = vi.hoisted(() => ({
  initClientMock: vi.fn(),
  apiRequestMock: vi.fn(),
}))

vi.mock("@sawaa/api-client", () => ({
  ApiError: class ApiError extends Error {},
  apiRequest: apiRequestMock,
  initClient: initClientMock,
}))

describe("dashboard api token storage", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it("clears legacy Web Storage access tokens on bootstrap", async () => {
    localStorage.setItem("sawaa_access_token", "local-token")
    localStorage.setItem("sawaa_token_storage", "local")
    sessionStorage.setItem("sawaa_access_token", "session-token")

    const apiModule = await import("@/lib/api")

    expect(localStorage.getItem("sawaa_access_token")).toBeNull()
    expect(localStorage.getItem("sawaa_token_storage")).toBeNull()
    expect(sessionStorage.getItem("sawaa_access_token")).toBeNull()
    expect(apiModule.getAccessToken()).toBeNull()
    expect(initClientMock).toHaveBeenCalledOnce()
  })

  it("keeps refreshed access tokens in memory only", async () => {
    const apiModule = await import("@/lib/api")
    const config = initClientMock.mock.calls[0]?.[0]

    config.onTokenRefreshed("new-access-token")

    expect(apiModule.getAccessToken()).toBe("new-access-token")
    expect(config.getAccessToken()).toBe("new-access-token")
    expect(localStorage.getItem("sawaa_access_token")).toBeNull()
    expect(localStorage.getItem("sawaa_token_storage")).toBeNull()
    expect(sessionStorage.getItem("sawaa_access_token")).toBeNull()
  })
})
