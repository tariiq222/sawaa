import { useState, useEffect, useCallback, useRef } from 'react';

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [failedPage, setFailedPage] = useState<number | null>(null);
  const loadMoreInFlight = useRef(false);
  const requestGeneration = useRef(0);

  const fetchPage = useCallback(async (pageNum: number, replace: boolean, generation: number) => {
    try {
      const res = await notificationsService.getAll({
        page: pageNum,
        perPage: PER_PAGE,
      });
      if (generation !== requestGeneration.current) return false;
      const items = res.items;
      setNotifications((prev) => (replace ? items : [...prev, ...items]));
      setHasMore(pageNum < res.meta.totalPages);
      setLoadError(false);
      setFailedPage(null);
      return true;
    } catch {
      if (generation === requestGeneration.current) {
        setLoadError(true);
        setFailedPage(pageNum);
      }
      return false;
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
      const generation = requestGeneration.current;
      await Promise.all([fetchPage(1, true, generation), fetchUnread()]);
      setLoading(false);
    };
    init();
  }, [fetchPage, fetchUnread]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    requestGeneration.current += 1;
    const generation = requestGeneration.current;
    setPage(1);
    loadMoreInFlight.current = false;
    setLoadingMore(false);
    setLoadError(false);
    setFailedPage(null);
    await Promise.all([fetchPage(1, true, generation), fetchUnread()]);
    if (generation === requestGeneration.current) setRefreshing(false);
  }, [fetchPage, fetchUnread]);

  const loadMore = useCallback(async () => {
    if ((!hasMore && failedPage === null) || loading || refreshing || loadMoreInFlight.current) return;
    loadMoreInFlight.current = true;
    setLoadingMore(true);
    const nextPage = failedPage ?? page + 1;
    const generation = requestGeneration.current;
    const succeeded = await fetchPage(nextPage, nextPage === 1, generation);
    if (generation === requestGeneration.current) {
      if (succeeded) setPage(nextPage);
      loadMoreInFlight.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, loading, refreshing, page, failedPage, fetchPage]);

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
    hasMore,
    loadingMore,
    loadError,
    markAsRead,
    markAllAsRead,
  };
}
