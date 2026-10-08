import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { notificationsService, type NotificationListResponse } from '@/services/notifications';
import { getSessionEpoch, isSessionCurrent } from '@/services/native-session-state';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (params?: { page?: number; perPage?: number }) =>
    [...notificationKeys.all, getSessionEpoch(), 'list', params ?? {}] as const,
  feed: (perPage = 20) => [...notificationKeys.all, getSessionEpoch(), 'feed', perPage] as const,
  unreadCount: () => [...notificationKeys.all, getSessionEpoch(), 'unread-count'] as const,
};

export function useNotifications(params?: { page?: number; perPage?: number }) {
  return useQuery({
    meta: { silentError: true },
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationsService.getAll(params),
  });
}

export function useNotificationFeed(perPage = 20) {
  return useInfiniteQuery({
    meta: { silentError: true },
    queryKey: notificationKeys.feed(perPage),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => notificationsService.getAll({ page: pageParam, perPage }),
    getNextPageParam: (lastPage) => lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined,
    retry: false,
  });
}

export function useUnreadNotificationsCount() {
  return useQuery({
    meta: { silentError: true },
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationsService.getUnreadCount(),
    staleTime: 30_000,
  });
}

type CachedNotifications = NotificationListResponse | InfiniteData<NotificationListResponse>;

/** Reflect successful reads in all visible pages and the shared badge. */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  const epoch = getSessionEpoch();
  return useMutation({
    mutationFn: (id?: string) => id ? notificationsService.markRead(id) : notificationsService.markAllRead(),
    retry: false,
    onError: () => undefined,
    onSuccess: async (_data, id) => {
      if (!isSessionCurrent(epoch)) return;
      const wasUnread = queryClient.getQueriesData<CachedNotifications>({ queryKey: [...notificationKeys.all, epoch] })
        .some(([, data]) => {
          const pages = data && 'pages' in data ? data.pages : data && 'items' in data ? [data] : [];
          return pages.some((page) => page.items.some((item) => item.id === id && !item.isRead));
        });
      queryClient.setQueriesData<CachedNotifications>({ queryKey: [...notificationKeys.all, epoch] }, (data) => {
        if (!data || (!('pages' in data) && !('items' in data))) return data;
        const update = (page: NotificationListResponse) => ({
          ...page, items: page.items.map((item) => !id || item.id === id ? { ...item, isRead: true } : item),
        });
        return 'pages' in data ? { ...data, pages: data.pages.map(update) } : update(data);
      });
      queryClient.setQueryData<{ count: number }>(notificationKeys.unreadCount(), (current) => ({
        count: id ? Math.max(0, (current?.count ?? 0) - (wasUnread ? 1 : 0)) : 0,
      }));
      await queryClient.invalidateQueries({ queryKey: [...notificationKeys.all, epoch] });
    },
  });
}
