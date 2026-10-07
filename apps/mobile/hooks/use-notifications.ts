import { useCallback, useRef } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { notificationKeys, useMarkNotificationsRead, useNotificationFeed, useUnreadNotificationsCount } from './queries/useNotifications';
import type { NotificationListResponse } from '@/services/notifications';
import { groupByDate } from '@/utils/date-groups';
import { useTheme } from '@/theme/useTheme';

/** Compatibility view model; query hooks own list pages, unread count and writes. */
export function useNotifications() {
  const { language } = useTheme();
  const queryClient = useQueryClient();
  const feed = useNotificationFeed();
  const unread = useUnreadNotificationsCount();
  const read = useMarkNotificationsRead();
  const loadMoreInFlight = useRef(false);
  const generation = useRef(0);
  const { refetch: refetchFeed, fetchNextPage } = feed;
  const { refetch: refetchUnread } = unread;
  const notifications = feed.data?.pages.flatMap((page) => page.items) ?? [];

  const refresh = useCallback(async () => {
    generation.current += 1;
    loadMoreInFlight.current = false;
    const cached = queryClient.getQueryData(notificationKeys.feed());
    if (!cached) {
      await Promise.all([refetchFeed(), refetchUnread()]);
      return;
    }
    await queryClient.cancelQueries({ queryKey: notificationKeys.feed() });
    queryClient.setQueryData<InfiniteData<NotificationListResponse>>(notificationKeys.feed(), (current) => current ? {
      pages: current.pages.slice(0, 1), pageParams: current.pageParams.slice(0, 1),
    } : current);
    await Promise.all([refetchFeed(), refetchUnread()]);
  }, [queryClient, refetchFeed, refetchUnread]);

  const loadMore = useCallback(async () => {
    if (feed.isFetching || loadMoreInFlight.current || (!feed.hasNextPage && !feed.isError)) return;
    const request = generation.current;
    loadMoreInFlight.current = true;
    try {
      if (feed.isError && !feed.isFetchNextPageError) await refetchFeed();
      else await fetchNextPage();
    } finally {
      if (request === generation.current) loadMoreInFlight.current = false;
    }
  }, [feed.hasNextPage, feed.isError, feed.isFetchNextPageError, feed.isFetching, fetchNextPage, refetchFeed]);

  const { mutateAsync: markRead } = read;
  const markAsRead = useCallback(async (id: string) => {
    try { await markRead(id); } catch { /* Keep the existing silent read failure. */ }
  }, [markRead]);
  const markAllAsRead = useCallback(async () => {
    try { await markRead(undefined); } catch { /* Keep the existing silent read failure. */ }
  }, [markRead]);

  return {
    notifications,
    sections: groupByDate(notifications, language),
    unreadCount: unread.data?.count ?? 0,
    loading: feed.isPending,
    refreshing: feed.isRefetching && !feed.isFetchingNextPage,
    refresh, loadMore,
    hasMore: feed.hasNextPage,
    loadingMore: feed.isFetchingNextPage,
    loadError: feed.isError,
    markAsRead, markAllAsRead,
  };
}
