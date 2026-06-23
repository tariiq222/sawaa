import { apiRequest } from '../client'
import type {
  AuthResponse,
  ChangePasswordPayload,
  TokenPair,
  UserPayload,
} from '../types/auth'

export interface LoginPayload {
  email: string
  password: string
  rememberMe?: boolean
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function refreshToken(): Promise<TokenPair> {
  // CR-9: refresh token is an httpOnly cookie (ck_refresh); credentials: 'include'
  // sends it automatically. No token in body.
  return apiRequest<TokenPair>('/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({}),
  })
}

export async function logout(): Promise<void> {
  return apiRequest<void>('/auth/logout', { method: 'POST' })
}

export async function getMe(): Promise<UserPayload> {
  return apiRequest<UserPayload>('/auth/me')
}

export async function changePassword(
  payload: ChangePasswordPayload,
): Promise<void> {
  return apiRequest<void>('/auth/password/change', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function requestStaffPasswordReset(email: string): Promise<void> {
  return apiRequest<void>('/auth/request-password-reset', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function performStaffPasswordReset(
  token: string,
  newPassword: string,
): Promise<void> {
  return apiRequest<void>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  })
}

export type { AuthResponse, ChangePasswordPayload, TokenPair, UserPayload }

/* ─── OTP (dashboard) ─────────────────────────────────────────────────── */

export interface RequestDashboardOtpPayload {
  email: string
}

export interface RequestDashboardOtpResponse {
  /** Masked identifier returned by the backend (e.g. "a***@domain.com"). */
  maskedIdentifier: string
  /** Seconds until the OTP expires — useful for the UI countdown. */
  expiresInSeconds: number
}

export async function requestDashboardOtp(
  payload: RequestDashboardOtpPayload,
): Promise<RequestDashboardOtpResponse> {
  return apiRequest<RequestDashboardOtpResponse>('/auth/otp/request-dashboard', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export interface VerifyDashboardOtpPayload {
  email: string
  code: string
}

export async function verifyDashboardOtp(
  payload: VerifyDashboardOtpPayload,
): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/otp/verify-dashboard', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/* ─── Lookup (login helper) ───────────────────────────────────────────── */

export interface LookupUserPayload {
  identifier: string
}

export interface LookupUserResponse {
  /** Whether the email corresponds to a known user. */
  exists: boolean
  /** True when the user must complete email verification before login. */
  emailVerificationRequired: boolean
}

export async function lookupUser(
  payload: LookupUserPayload,
): Promise<LookupUserResponse> {
  return apiRequest<LookupUserResponse>('/auth/lookup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
