import { apiRequest } from '../client'
import type { PaginatedResponse } from '../types/api'
import type {
  ContactMessage,
  ContactMessageStatus,
  CreateContactMessagePayload,
} from '../types/public-directory'

export async function submit(
  payload: CreateContactMessagePayload,
): Promise<{ id: string; createdAt: string; status: ContactMessageStatus }> {
  return apiRequest('/public/contact-messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function list(query: { page?: number; limit?: number; status?: ContactMessageStatus } = {}): Promise<PaginatedResponse<ContactMessage>> {
  const params = new URLSearchParams()
  if (query.page) params.set('page', String(query.page))
  if (query.limit) params.set('limit', String(query.limit))
  if (query.status) params.set('status', query.status)
  const qs = params.toString()
  return apiRequest<PaginatedResponse<ContactMessage>>(
    `/dashboard/comms/contact-messages${qs ? `?${qs}` : ''}`,
  )
}

export async function updateStatus(
  id: string,
  status: ContactMessageStatus,
): Promise<ContactMessage> {
  return apiRequest<ContactMessage>(`/dashboard/comms/contact-messages/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
