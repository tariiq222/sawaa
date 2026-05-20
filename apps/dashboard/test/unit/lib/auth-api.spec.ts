import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  loginMock,
  refreshTokenMock,
  getMeMock,
  logoutMock,
  changePasswordMock,
  setAccessTokenMock,
  clearLegacyAccessTokenStorageMock,
} = vi.hoisted(() => ({
  loginMock: vi.fn(),
  refreshTokenMock: vi.fn(),
  getMeMock: vi.fn(),
  logoutMock: vi.fn(),
  changePasswordMock: vi.fn(),
  setAccessTokenMock: vi.fn(),
  clearLegacyAccessTokenStorageMock: vi.fn(() => {
    localStorage.removeItem("sawaa_access_token")
    localStorage.removeItem("sawaa_token_storage")
    sessionStorage.removeItem("sawaa_access_token")
  }),
}))

vi.mock("@sawaa/api-client", () => ({
  authApi: {
    login: loginMock,
    refreshToken: refreshTokenMock,
    getMe: getMeMock,
    logout: logoutMock,
    changePassword: changePasswordMock,
  },
  initClient: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  setAccessToken: setAccessTokenMock,
  clearLegacyAccessTokenStorage: clearLegacyAccessTokenStorageMock,
  getAccessToken: vi.fn(() => null),
}))

import {
  login,
  fetchMe,
  refreshToken,
  logoutApi,
  logout,
  changePassword,
  getStoredUser,
} from "@/lib/api/auth"

const fakeUser = {
  id: "1",
  email: "a@b.com",
  name: "A B",
  firstName: "A",
  lastName: "B",
  phone: null,
  gender: null,
  avatarUrl: null,
  isActive: true,
  role: "OWNER",
  customRoleId: null,
  isSuperAdmin: false,
  permissions: [],
  organizationId: "org_test",
}

