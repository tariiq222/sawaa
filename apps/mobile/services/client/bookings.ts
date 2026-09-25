import api from '../api';
import type {
  BookingStatus,
  BookingType,
  DeliveryType,
  LegacyBookingType,
} from '@/types/booking-enums';

export type { BookingStatus, BookingType, DeliveryType };

export interface ClientBookingRow {
  id: string;
  invoiceId: string | null;
  invoiceStatus?: string | null;
  paymentStatus?: string | null;
  price?: number | string;
  currency?: string;
  serviceName?: string;
  serviceNameAr?: string | null;
  employeeName?: string;
  employeeNameAr?: string | null;
  branchName?: string;
  branchNameAr?: string | null;
  scheduledAt: string;
  durationMins: number;
  status: BookingStatus;
  /** Appointment/category type. Legacy payloads may still send delivery here. */
  bookingType?: LegacyBookingType;
  /** Legacy alias used by dashboard mapper shapes. */
  type?: LegacyBookingType;
  /** Session delivery channel. Prefer this over bookingType/type for online UI. */
  deliveryType?: DeliveryType | null;
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
  zoomLink?: string | null;
  zoomMeetingStatus: 'PENDING' | 'CREATED' | 'FAILED' | 'CANCELLED' | null;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' ? value as UnknownRecord : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeStatus(value: unknown): BookingStatus {
  const status = stringValue(value)?.toLowerCase() ?? 'pending';
  if (status === 'awaiting_payment' || status === 'pending_group_fill') return 'pending';
  if (status === 'deposit_paid') return 'deposit_paid';
  return status as BookingStatus;
}

function normalizeScheduledAt(row: UnknownRecord): string {
  const direct = stringValue(row.scheduledAt);
  if (direct) return direct.startsWith('2999-') ? '' : direct;
  const date = stringValue(row.date);
  if (!date || date.startsWith('2999-')) return '';
  const start = stringValue(row.startTime);
  if (!start || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) return '';
  // The mapper formats date/startTime in the business timezone (Asia/Riyadh).
  // Keep that offset explicit so devices in another timezone do not shift the
  // appointment when they parse the reconstructed ISO value.
  return `${date}T${start}:00+03:00`;
}

function normalizeMeetingStatus(value: unknown): ClientBookingRow['zoomMeetingStatus'] {
  const status = stringValue(value)?.toUpperCase();
  return status === 'PENDING' || status === 'CREATED' || status === 'FAILED' || status === 'CANCELLED'
    ? status
    : null;
}

/**
 * Adapts the actual mobile mapper response (`date`, `startTime`, nested
 * invoice/payment) while retaining compatibility with older flat mobile rows.
 */
