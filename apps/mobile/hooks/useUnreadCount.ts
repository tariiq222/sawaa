import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { notificationsService } from '@/services/notifications';

const POLL_INTERVAL_MS = 60_000;

interface UseUnreadCountResult {
  count: number;
  refresh: () => Promise<void>;
}

/**
 * Polls `/notifications/unread-count` on focus and every 60s while focused.
 * Errors fail silently — the badge just stops updating.
 */
export function useUnreadCount(): UseUnreadCountResult {
  const [count, setCount] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await notificationsService.getUnreadCount();
      if (mountedRef.current) setCount(res.count ?? 0);
    } catch {
      // Silent — keep last known value.
    }
  }, []);

  // Initial mount fetch.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // On focus + interval polling while focused.
  useFocusEffect(
    useCallback(() => {
      refresh();
      const id = setInterval(refresh, POLL_INTERVAL_MS);
      return () => clearInterval(id);
    }, [refresh]),
  );

  return { count, refresh };
}
