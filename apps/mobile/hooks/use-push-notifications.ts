import { useEffect, useRef } from 'react';

import { registerForPushAsync, unregisterPushAsync } from '@/services/push';

/**
 * Registers the device for FCM push notifications when the user is
 * authenticated. On cleanup (logout / unmount) it unregisters the token
 * from the backend so stale tokens are not left behind.
 *
 * Usage:
 *   const token = useAppSelector((s) => s.auth.token);
 *   usePushNotifications(!!token);
 */
export function usePushNotifications(isAuthenticated: boolean): void {
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    registerForPushAsync().then((token) => {
      if (cancelled) return;
      if (token) registeredRef.current = true;
    });

    return () => {
      cancelled = true;
      if (registeredRef.current) {
        unregisterPushAsync().catch(() => {});
        registeredRef.current = false;
      }
    };
  }, [isAuthenticated]);
}
