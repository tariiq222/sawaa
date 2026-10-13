import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { useAppSelector } from '@/hooks/use-redux';
import { getPendingPackagePurchase } from '@/services/client/packages';

// Native purchases stay recoverable while their payment may still settle, so the
// package screens only send the client to their return screen once per app session.
const recoveredNativePurchases = new Set<string>();

/**
 * Sends a signed-in client with a pending purchase of `optionId` to the package
 * return screen, on mount and whenever the app returns to the foreground.
 * A guest has no user, so it does nothing. `checkoutInFlight` is true while the
 * screen owns an open checkout, so the foreground listener does not race the
 * purchase flow's own navigation.
 */
export function usePendingPackageRecovery(
  optionId: string | undefined,
  checkoutInFlight: MutableRefObject<boolean>,
): void {
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const userRef = useRef(user?.id);
  userRef.current = user?.id;
  const isActiveRef = useRef(true);
  useFocusEffect(useCallback(() => {
    isActiveRef.current = true;
    return () => { isActiveRef.current = false; };
  }, []));

  const recoverPending = useCallback(async () => {
    if (checkoutInFlight.current || !isActiveRef.current) return;
    if (!user?.id) return;
    const pending = await getPendingPackagePurchase(user.id);
    // Ignore a previous account's asynchronous recovery read.
    if (checkoutInFlight.current || !isActiveRef.current || userRef.current !== user?.id) return;
    if (pending && pending.clientId === user?.id && pending.packageId === optionId) {
      if (pending.invoiceId) {
        if (recoveredNativePurchases.has(pending.purchaseId)) return;
        recoveredNativePurchases.add(pending.purchaseId);
      }
      router.replace({ pathname: '/(client)/packages/return', params: {
        purchaseId: pending.purchaseId,
        clientId: pending.clientId,
        packageId: pending.packageId,
        familyId: pending.familyId,
        branchId: pending.branchId,
        ...(pending.invoiceId ? { origin: 'native' } : {}),
      } });
    }
  }, [checkoutInFlight, optionId, router, user?.id]);

  useEffect(() => {
    let cancelled = false;
    void recoverPending();
    const subscription = AppState.addEventListener('change', (state) => {
      if (!cancelled && state === 'active') void recoverPending();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [recoverPending]);
}
