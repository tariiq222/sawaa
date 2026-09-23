import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { getSessionEpoch, isSessionCurrent } from '@/services/native-session-state';

/** Never trust a push payload as an arbitrary route or another client's resource. */
export function usePushResponses(clientId: string | null): void {
  const lastResponse = useRef<string | null>(null);
  useEffect(() => {
    if (!clientId) return;
    const epoch = getSessionEpoch();
    let cancelled = false;
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response || cancelled || !isSessionCurrent(epoch)) return;
      const id = response.notification.request.identifier;
      if (lastResponse.current === id) return;
      lastResponse.current = id;
      router.push('/(client)/notifications');
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    return () => { cancelled = true; subscription.remove(); };
  }, [clientId]);
}
