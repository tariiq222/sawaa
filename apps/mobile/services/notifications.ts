import api from './api';
import type { ApiResponse } from '@/types/api';
import type { Notification } from '@/types/models';
import { readListEnvelope, type ListMeta } from './client/list-envelope';

interface NotificationParams {
  page?: number;
  perPage?: number;
  unreadOnly?: boolean;
}

export interface NotificationListResponse {
  items: Notification[];
  meta: ListMeta;
}

// The backend stores already-rendered title/body, while older app payloads
// supplied localized fields. Normalize both shapes before UI consumers see them.
type NotificationPayload = Omit<Notification, 'userId' | 'titleAr' | 'titleEn' | 'bodyAr' | 'bodyEn'> & {
  recipientId?: string;
  userId?: string;
  title?: string | null;
  body?: string | null;
  titleAr?: string | null;
  titleEn?: string | null;
  bodyAr?: string | null;
  bodyEn?: string | null;
};

function firstText(...values: Array<string | null | undefined>): string {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0) ?? '';
}

function normalizeNotification(item: NotificationPayload): Notification {
  return {
    ...item,
    // The backend enum is UPPER_SNAKE_CASE (BOOKING_CONFIRMED); every consumer
    // in the app matches the lower-case form.
    type: String(item.type ?? '').toLowerCase() as Notification['type'],
    userId: item.userId ?? item.recipientId ?? '',
    titleAr: firstText(item.titleAr, item.title, item.titleEn),
    titleEn: firstText(item.titleEn, item.title, item.titleAr),
    bodyAr: firstText(item.bodyAr, item.body, item.bodyEn),
    bodyEn: firstText(item.bodyEn, item.body, item.bodyAr),
  };
}

const BASE = '/client/notifications';

export const notificationsService = {
  async getAll(params?: NotificationParams): Promise<NotificationListResponse> {
    const { perPage, ...rest } = params ?? {};
    const response = await api.get<unknown>(BASE, {
      params: { ...rest, ...(perPage ? { pageSize: perPage } : {}) },
    });
    // Canonical `{ items, total, page, pageSize }`; legacy `{ items, meta }` still accepted.
    const { items, meta } = readListEnvelope<NotificationPayload>(response.data, perPage ?? 20);
    return { items: items.map(normalizeNotification), meta };
  },

  async getUnreadCount(): Promise<{ count: number }> {
    const response = await api.get<{ count: number }>(`${BASE}/unread-count`);
    return response.data;
  },

  async markAllRead(): Promise<void> {
    await api.patch(`${BASE}/mark-read`);
  },

  async markRead(id: string): Promise<void> {
    await api.patch(`${BASE}/mark-read`, { notificationId: id });
  },

  async registerFcmToken(token: string, platform: 'ios' | 'android') {
    const response = await api.post<ApiResponse<unknown>>(
      `${BASE}/fcm-token`,
      { token, platform },
    );
    return response.data;
  },

  async unregisterFcmToken(token?: string) {
    const response = await api.delete<ApiResponse<{ deleted: number }>>(
      `${BASE}/fcm-token`,
      { params: token ? { token } : undefined },
    );
    return response.data;
  },
};
