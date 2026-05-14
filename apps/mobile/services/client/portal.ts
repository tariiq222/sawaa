import api from '../api';

/** Single booking row inside the home/upcoming portal endpoints. Shape is
 *  produced by booking-row.mapper.ts on the backend — only the fields the
 *  mobile portal screens actually read are typed here. */
export interface PortalBookingRow {
  id: string;
  date: string;        // YYYY-MM-DD (UTC)
  startTime: string;   // HH:MM (UTC)
  endTime: string;     // HH:MM (UTC)
  status: string;
  type: string;        // 'in_person' | 'online' | ...
  zoomJoinUrl: string | null;
  scheduledAt?: string;
  employee: {
    id: string;
    user: { firstName: string; lastName: string };
    specialty: string;
    specialtyAr: string;
  } | null;
  service: {
    id: string;
    nameAr: string;
    nameEn: string;
    price: number;
    duration: number;
  } | null;
}

export interface PortalNotificationRow {
  id: string;
  title: string | null;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface PortalProfile {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
}

export interface PortalHomeResponse {
  profile: PortalProfile | null;
  upcomingBookings: PortalBookingRow[];
  unreadNotifications: PortalNotificationRow[];
  recentPayments: Array<{ id: string; amount: number; status: string; createdAt: string }>;
}

export interface PortalSummary {
  totalBookings: number;
  lastVisit: string | null;        // ISO datetime
  outstandingBalance: number;      // SAR (not halalat)
}

export const clientPortalService = {
  async getHome(): Promise<PortalHomeResponse> {
    const res = await api.get<PortalHomeResponse>('/mobile/client/portal/home');
    return res.data;
  },

  async getSummary(): Promise<PortalSummary> {
    const res = await api.get<PortalSummary>('/mobile/client/portal/summary');
    return res.data;
  },

  async getUpcoming(page = 1, limit = 10) {
    const res = await api.get<{ data: PortalBookingRow[]; meta: { total: number; page: number; limit: number; totalPages: number } }>(
      '/mobile/client/portal/upcoming',
      { params: { page, limit } },
    );
    return res.data;
  },
};
