import api from './api';
import type { ApiResponse } from '@/types/api';
import type { Notification } from '@/types/models';

interface NotificationParams {
  page?: number;
  perPage?: number;
  unreadOnly?: boolean;
}

/**
 * Backend list responses follow the canonical `{ items, meta }` shape from
 * `apps/backend/src/common/dto/list-response.ts`. The global response is NOT
 * wrapped in `{ success, data }` — these endpoints return bare objects.
 */
interface NotificationListMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface NotificationListResponse {
  items: Notification[];
  meta: NotificationListMeta;
}

const BASE = '/mobile/client/notifications';

export const notificationsService = {
  async getAll(params?: NotificationParams): Promise<NotificationListResponse> {
    const { perPage, ...rest } = params ?? {};
    const response = await api.get<NotificationListResponse>(BASE, {
      params: { ...rest, ...(perPage ? { limit: perPage } : {}) },
    });
    return response.data;
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

  async unregisterFcmToken() {
    const response = await api.delete<ApiResponse<{ deleted: number }>>(
      `${BASE}/fcm-token`,
    );
    return response.data;
  },
};
