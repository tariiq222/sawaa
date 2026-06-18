import api from '../api';

export interface GroupSession {
  id: string;
  title: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  scheduledAt: string;
  durationMins: number;
  maxCapacity: number;
  enrolledCount: number;
  price: number;
  currency: string;
  status: string;
  employeeId: string;
  serviceId: string;
  spotsLeft: number;
  isFull: boolean;
}

export interface BookGroupSessionResponse {
  type: 'BOOKED';
  bookingId?: string;
}

/** Public endpoints answer raw or `{ success, data }`-enveloped depending on
 *  interceptors — tolerate both, like the website's `json.data ?? json`. */
function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in (body as Record<string, unknown>)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export const groupSessionsService = {
  async list(branchId?: string): Promise<GroupSession[]> {
    const response = await api.get<unknown>('/public/bookings/group-sessions', {
      params: branchId ? { branchId } : undefined,
    });
    return unwrap<GroupSession[]>(response.data);
  },

  async get(id: string): Promise<GroupSession> {
    const response = await api.get<unknown>(`/public/bookings/group-sessions/${id}`);
    return unwrap<GroupSession>(response.data);
  },

  async book(id: string): Promise<BookGroupSessionResponse> {
    const response = await api.post<unknown>(`/public/bookings/group-sessions/${id}/book`);
    return unwrap<BookGroupSessionResponse>(response.data);
  },
};
