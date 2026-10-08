import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useUnreadNotificationsCount } from './queries/useNotifications';

const POLL_INTERVAL_MS = 60_000;

/** The focused badge polls the same query used by the notifications screen. */
export function useUnreadCount() {
  const { data, refetch } = useUnreadNotificationsCount();
  const refresh = useCallback(async () => { await refetch(); }, [refetch]);
  useFocusEffect(useCallback(() => {
    void refresh();
    const interval = setInterval(() => { void refresh(); }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]));
  return { count: data?.count ?? 0, refresh };
}
