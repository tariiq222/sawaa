/**
 * Website client-auth API — thin wrapper around @sawaa/api-client modules.
 *
 * The shared package owns request shape, envelope unwrapping, and error
 * formatting. This file only re-exports under the historical *Api names so
 * existing callers (auth-store, login-form, register-form, etc.) keep
 * working without changes.
 */

import {
  apiRequest,
  setClientBaseUrl,
  clientLogin,
  clientRegister,
  clientResetPassword,
  setMeBaseUrl,
  getMyBookings,
  cancelMyBooking,
  getMyCancellationPreview,
  rescheduleMyBooking,
} from '@sawaa/api-client'
import type { CancellationQuoteInput, ClientCancellationResult, PersistedCancellationRefund, ClientLoginRequest } from '@sawaa/api-client'
import type {
  ClientAuthResponse,
  ClientRegisterPayload,
  ClientProfile,
  ClientBookingItem,
  ClientBookingListResponse,
} from '@sawaa/shared'

import { getApiBase } from '@/lib/api-base'

const AUTH_REQUEST_TIMEOUT_MS = 10_000

// Initialise the shared modules once with the website's API base. We pass a
// no-op refresh-token getter because the website uses an httpOnly cookie for
// refresh — the browser sends it automatically on `credentials: 'include'`.
let initialised = false
function ensureInitialised(): void {
  if (initialised) return
  const base = getApiBase()
  setClientBaseUrl(base)
  setMeBaseUrl(base)
  // initClientAuth removed — refresh token is now handled via httpOnly cookie
  initialised = true
}

export async function clientLoginApi(
  payload: ClientLoginRequest,
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

export async function getMeApi(callerSignal?: AbortSignal): Promise<ClientProfile> {
  ensureInitialised()
  return withAuthDeadline(
    (signal) => apiRequest<ClientProfile>('/public/me', {
      credentials: 'include',
      signal,
    }),
    callerSignal,
  )
}

export async function getMyBookingsApi(
  page = 1,
  pageSize = 10,
  tab?: 'upcoming' | 'past' | 'cancelled',
): Promise<ClientBookingListResponse> {
  ensureInitialised()
  return tab ? getMyBookings(page, pageSize, tab) : getMyBookings(page, pageSize)
}

export async function getMyBookingApi(bookingId: string): Promise<ClientBookingItem & { cancellationRefund?: PersistedCancellationRefund }> {
  ensureInitialised()
  return apiRequest<ClientBookingItem & { cancellationRefund?: PersistedCancellationRefund }>(`/public/me/bookings/${encodeURIComponent(bookingId)}`, {
    credentials: 'include',
  })
}

export async function getMyCancellationPreviewApi(bookingId: string) {
  ensureInitialised()
  return getMyCancellationPreview(bookingId)
}

export async function cancelMyBookingApi(
  bookingId: string,
  reason?: string,
  quote?: CancellationQuoteInput,
): Promise<Omit<ClientCancellationResult, 'booking'>> {
  ensureInitialised()
  if (!quote) throw new Error('Cancellation preview consent is required')
  const result = await cancelMyBooking(bookingId, { reason, ...quote })
  return { status: result.status, requiresApproval: result.requiresApproval, ...(result.refund ? { refund: result.refund } : {}) }
}

export async function rescheduleMyBookingApi(
  bookingId: string,
  newScheduledAt: string,
  newDurationMins?: number,
): Promise<{ booking: unknown }> {
  ensureInitialised()
  return rescheduleMyBooking(bookingId, { newScheduledAt, newDurationMins })
}

export async function clientLogoutApi(callerSignal?: AbortSignal): Promise<void> {
  ensureInitialised()
  await withAuthDeadline(
    (signal) => apiRequest<void>('/public/auth/logout', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({}),
      signal,
    }),
    callerSignal,
  )
}

async function withAuthDeadline<T>(
  request: (signal: AbortSignal) => Promise<T>,
  callerSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController()
  let rejectDeadline!: (reason: unknown) => void
  const deadline = new Promise<never>((_resolve, reject) => {
    rejectDeadline = reject
  })
  const abort = (reason: unknown) => {
    const error = reason ?? new DOMException('Request aborted', 'AbortError')
    rejectDeadline(error)
    controller.abort(error)
  }
  const forwardCallerAbort = () => abort(callerSignal?.reason)

  if (callerSignal?.aborted) {
    forwardCallerAbort()
  } else {
    callerSignal?.addEventListener('abort', forwardCallerAbort, { once: true })
  }

  const timeout = setTimeout(() => {
    abort(new DOMException('Request timed out', 'TimeoutError'))
  }, AUTH_REQUEST_TIMEOUT_MS)

  try {
    return await Promise.race([request(controller.signal), deadline])
  } finally {
    clearTimeout(timeout)
    callerSignal?.removeEventListener('abort', forwardCallerAbort)
  }
}

export async function clientResetPasswordApi(payload: {
  sessionToken: string
  newPassword: string
}): Promise<void> {
  ensureInitialised()
  return clientResetPassword(payload)
}
