import api from '../api';
import type { BookingStatus, BookingType } from '@/types/booking-enums';

export type { BookingStatus, BookingType };

export interface ClientBookingRow {
  id: string;
  invoiceId: string | null;
  scheduledAt: string;
  durationMins: number;
  status: BookingStatus;
  bookingType: BookingType;
  employeeId: string;
  employee?: {
    id: string;
    nameAr: string | null;
    nameEn: string | null;
    avatarUrl: string | null;
  } | null;
  branchId: string;
  branch?: {
    id: string;
    nameAr: string | null;
    nameEn: string | null;
  } | null;
  serviceId: string | null;
  service?: {
    id: string;
    nameAr: string | null;
    nameEn: string | null;
  } | null;
  zoomJoinUrl: string | null;
  zoomStartUrl: string | null;
  zoomMeetingStatus: 'PENDING' | 'CREATED' | 'FAILED' | 'CANCELLED' | null;
}

export interface BookingsListResponse {
  items: ClientBookingRow[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/** Matches backend MobileCreateBookingDto exactly. */
interface CreateBookingData {
  branchId: string;
  employeeId: string;
  serviceId: string;
  scheduledAt: string;
  durationOptionId?: string;
  notes?: string;
}

interface ListParams {
  status?: string | string[];
  page?: number;
  limit?: number;
}

/**
 * The backend `MobileListBookingsDto` validates `status` against the Prisma
 * `BookingStatus` enum (UPPERCASE) and does NOT apply a class-transformer
 * `@Transform(toUpperCase)` like the dashboard DTO. So callers that pass the
 * canonical lowercase form (`'completed'`) would otherwise get a 400.
 *
 * We uppercase here at the request boundary; response payloads remain in the
 * canonical lowercase form (the mobile mapper handles that on the way back).
 */
function upperStatus(s: string | string[]): string | string[] {
  return Array.isArray(s) ? s.map((v) => v.toUpperCase()) : s.toUpperCase();
}

interface RateData {
  score: number;
  comment?: string;
  isPublic?: boolean;
}

export const clientBookingsService = {
  async list(params?: ListParams) {
    const outgoing = params?.status !== undefined
      ? { ...params, status: upperStatus(params.status) }
      : params;
    const response = await api.get<BookingsListResponse>(
      '/mobile/client/bookings',
      { params: outgoing },
    );
    return response.data;
  },

  async getById(id: string) {
    const response = await api.get<ClientBookingRow>(`/mobile/client/bookings/${id}`);
    return response.data;
  },

  async create(data: CreateBookingData) {
    const response = await api.post<ClientBookingRow>('/mobile/client/bookings', data);
    return response.data;
  },

  async cancel(id: string, reason: string) {
    const response = await api.post<ClientBookingRow>(
      `/mobile/client/bookings/${id}/cancel`,
      { reason },
    );
    return response.data;
  },

  async reschedule(id: string, scheduledAt: string) {
    const response = await api.patch<ClientBookingRow>(
      `/mobile/client/bookings/${id}/reschedule`,
      { scheduledAt },
    );
    return response.data;
  },

  async rate(id: string, data: RateData) {
    const response = await api.post(
      `/mobile/client/bookings/${id}/rate`,
      data,
    );
    return response.data;
  },

  async getJoinUrl(id: string) {
    const response = await api.get<{ joinUrl: string; scheduledAt: string }>(
      `/mobile/client/bookings/${id}/join`,
    );
    return response.data;
  },
};
