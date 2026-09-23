import { useEffect } from 'react';
import { registerForPushAsync, subscribeToFcmTokenRefresh, unregisterPushAsync } from '@/services/push';
import { getSessionEpoch, isSessionCurrent } from '@/services/native-session-state';

/** One owner per client session; staff never calls the client notification API. */
export function usePushNotifications(clientId: string | null, enabled: boolean): void {
  useEffect(() => {
    if (!clientId || !enabled) return;
    const epoch = getSessionEpoch();
    let cancelled = false;
    const isCurrent = () => !cancelled && isSessionCurrent(epoch);
    const register = () => { void registerForPushAsync(isCurrent); };
    register();
    const unsubscribe = subscribeToFcmTokenRefresh(register);
    return () => {
      cancelled = true;
      unsubscribe();
      // Explicit logout clears the token before clearing auth. A stale cleanup
      // must never issue a deletion using a newer client's credentials.
      if (isSessionCurrent(epoch)) void unregisterPushAsync();
    };
  }, [clientId, enabled]);
}
