/**
 * Auth API — Sawaa Dashboard
 *
 * Thin wrapper over @sawaa/api-client/authApi. The shared package owns
 * request shape, envelope unwrapping, and 401 retry logic; this file only
 * adds persist/clear localStorage helpers and dashboard-specific aliases.
 */

import { authApi } from "@sawaa/api-client"
import type { AuthResponse, UserPayload } from "@sawaa/api-client"
import { setAccessToken } from "@/lib/api"

export type AuthUser = UserPayload
export type { AuthResponse }

const USER_KEY = "sawaa_user"
const ACCESS_TOKEN_KEY = "sawaa_access_token"
const TOKEN_STORAGE_KEY = "sawaa_token_storage"

export async function login(
  identifier: string,
  password: string,
  rememberMe?: boolean,
): Promise<AuthResponse> {
  const data = await authApi.login({ email: identifier, password, rememberMe })
  persistAuth(data, rememberMe)
  return data
}

export async function requestDashboardOtp(identifier: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/proxy/auth/otp/request-dashboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ identifier }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? 'Failed to send OTP')
  }
  return res.json()
}

export async function verifyDashboardOtp(identifier: string, code: string): Promise<AuthResponse> {
  const res = await fetch(`/api/proxy/auth/otp/verify-dashboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ identifier, code }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? 'Invalid or expired code')
  }
  const data = (await res.json()) as AuthResponse
  persistAuth(data)
  return data
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await authApi.getMe()
  localStorage.setItem(USER_KEY, JSON.stringify(data))
  return data
}

export async function refreshToken(): Promise<AuthResponse> {
  const tokens = await authApi.refreshToken()
  setAccessToken(tokens.accessToken)
  if (typeof window !== "undefined") {
    const storageType = localStorage.getItem(TOKEN_STORAGE_KEY)
    const storage = storageType === "session" ? sessionStorage : localStorage
    storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  }
  const cached = getStoredUser()
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    user: cached as UserPayload,
  }
}

export async function logoutApi(): Promise<void> {
  try {
    await authApi.logout()
  } catch {
    // Ignore — clear local state regardless
  }
  clearAuth()
}

export function logout(): void {
  clearAuth()
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await authApi.changePassword({ currentPassword, newPassword })
}

export async function requestStaffPasswordReset(email: string): Promise<void> {
  await authApi.requestStaffPasswordReset(email)
}

export async function performStaffPasswordReset(
  token: string,
  newPassword: string,
): Promise<void> {
  await authApi.performStaffPasswordReset(token, newPassword)
}

export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch('/api/proxy/auth/request-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? 'Failed to send reset link')
  }
}

export async function performPasswordReset(token: string, newPassword: string): Promise<void> {
  const res = await fetch('/api/proxy/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { message?: string }).message ?? 'Failed to reset password')
  }
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}


function persistAuth(data: AuthResponse, rememberMe?: boolean): void {
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  setAccessToken(data.accessToken)

  if (typeof window !== "undefined") {
    if (rememberMe) {
      localStorage.setItem(TOKEN_STORAGE_KEY, "local")
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken)
      sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    } else {
      localStorage.setItem(TOKEN_STORAGE_KEY, "session")
      sessionStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken)
      localStorage.removeItem(ACCESS_TOKEN_KEY)
    }
  }
}

function clearAuth(): void {
  localStorage.removeItem(USER_KEY)
  setAccessToken(null)
  if (typeof window !== "undefined") {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  }
}
