/**
 * Website account API — thin wrapper around @sawaa/api-client modules,
 * mirroring the naming style of features/auth/auth.api.ts. Auth is the
 * httpOnly client-session cookie (`credentials: 'include'`).
 */

import {
  setMeBaseUrl,
  updateMyProfile,
  getMyInvoices,
  requestRefund,
} from '@sawaa/api-client'
import type { UpdateMyProfileRequest } from '@sawaa/api-client'
import type {
  ClientProfile,
  ClientInvoiceListResponse,
} from '@sawaa/shared'

import { getApiBase } from '@/lib/api-base'

let initialised = false
function ensureInitialised(): void {
  if (initialised) return
  setMeBaseUrl(getApiBase())
  initialised = true
}

export async function updateMyProfileApi(
  payload: UpdateMyProfileRequest,
): Promise<ClientProfile> {
  ensureInitialised()
  return updateMyProfile(payload)
}

export async function getMyInvoicesApi(
  page = 1,
  pageSize = 50,
): Promise<ClientInvoiceListResponse> {
  ensureInitialised()
  return getMyInvoices(page, pageSize)
}

export async function requestRefundApi(
  invoiceId: string,
  reason?: string,
): Promise<unknown> {
  ensureInitialised()
  return requestRefund(invoiceId, reason)
}
