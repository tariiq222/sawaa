import api from '../api';
import type { Booking, BookingStatus, BookingType, DeliveryType } from '@/types/models';

// Employee-side booking calls. All endpoints live under `/mobile/employee/bookings/...`
// (see apps/backend/src/api/mobile/employee/bookings.controller.ts) and enforce
// ownership: the authenticated employee can only act on bookings assigned to them.

export interface CreateEmployeeBookingData {
  branchId: string;
  clientId: string;
  serviceId: string;
  scheduledAt: string;
  durationOptionId?: string;
  deliveryType: DeliveryType;
  /** Appointment/category type only. Never use for delivery channel. */
  bookingType?: BookingType;
  notes?: string;
}

interface GetBookingsParams {
  status?: BookingStatus;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface EmployeeBookingPage {
  items: Booking[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

function bookingTimestamp(booking: Pick<Booking, 'date' | 'startTime' | 'scheduledAt'>): number {
  // ListBookingsHandler returns clinic-local `date` + `startTime` fields.
  if (booking.date && booking.startTime) {
    return Date.parse(`${booking.date}T${booking.startTime}:00+03:00`);
  }
  return booking.scheduledAt ? Date.parse(booking.scheduledAt) : Number.NaN;
}

function sortByBookingTime(a: Booking, b: Booking) {
  return bookingTimestamp(a) - bookingTimestamp(b);
}

export function getEmployeeBusinessDateToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const UPCOMING_PAGE_LIMIT = 20;

async function listEmployeeBookings(params?: GetBookingsParams) {
  const response = await api.get<EmployeeBookingPage>('/mobile/employee/bookings', { params });
  return response.data;
}

async function findFirstUpcomingBooking(
  status: BookingStatus,
  fromDate: string,
  now: number,
) {
  let page = 1;

  while (true) {
    const response = await listEmployeeBookings({
      status,
      fromDate,
      page,
      limit: UPCOMING_PAGE_LIMIT,
    });
    const candidate = response.items
      .filter((booking) => bookingTimestamp(booking) >= now)
      .sort(sortByBookingTime)[0];

    if (candidate) return candidate;
    if (!response.meta.hasNextPage) return undefined;
    page += 1;
  }
}

export const employeeBookingsService = {
  async getAll(params?: GetBookingsParams) {
    return { success: true as const, data: await listEmployeeBookings(params) };
  },

  async getById(id: string) {
    const response = await api.get<Booking>(`/mobile/employee/bookings/${id}`);
    return { success: true as const, data: response.data };
  },

  async create(data: CreateEmployeeBookingData) {
    const response = await api.post<Booking>('/mobile/employee/bookings', data);
    return { success: true as const, data: response.data };
  },

  async requestCancellation(id: string, reason: string) {
    const response = await api.post<Booking>(
      `/mobile/employee/bookings/${id}/cancel-request`,
      { cancelNotes: reason },
    );
    return { success: true as const, data: response.data };
  },

  async markCompleted(id: string) {
    const response = await api.post<Booking>(
      `/mobile/employee/bookings/${id}/complete`,
    );
    return { success: true as const, data: response.data };
  },

  async getUpcoming() {
    const fromDate = getEmployeeBusinessDateToday();
    const now = Date.now();
    const candidates = await Promise.all(
      (['pending', 'confirmed'] as const).map((status) =>
        findFirstUpcomingBooking(status, fromDate, now)),
    );
    const nextBooking = candidates
      .filter((booking): booking is Booking => booking !== undefined)
      .sort(sortByBookingTime)[0];
    const items = nextBooking ? [nextBooking] : [];
    const total = items.length;
    return {
      success: true as const,
      data: {
        items,
        meta: {
          total,
          page: 1,
          limit: 1,
          totalPages: Math.max(1, Math.ceil(total / 1)),
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    };
  },

  async startSession(id: string) {
    const response = await api.post<Booking>(
      `/mobile/employee/bookings/${id}/start`,
    );
    return { success: true as const, data: response.data };
  },

  async employeeCancel(id: string, reason?: string) {
    const response = await api.post<Booking>(
      `/mobile/employee/bookings/${id}/employee-cancel`,
      { cancelNotes: reason },
    );
    return { success: true as const, data: response.data };
  },

  async getTodayBookings() {
    const response = await api.get<EmployeeBookingPage>(
      '/mobile/employee/schedule/today',
    );
    return { success: true as const, data: response.data };
  },
};
