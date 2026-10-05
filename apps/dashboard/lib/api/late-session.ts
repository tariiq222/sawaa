import { api } from '@/lib/api'
import type {
  RecordLateSessionPayload,
  RecordLateSessionResponse,
} from '@/lib/types/late-session'
export function recordLateSession(payload: RecordLateSessionPayload) {
  return api.post<RecordLateSessionResponse>(
    '/dashboard/bookings/late-entry',
    payload
  )
}

export interface LateSessionContext {
  vatRate: number
  paymentMethods: import('@/lib/types/late-session').LatePaymentMethod[]
}

export function fetchLateSessionContext() {
  return api.get<LateSessionContext>('/dashboard/bookings/late-entry/context')
}
