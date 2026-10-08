import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useNativePaymentCheckout } from '@/features/payments/use-native-payment-checkout';
import type { PreparedApplePay } from '@/features/payments/DeferredApplePayButton';
import type { PendingBookingCheckout } from './payment-resume-state';

/** Bridges an explicit review-screen tap to an initialized, persisted attempt. */
export function useInlineApplePay({ clientId, scope, enabled, prepareBooking }: {
  clientId?: string;
  scope: string;
  enabled: boolean;
  prepareBooking: () => Promise<PendingBookingCheckout | null>;
}) {
  const router = useRouter();
  const owner = JSON.stringify([clientId, scope]);
  const currentOwner = useRef(owner); currentOwner.current = owner;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const allowed = useRef(enabled); allowed.current = enabled;
  const generation = useRef(0);
  const [target, setTarget] = useState<{ owner: string; bookingId: string; invoiceId: string } | null>(null);
  const validTarget = target?.owner === owner ? target : null;
  const checkout = useNativePaymentCheckout({ clientId: validTarget ? clientId : undefined,
    invoiceId: validTarget?.invoiceId ?? '', bookingId: validTarget?.bookingId, method: 'APPLE_PAY' });
  const latest = useRef(checkout); latest.current = checkout;
  const [preparing, setPreparing] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const busy = useRef(false);
  const waiter = useRef<{ owner: string; retrying: boolean; resolve: (value: PreparedApplePay | null) => void } | null>(null);
  const finish = useCallback((value: PreparedApplePay | null) => {
    const waiting = waiter.current; waiter.current = null;
    busy.current = false; setPreparing(false); waiting?.resolve(value);
  }, []);
  useEffect(() => {
    return () => { waiter.current?.resolve(null); waiter.current = null; busy.current = false; };
  }, [owner]);
  useEffect(() => {
    setWalletOpen(false); setPreparing(false);
  }, [owner]);

  const navigated = useRef<string | null>(null);
  useEffect(() => {
    if (!validTarget || checkout.phase !== 'completed' || navigated.current === owner) return;
    navigated.current = owner;
    router.replace({ pathname: '/(client)/booking/success', params: {
      bookingId: validTarget.bookingId, invoiceId: validTarget.invoiceId,
      ...(checkout.paymentId ? { paymentId: checkout.paymentId } : {}),
    } });
  }, [validTarget, checkout.phase, checkout.paymentId, router, owner]);

  useEffect(() => {
    const waiting = waiter.current;
    if (!waiting) return;
    if (!enabled || waiting.owner !== owner) { finish(null); return; }
    if (!validTarget || checkout.phase === 'loading' || checkout.phase === 'checking') return;
    if (checkout.phase === 'ready' && checkout.config) {
      const onResult = checkout.onPaymentResult;
      const preparedGeneration = generation.current;
      const preparedConfig = checkout.config;
      const owned = () => mounted.current && currentOwner.current === owner
        && generation.current === preparedGeneration;
      // Every terminal checkout result clears the config, so a token must not be
      // submitted once the attempt this Wallet was prepared for is no longer live.
      const isCurrent = () => owned() && allowed.current && latest.current.config === preparedConfig;
      setWalletOpen(true);
      finish({ config: checkout.config, isCurrent,
        onResult: () => { if (!owned()) return; setWalletOpen(false); void onResult(); },
        onCancel: () => { if (owned()) setWalletOpen(false); },
      });
    } else if ((checkout.phase === 'failed' || (checkout.phase === 'pending' && checkout.canResume)) && !waiting.retrying) {
      waiting.retrying = true;
      void checkout.retryInitialization();
    } else if (checkout.phase !== 'choosing') { finish(null); }
  }, [checkout, enabled, owner, validTarget, finish]);

  const prepare = useCallback(async (): Promise<PreparedApplePay | null> => {
    if (!allowed.current || busy.current || walletOpen) return null;
    busy.current = true; setPreparing(true);
    const attemptOwner = owner;
    try {
      const booking = await prepareBooking();
      if (!booking?.invoiceId || !mounted.current || currentOwner.current !== attemptOwner || !allowed.current) {
        busy.current = false; if (mounted.current) setPreparing(false); return null;
      }
      // On repeat taps check the saved attempt before allowing another Wallet.
      if (validTarget) await latest.current.reconcile();
      if (!mounted.current || currentOwner.current !== attemptOwner || !allowed.current) {
        busy.current = false; if (mounted.current) setPreparing(false); return null;
      }
      return await new Promise<PreparedApplePay | null>((resolve) => {
        waiter.current = { owner: attemptOwner, retrying: false, resolve };
        setTarget({ owner: attemptOwner, bookingId: booking.bookingId, invoiceId: booking.invoiceId! });
      });
    } catch {
      busy.current = false; if (mounted.current) setPreparing(false); return null;
    }
  }, [owner, prepareBooking, validTarget, walletOpen]);

  // Foreground checks after a dismissed Wallet can report PENDING for the
  // reserved UUID. A retained config + server permission to create means it
  // was never submitted; show the ready actions without a verification warning.
  const phase = validTarget ? checkout.phase === 'pending' && checkout.canResume && checkout.config
    ? 'ready' : checkout.phase : null;
  const locked = preparing || walletOpen || phase === 'loading' || phase === 'checking'
    || phase === 'processing' || (phase === 'pending' && !checkout.canResume)
    || phase === 'completed' || phase === 'review' || phase === 'unavailable' || phase === 'error';
  return { prepare, preparing, locked, phase, error: checkout.error,
    unavailableReason: checkout.unavailableReason, canRetryInit: checkout.canRetryInit, reconcile: checkout.reconcile,
    retryInitialization: checkout.retryInitialization, cancel: () => setWalletOpen(false),
    handoff: () => { generation.current += 1; finish(null); setWalletOpen(false); setTarget(null); } };
}