describe("auth api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it("login delegates to authApi.login and keeps access token memory-only", async () => {
    // Refresh tokens are managed as HttpOnly cookies by @sawaa/api-client; the
    // dashboard wrapper only keeps the access token in memory and stores the
    // non-token user payload locally.
    loginMock.mockResolvedValueOnce({
      accessToken: "token123",
      refreshToken: "rt123",
      expiresIn: 900,
      user: fakeUser,
    })

    const result = await login("a@b.com", "pass")

    expect(loginMock).toHaveBeenCalledWith({ email: "a@b.com", password: "pass" })
    expect(setAccessTokenMock).toHaveBeenCalledWith("token123")
    expect(clearLegacyAccessTokenStorageMock).toHaveBeenCalledOnce()
    expect(localStorage.getItem("sawaa_user")).toContain("a@b.com")
    expect(localStorage.getItem("sawaa_access_token")).toBeNull()
    expect(sessionStorage.getItem("sawaa_access_token")).toBeNull()
    expect(result.accessToken).toBe("token123")
  })

  it("passes rememberMe to the backend without storing access tokens", async () => {
    loginMock.mockResolvedValueOnce({
      accessToken: "rememberedToken",
      refreshToken: "rt123",
      expiresIn: 900,
      user: fakeUser,
    })

    await login("a@b.com", "pass", true)

    expect(loginMock).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "pass",
      rememberMe: true,
    })
    expect(localStorage.getItem("sawaa_access_token")).toBeNull()
    expect(sessionStorage.getItem("sawaa_access_token")).toBeNull()
    expect(clearLegacyAccessTokenStorageMock).toHaveBeenCalledOnce()
  })

  it("fetchMe delegates to authApi.getMe and stores user", async () => {
    getMeMock.mockResolvedValueOnce(fakeUser)

    const result = await fetchMe()

    expect(getMeMock).toHaveBeenCalledOnce()
    expect(localStorage.getItem("sawaa_user")).toContain("a@b.com")
    expect(result.email).toBe("a@b.com")
  })

  it("refreshToken delegates to authApi.refreshToken and updates access token", async () => {
    // The api-client owns refresh-token retrieval (HttpOnly cookie); the
    // dashboard wrapper only forwards the call and keeps the new access token
    // returned by the server in memory.
    refreshTokenMock.mockResolvedValueOnce({
      accessToken: "newToken",
      refreshToken: "newRt",
      expiresIn: 900,
    })

    const result = await refreshToken()

    expect(refreshTokenMock).toHaveBeenCalledOnce()
    expect(setAccessTokenMock).toHaveBeenCalledWith("newToken")
    expect(clearLegacyAccessTokenStorageMock).toHaveBeenCalledOnce()
    expect(result.accessToken).toBe("newToken")
  })

  it("refreshToken keeps the refreshed access token in memory only", async () => {
    localStorage.setItem("sawaa_token_storage", "local")
    localStorage.setItem("sawaa_access_token", "stale-local-token")
    sessionStorage.setItem("sawaa_access_token", "stale-session-token")
    refreshTokenMock.mockResolvedValueOnce({
      accessToken: "newToken",
      refreshToken: "newRt",
      expiresIn: 900,
    })

    await refreshToken()

    expect(setAccessTokenMock).toHaveBeenCalledWith("newToken")
    expect(clearLegacyAccessTokenStorageMock).toHaveBeenCalledOnce()
    expect(localStorage.getItem("sawaa_access_token")).toBeNull()
    expect(localStorage.getItem("sawaa_token_storage")).toBeNull()
    expect(sessionStorage.getItem("sawaa_access_token")).toBeNull()
  })

  it("refreshToken propagates errors from the api-client", async () => {
    refreshTokenMock.mockRejectedValueOnce(new Error("Refresh failed"))
    await expect(refreshToken()).rejects.toThrow("Refresh failed")
    expect(setAccessTokenMock).not.toHaveBeenCalled()
  })

  it("logoutApi delegates to authApi.logout and clears state", async () => {
    logoutMock.mockResolvedValueOnce(undefined)
    localStorage.setItem("sawaa_user", "{}")

    await logoutApi()

    expect(logoutMock).toHaveBeenCalledOnce()
    expect(localStorage.getItem("sawaa_user")).toBeNull()
    expect(setAccessTokenMock).toHaveBeenCalledWith(null)
    expect(clearLegacyAccessTokenStorageMock).toHaveBeenCalledOnce()
  })

  it("logoutApi still clears state when API call fails", async () => {
    logoutMock.mockRejectedValueOnce(new Error("fail"))
    localStorage.setItem("sawaa_user", "{}")

    await logoutApi()

    expect(localStorage.getItem("sawaa_user")).toBeNull()
    expect(setAccessTokenMock).toHaveBeenCalledWith(null)
    expect(clearLegacyAccessTokenStorageMock).toHaveBeenCalledOnce()
  })

  it("logout clears state without API call", () => {
    localStorage.setItem("sawaa_user", "{}")
    logout()
    expect(localStorage.getItem("sawaa_user")).toBeNull()
    expect(setAccessTokenMock).toHaveBeenCalledWith(null)
    expect(clearLegacyAccessTokenStorageMock).toHaveBeenCalledOnce()
    expect(logoutMock).not.toHaveBeenCalled()
  })

  it("changePassword delegates to authApi.changePassword", async () => {
    changePasswordMock.mockResolvedValueOnce(undefined)
    await changePassword("oldPass", "newPass")
    expect(changePasswordMock).toHaveBeenCalledWith({
      currentPassword: "oldPass",
      newPassword: "newPass",
    })
  })

  it("getStoredUser returns null when no user stored", () => {
    expect(getStoredUser()).toBeNull()
  })

  it("getStoredUser returns parsed user when stored", () => {
    localStorage.setItem("sawaa_user", JSON.stringify(fakeUser))
    expect(getStoredUser()).toEqual(fakeUser)
  })

  it("getStoredUser returns null for invalid JSON", () => {
    localStorage.setItem("sawaa_user", "not-json")
    expect(getStoredUser()).toBeNull()
  })
})
