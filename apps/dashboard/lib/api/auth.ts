/**
 * Auth API — Sawaa Dashboard
 *
 * Thin wrapper over @sawaa/api-client/authApi. The shared package owns
 * request shape, envelope unwrapping, and 401 retry logic; this file only
 * adds persist/clear localStorage helpers and dashboard-specific aliases.
 */

import { authApi } from "@sawaa/api-client"
import type { AuthResponse, UserPayload } from "@sawaa/api-client"
import { clearLegacyAccessTokenStorage, setAccessToken } from "@/lib/api"

export type AuthUser = UserPayload
export type { AuthResponse }

const USER_KEY = "sawaa_user"

// Minimal, non-PII subset cached in localStorage as a hydration hint for the
// auth UI before the first /me round-trip lands. Full UserPayload (with email,
// phone, firstName, lastName, etc.) is never persisted to storage because
// localStorage is XSS-readable; the canonical user is held in the in-memory
// AuthProvider state, sourced from /me on every load.
type CachedUserHint = Pick<UserPayload, "id" | "role" | "isSuperAdmin">

function toCachedHint(u: UserPayload): CachedUserHint {
  return {
    id: u.id,
    role: u.role,
    isSuperAdmin: u.isSuperAdmin,
  }
}

export async function login(
  identifier: string,
  password: string,
  rememberMe?: boolean,
): Promise<AuthResponse> {
  const data = await authApi.login({ email: identifier, password, rememberMe })
  persistAuth(data)
  return data
}

export async function requestDashboardOtp(identifier: string): Promise<{ success: boolean }> {
  // Delegates to the typed @sawaa/api-client module so the central envelope
  // unwrap, refresh-mutex and CSRF behaviour are applied uniformly.
  await authApi.requestDashboardOtp({ email: identifier })
  return { success: true }
}

export async function verifyDashboardOtp(identifier: string, code: string): Promise<AuthResponse> {
  const data = await authApi.verifyDashboardOtp({ email: identifier, code })
  persistAuth(data)
  return data
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await authApi.getMe()
  localStorage.setItem(USER_KEY, JSON.stringify(toCachedHint(data)))
  return data
}

export async function refreshToken(): Promise<AuthResponse> {
  const tokens = await authApi.refreshToken()
  setAccessToken(tokens.accessToken)
  clearLegacyAccessTokenStorage()
  // Caller is responsible for invoking fetchMe() to repopulate the full user
  // payload; we only return the token portion plus the minimal hint we kept
  // in storage (no PII). Returning a partial UserPayload shape preserves the
  // AuthResponse contract without re-exposing email/phone from localStorage.
  const hint = getStoredUserHint()
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    user: (hint ? { ...hint } : { id: "", role: "" }) as UserPayload,
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

export async function lookupUser(identifier: string): Promise<{ exists: boolean; hasPassword: boolean; identifier: string; channel: string }> {
  // Backend returns { exists, emailVerificationRequired }; the dashboard
  // callers only care about the boolean `exists` so we project to keep
  // backwards compatibility with existing call sites.
  const res = await authApi.lookupUser({ identifier })
  return {
    exists: res.exists,
    hasPassword: res.exists, // best-effort: the user exists in the staff table
    identifier,
    channel: 'email',
  }
}

// Note: legacy requestPasswordReset/performPasswordReset were removed — the
// dashboard uses the staff variants (requestStaffPasswordReset,
// performStaffPasswordReset) via the @sawaa/api-client auth module.

/**
 * @deprecated PII is no longer persisted to localStorage. This now returns
 * only the non-sensitive subset previously stored. Consumers needing the
 * full user payload must read from the AuthProvider context (in-memory).
 */
export function getStoredUser(): AuthUser | null {
  const hint = getStoredUserHint()
  return hint ? ({ ...hint } as AuthUser) : null
}

export function getStoredUserHint(): CachedUserHint | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<CachedUserHint>
    if (!parsed || typeof parsed.id !== "string") return null
    return {
      id: parsed.id,
      role: typeof parsed.role === "string" ? parsed.role : "",
      isSuperAdmin: parsed.isSuperAdmin === true,
    }
  } catch {
    return null
  }
}


function persistAuth(data: AuthResponse): void {
  // Persist only the non-PII hint; the full UserPayload (email, phone, name)
  // stays in memory and is re-fetched via /me on each app load.
  localStorage.setItem(USER_KEY, JSON.stringify(toCachedHint(data.user)))
  setAccessToken(data.accessToken)
  clearLegacyAccessTokenStorage()
}

function clearAuth(): void {
  localStorage.removeItem(USER_KEY)
  setAccessToken(null)
  clearLegacyAccessTokenStorage()
}
