import { useQuery } from '@tanstack/react-query';

import {
  notificationsService,
  type NotificationListResponse,
} from '@/services/notifications';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (params?: { page?: number; perPage?: number }) =>
    [...notificationKeys.all, 'list', params ?? {}] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
};

export function useNotifications(params?: { page?: number; perPage?: number }) {
  return useQuery<NotificationListResponse>({
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationsService.getAll(params),
  });
}

export function useUnreadNotificationsCount() {
  return useQuery<{ count: number }>({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationsService.getUnreadCount(),
    staleTime: 30_000,
  });
}
