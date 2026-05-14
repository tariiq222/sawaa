import { apiRequest } from '../client'

export interface PublicGroupSession {
  id: string
  organizationId: string
  branchId?: string | null
  serviceId: string
  employeeId?: string | null
  scheduledAt: string
  durationMinutes: number
  capacity: number
  enrolled: number
  price: string
  currency: string
  status: string
}

export async function list(branchId?: string): Promise<PublicGroupSession[]> {
  const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''
  return apiRequest<PublicGroupSession[]>(`/public/bookings/group-sessions${qs}`)
}

export async function get(id: string): Promise<PublicGroupSession> {
  return apiRequest<PublicGroupSession>(`/public/bookings/group-sessions/${id}`)
}

export interface BookGroupSessionResponse {
  bookingId: string
  status: string
  waitlisted?: boolean
}

export async function book(id: string): Promise<BookGroupSessionResponse> {
  return apiRequest<BookGroupSessionResponse>(
    `/public/bookings/group-sessions/${id}/book`,
    { method: 'POST' },
  )
}
