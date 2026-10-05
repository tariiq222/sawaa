import { AppState } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';

import { clientBookingsService, type ClientBookingRow } from '@/services/client/bookings';
import { clientPaymentsService, type ClientInvoice } from '@/services/client/payments';
import { clientBookingsKeys } from '@/hooks/queries/useClientBookings';
import { queryClient } from '@/services/query-client';
import {
  resolveExistingBookingCheckout,
  type ExistingBookingCheckoutPhase,
} from '@/features/booking/existing-booking-checkout-state';

export { resolveExistingBookingCheckout } from '@/features/booking/existing-booking-checkout-state';
export { canResumeHostedPayment, canResumeHostedPayment as canResumeOnlinePayment } from '@/features/booking/existing-booking-checkout-state';
export { canStartHostedPayment, canStartHostedPayment as canStartOnlinePayment } from '@/features/booking/existing-booking-checkout-state';
export type { ExistingBookingCheckoutInput, ExistingBookingCheckoutPhase } from '@/features/booking/existing-booking-checkout-state';

export interface ExistingBookingCheckoutSnapshot {
  booking: ClientBookingRow | null;
  invoice: ClientInvoice | null;
}

const MAX_REFRESHES = 10;
const REFRESH_INTERVAL_MS = 3000;

interface UseExistingBookingCheckoutArgs {
  bookingId?: string;
  invoiceId?: string;
}

export function useExistingBookingCheckout({ bookingId, invoiceId }: UseExistingBookingCheckoutArgs) {
  const [snapshot, setSnapshot] = useState<ExistingBookingCheckoutSnapshot>({ booking: null, invoice: null });
  const [phase, setPhase] = useState<ExistingBookingCheckoutPhase>(bookingId ? 'loading' : 'error');
  const [isRefreshing, setIsRefreshing] = useState(Boolean(bookingId));
  const [refreshNonce, setRefreshNonce] = useState(0);
  const mountedRef = useRef(true);
  const requestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!bookingId) {
      if (mountedRef.current) {
        setPhase('error');
        setIsRefreshing(false);
      }
      return;
    }
    if (mountedRef.current) setIsRefreshing(true);
    try {
      const booking = await clientBookingsService.getById(bookingId);
      if (!mountedRef.current || requestId !== requestRef.current) return;
      if (invoiceId !== undefined && invoiceId !== booking.invoiceId) {
        setSnapshot({ booking, invoice: null });
        setPhase(resolveExistingBookingCheckout({ booking, invoice: null, invoiceMismatch: true }));
        return;
      }
      const resolvedInvoiceId = booking.invoiceId;
      const invoice = resolvedInvoiceId
        ? await clientPaymentsService.getInvoice(resolvedInvoiceId)
        : null;
      if (!mountedRef.current || requestId !== requestRef.current) return;
      setSnapshot({ booking, invoice });
      setPhase(resolveExistingBookingCheckout({ booking, invoice }));
    } catch {
      if (mountedRef.current && requestId === requestRef.current) setPhase('error');
    } finally {
      if (mountedRef.current && requestId === requestRef.current) setIsRefreshing(false);
    }
  }, [bookingId, invoiceId]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshNonce]);

  // Keep appointment confirmation separate from the balance payment lifecycle.
  // An idle remaining balance must not start a polling loop.
  const shouldPoll = phase === 'pending' || (phase === 'deposit_confirmed' &&
    (snapshot.invoice?.payments ?? []).some((payment) =>
      ['PENDING', 'PENDING_VERIFICATION'].includes(payment.status.trim().toUpperCase())));
  useEffect(() => {
    if (!shouldPoll) return undefined;
    let refreshes = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const schedule = () => {
      if (cancelled || refreshes >= MAX_REFRESHES) return;
      timer = setTimeout(async () => {
        refreshes += 1;
        await refresh();
        if (!cancelled && refreshes < MAX_REFRESHES) schedule();
      }, REFRESH_INTERVAL_MS);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [shouldPoll, refresh, refreshNonce]);

  useEffect(() => {
    if (!bookingId || !['success', 'deposit_confirmed', 'failed', 'cancelled', 'expired'].includes(phase)) return;
    void queryClient.invalidateQueries({ queryKey: clientBookingsKeys.all });
    void queryClient.invalidateQueries({ queryKey: clientBookingsKeys.detail(bookingId) });
  }, [bookingId, phase]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      appStateSubscription?.remove();
    };
  }, [refresh]);

  const checkAgain = useCallback(() => setRefreshNonce((nonce) => nonce + 1), []);

  return {
    booking: snapshot.booking,
    invoice: snapshot.invoice,
    phase,
    isRefreshing,
    refresh,
    checkAgain,
  };
}