export function normalizeClientBooking(raw: unknown): ClientBookingRow {
  const row = asRecord(raw) ?? {};
  // Older mobile endpoints already returned the app's canonical row. Keep
  // that object shape and identity untouched while adapting mapper rows below.
  if (stringValue(row.scheduledAt) && !stringValue(row.scheduledAt)?.startsWith('2999-')
    && !('date' in row) && !('invoice' in row) && !('payment' in row)) {
    return raw as ClientBookingRow;
  }
  const invoice = asRecord(row.invoice);
  const payment = asRecord(row.payment);
  const employee = asRecord(row.employee);
  const employeeUser = asRecord(employee?.user);
  const service = asRecord(row.service);
  const branchName = stringValue(row.branchName) ?? stringValue(row.branchNameSnapshot);
  const branchNameAr = stringValue(row.branchNameAr) ?? stringValue(row.branchNameSnapshot);
  const serviceName = stringValue(row.serviceName) ?? stringValue(service?.nameEn) ?? stringValue(row.categoryNameSnapshot) ?? '';
  const serviceNameAr = stringValue(row.serviceNameAr) ?? stringValue(service?.nameAr) ?? stringValue(row.categoryNameSnapshot);
  const employeeUserName = [stringValue(employeeUser?.firstName), stringValue(employeeUser?.lastName)]
    .filter((name): name is string => Boolean(name)).join(' ') || null;
  const employeeName = stringValue(row.employeeName) ?? employeeUserName
    ?? stringValue(employee?.nameEn) ?? '';
  const employeeNameAr = stringValue(row.employeeNameAr) ?? employeeUserName
    ?? stringValue(employee?.nameAr);
  const invoiceId = stringValue(invoice?.id) ?? stringValue(row.invoiceId);
  const invoiceStatus = stringValue(invoice?.status) ?? stringValue(row.invoiceStatus);
  const paymentStatus = stringValue(payment?.status) ?? stringValue(row.paymentStatus);
  const price = numberValue(row.price) ?? numberValue(row.priceSnapshot) ?? numberValue(service?.price);
  const durationMins = numberValue(row.durationMins) ?? numberValue(row.durationMinutesSnapshot)
    ?? numberValue(service?.duration) ?? 0;

  return {
    id: stringValue(row.id) ?? '',
    invoiceId,
    invoiceStatus,
    paymentStatus,
    price: price ?? undefined,
    currency: stringValue(row.currency) ?? 'SAR',
    serviceName,
    serviceNameAr,
    employeeName,
    employeeNameAr,
    branchName: branchName ?? undefined,
    branchNameAr,
    scheduledAt: normalizeScheduledAt(row),
    durationMins,
    status: normalizeStatus(row.status),
    bookingType: stringValue(row.bookingType) as LegacyBookingType | undefined,
    type: stringValue(row.type) as LegacyBookingType | undefined,
    deliveryType: stringValue(row.deliveryType) as DeliveryType | null | undefined,
    employeeId: stringValue(row.employeeId) ?? stringValue(employee?.id) ?? '',
    employee: employee
      ? {
          id: stringValue(employee.id) ?? '',
          nameAr: employeeNameAr,
          nameEn: employeeName,
          avatarUrl: stringValue(employee.avatarUrl),
        }
      : null,
    branchId: stringValue(row.branchId) ?? '',
    branch: branchName || branchNameAr
      ? { id: stringValue(row.branchId) ?? '', nameAr: branchNameAr, nameEn: branchName }
      : null,
    serviceId: stringValue(row.serviceId) ?? stringValue(service?.id),
    service: service
      ? {
          id: stringValue(service.id) ?? '',
          nameAr: stringValue(service.nameAr),
          nameEn: stringValue(service.nameEn),
        }
      : null,
    zoomJoinUrl: stringValue(row.zoomJoinUrl),
    zoomStartUrl: stringValue(row.zoomStartUrl),
    zoomLink: stringValue(row.zoomLink),
    zoomMeetingStatus: normalizeMeetingStatus(row.zoomMeetingStatus),
  };
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
  /**
   * Session channel chosen in the booking flow (the service/duration option
   * pair is IN_PERSON | ONLINE). Sent UPPERCASE because the backend validates
   * it against the Prisma `DeliveryType` enum — the same boundary rule as
   * `status`, see `upperStatus` below.
   */
  deliveryType?: DeliveryType;
}

interface ListParams {
  tab?: 'upcoming' | 'past' | 'cancelled';
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
    const response = await api.get<unknown>(
      '/mobile/client/bookings',
      { params: outgoing },
    );
    const body = asRecord(response.data) ?? {};
    const meta = asRecord(body.meta) ?? {};
    const items = Array.isArray(body.items) ? body.items.map(normalizeClientBooking) : [];
    const limit = numberValue(meta.limit) ?? numberValue(meta.perPage) ?? 10;
    return {
      items,
      meta: {
        total: numberValue(meta.total) ?? items.length,
        page: numberValue(meta.page) ?? 1,
        perPage: limit,
        totalPages: numberValue(meta.totalPages) ?? 1,
        hasNextPage: Boolean(meta.hasNextPage),
        hasPreviousPage: Boolean(meta.hasPreviousPage),
      },
    } satisfies BookingsListResponse;
  },

  async getById(id: string) {
    const response = await api.get<unknown>(`/mobile/client/bookings/${id}`);
    return normalizeClientBooking(response.data);
  },

  async create(data: CreateBookingData) {
    // The app models delivery in lowercase; the backend `MobileCreateBookingDto`
    // validates the Prisma enum, so convert at the request boundary. Omitting it
    // entirely would make the server default the session to IN_PERSON and drop
    // the ONLINE choice the client made.
    const payload = data.deliveryType === undefined
      ? data
      : { ...data, deliveryType: data.deliveryType.toUpperCase() };
    const response = await api.post<unknown>('/mobile/client/bookings', payload);
    return normalizeClientBooking(response.data);
  },

  async cancel(id: string, cancelNotes?: string) {
    const response = await api.patch<unknown>(
      `/mobile/client/bookings/${id}/cancel`,
      {
        reason: 'CLIENT_REQUESTED',
        ...(cancelNotes ? { cancelNotes } : {}),
      },
    );
    return normalizeClientBooking(response.data);
  },

  async reschedule(id: string, newScheduledAt: string) {
    const response = await api.patch<unknown>(
      `/mobile/client/bookings/${id}/reschedule`,
      { newScheduledAt },
    );
    return normalizeClientBooking(response.data);
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
