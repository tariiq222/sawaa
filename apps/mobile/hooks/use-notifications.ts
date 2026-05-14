import { useState, useEffect, useCallback } from 'react';

import { notificationsService } from '@/services/notifications';
import { groupByDate, type DateGroup } from '@/utils/date-groups';
import { useTheme } from '@/theme/useTheme';
import type { Notification } from '@/types/models';

const PER_PAGE = 20;

export function useNotifications() {
  const { language } = useTheme();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPage = useCallback(async (pageNum: number, replace: boolean) => {
    try {
      const res = await notificationsService.getAll({
        page: pageNum,
        perPage: PER_PAGE,
      });
      const items = res.items;
      setNotifications((prev) => (replace ? items : [...prev, ...items]));
      setHasMore(pageNum < res.meta.totalPages);
    } catch {
      // Silent fail — user can pull to refresh
    }
  }, []);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await notificationsService.getUnreadCount();
      setUnreadCount(res.count ?? 0);
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchPage(1, true), fetchUnread()]);
      setLoading(false);
    };
    init();
  }, [fetchPage, fetchUnread]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await Promise.all([fetchPage(1, true), fetchUnread()]);
    setRefreshing(false);
  }, [fetchPage, fetchUnread]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || refreshing) return;
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchPage(nextPage, false);
  }, [hasMore, loading, refreshing, page, fetchPage]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationsService.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silent fail
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsService.markAllRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true })),
      );
      setUnreadCount(0);
    } catch {
      // Silent fail
    }
  }, []);

  const sections: DateGroup<Notification>[] = groupByDate(
    notifications,
    language,
  );

  return {
    notifications,
    sections,
    unreadCount,
    loading,
    refreshing,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
  };
}
