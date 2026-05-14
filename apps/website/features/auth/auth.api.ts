/**
 * Website client-auth API — thin wrapper around @sawaa/api-client modules.
 *
 * The shared package owns request shape, envelope unwrapping, and error
 * formatting. This file only re-exports under the historical *Api names so
 * existing callers (auth-store, login-form, register-form, etc.) keep
 * working without changes.
 */

import {
  setClientBaseUrl,
  initClientAuth,
  clientLogin,
  clientRegister,
  clientLogout,
  clientResetPassword,
  setMeBaseUrl,
  getMe,
  getMyBookings,
  cancelMyBooking,
  rescheduleMyBooking,
} from '@sawaa/api-client'
import type {
  ClientAuthResponse,
  ClientLoginPayload,
  ClientRegisterPayload,
  ClientProfile,
  ClientBookingListResponse,
} from '@sawaa/shared'

import { getApiBase } from '@/lib/api-base'

// Initialise the shared modules once with the website's API base. We pass a
// no-op refresh-token getter because the website uses an httpOnly cookie for
// refresh — the browser sends it automatically on `credentials: 'include'`.
let initialised = false
function ensureInitialised(): void {
  if (initialised) return
  const base = getApiBase()
  setClientBaseUrl(base)
  setMeBaseUrl(base)
  initClientAuth({ getRefreshToken: () => null })
  initialised = true
}

export async function clientLoginApi(
  payload: ClientLoginPayload,
): Promise<ClientAuthResponse> {
  ensureInitialised()
  return clientLogin(payload)
}

export async function clientRegisterApi(
  payload: ClientRegisterPayload,
): Promise<ClientAuthResponse> {
  ensureInitialised()
  return clientRegister(payload)
}

export async function getMeApi(): Promise<ClientProfile> {
  ensureInitialised()
  return getMe()
}

export async function getMyBookingsApi(
  page = 1,
  pageSize = 10,
): Promise<ClientBookingListResponse> {
  ensureInitialised()
  return getMyBookings(page, pageSize)
}

export async function cancelMyBookingApi(
  bookingId: string,
  reason?: string,
): Promise<{ status: string; requiresApproval: boolean }> {
  ensureInitialised()
  const result = await cancelMyBooking(bookingId, { reason })
  return { status: result.status, requiresApproval: result.requiresApproval }
}

export async function rescheduleMyBookingApi(
  bookingId: string,
  newScheduledAt: string,
  newDurationMins?: number,
): Promise<{ booking: unknown }> {
  ensureInitialised()
  return rescheduleMyBooking(bookingId, { newScheduledAt, newDurationMins })
}

export async function clientLogoutApi(): Promise<void> {
  ensureInitialised()
  await clientLogout()
}

export async function clientResetPasswordApi(payload: {
  sessionToken: string
  newPassword: string
}): Promise<void> {
  ensureInitialised()
  return clientResetPassword(payload)
}
