import api from './api';
import type {
  BookingStatus,
  BookingType,
  DeliveryType,
  LegacyBookingType,
} from '@/types/booking-enums';

export interface ClientRecord {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
}

interface EmployeeClientListResponse {
  data: ClientRecord[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/** Raw Prisma-shaped rows returned by the employee client history endpoint. */
export interface EmployeeClientHistoryRow {
  id: string;
  clientId: string;
  employeeId: string;
  bookingType: string;
  deliveryType: string;
  status: string;
  scheduledAt: string;
  durationMins: number;
}

/** Small mobile view model used by the employee client record screen. */
export interface EmployeeClientVisit {
  id: string;
  clientId: string;
  employeeId: string;
  bookingType: BookingType;
  deliveryType: DeliveryType;
  type: LegacyBookingType;
  status: BookingStatus;
  scheduledAt: string;
  date: string;
  durationMins: number;
}

const BOOKING_TYPES: BookingType[] = ['individual', 'walk_in', 'group'];
const DELIVERY_TYPES: DeliveryType[] = ['in_person', 'online'];
const BOOKING_STATUSES: BookingStatus[] = [
  'pending', 'pending_group_fill', 'awaiting_payment', 'confirmed',
  'completed', 'cancelled', 'cancel_requested', 'no_show', 'expired',
];

function normalizeEnum<T extends string>(value: string, allowed: T[], fallback: T): T {
  const normalized = value.toLowerCase() as T;
  return allowed.includes(normalized) ? normalized : fallback;
}

export function mapEmployeeClientHistoryRow(row: EmployeeClientHistoryRow): EmployeeClientVisit {
  const bookingType = normalizeEnum(row.bookingType, BOOKING_TYPES, 'individual');
  const deliveryType = normalizeEnum(row.deliveryType, DELIVERY_TYPES, 'in_person');
  const status = normalizeEnum(row.status, BOOKING_STATUSES, 'pending');
  return {
    id: row.id,
    clientId: row.clientId,
    employeeId: row.employeeId,
    bookingType,
    deliveryType,
    type: bookingType,
    status,
    scheduledAt: row.scheduledAt,
    date: row.scheduledAt,
    durationMins: row.durationMins,
  };
}

export const clientsService = {
  async getById(clientId: string) {
    const response = await api.get<ClientRecord>(`/mobile/employee/clients/${clientId}`);
    return response.data;
  },

  async getEmployeeBookings(clientId: string) {
    const response = await api.get<EmployeeClientHistoryRow[]>(`/mobile/employee/clients/${clientId}/history`);
    return response.data.map(mapEmployeeClientHistoryRow);
  },

  async getAll(params?: { search?: string; page?: number; limit?: number }) {
    const response = await api.get<EmployeeClientListResponse>(
      '/mobile/employee/clients',
      { params },
    );
    return response.data;
  },
};
