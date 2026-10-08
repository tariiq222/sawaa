import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateClientBookingResources } from '@/hooks/queries/invalidateClientBookingResources';
import type { NativePaymentConfiguration, NativePaymentMethod, NativePaymentReconcileResponse } from '@sawaa/shared';
import { clientPaymentsService } from '@/services/client/payments';
import { clientBookingsService } from '@/services/client/bookings';
import { clientPackagesService } from '@/services/client/packages';
import { createNativePaymentConfig } from './native-payment-config';

interface CheckoutInput {
  clientId: string | undefined;
  invoiceId: string;
  bookingId?: string;
  purchaseId?: string;
  method?: NativePaymentMethod;
}
type Phase = 'choosing' | 'unavailable' | 'loading' | 'ready' | 'checking' | 'processing' | 'pending' | 'completed' | 'failed' | 'review' | 'error';
interface CheckoutState { attempt: number; phase: Phase; config: NativePaymentConfiguration | null; paymentId: string | null; error: string | null; canResume: boolean; canRetryInit: boolean; unavailableReason?: NativePaymentReconcileResponse['unavailableReason'] }
interface PendingIdentity { clientId: string; invoiceId: string; paymentId: string; bookingId?: string; purchaseId?: string }
const empty: CheckoutState = { attempt: 0, phase: 'loading', config: null, paymentId: null, error: null, canResume: false, canRetryInit: true };

export function useNativePaymentCheckout(input: CheckoutInput) {
  const { clientId, invoiceId, bookingId, purchaseId, method } = input;
  const queryClient = useQueryClient();
  const scope = JSON.stringify([clientId, invoiceId, bookingId, purchaseId, method]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [state, setState] = useState<CheckoutState & { scope: string }>({ ...empty, scope });
  const controls = useRef({ reconcile: async () => {}, verifyPayable: async () => false, retry: async () => {}, paymentResult: async (_attempt: number) => {} });

  useEffect(() => {
    let active = true;
    let busy = false;
    let paymentId: string | null = null;
    let polls = 0;
    let attempt = 0;
    let settling = false;
    let resultReceived = false;
    let queuedResult = false;
    let terminalResult = false;
    let terminalFailure = false;
    let terminalUnavailable = false;
    let canInitialize = true;
    let payable = false;
    let readyConfig: NativePaymentConfiguration | null = null;
    let initBlocked = false;
    let adoptedId: string | null = null; // replacement identity adopted from an in-progress conflict
    let verifying = false;
    let recheckRequested = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const storageKey = `sawaa.native-payment:${clientId}:${invoiceId}`;
    const valid = () => active && currentScope.current === scope;
    const closed = () => terminalResult || terminalUnavailable;
    const update = (next: Partial<CheckoutState>) => {
      // retryInitialization is a no-op once a result was submitted or a payment exists.
      const canRetryInit = canInitialize && !settling && !resultReceived;
      if (valid()) setState((previous) => ({ ...(previous.scope === scope ? previous : empty), ...next, canRetryInit, scope }));
    };
    update(empty);
    const target = async () => {
      if (!clientId || !invoiceId || Boolean(bookingId) === Boolean(purchaseId)) throw new Error('Invalid target');
      if (bookingId) {
        const booking = await queryClient.fetchQuery({
          queryKey: ['native-payment-booking', clientId, bookingId], staleTime: 0,
          queryFn: () => clientBookingsService.getById(bookingId),
        });
        if (booking.id !== bookingId || booking.invoiceId !== invoiceId) throw new Error('Invalid target');
        return ['confirmed', 'deposit_paid', 'completed', 'in_progress'].includes(booking.status);
      }
      const purchase = await queryClient.fetchQuery({
        queryKey: ['native-payment-purchase', clientId, purchaseId], staleTime: 0,
        queryFn: () => clientPackagesService.getPurchase(purchaseId!),
      });
      if (purchase.id !== purchaseId || purchase.invoiceId !== invoiceId) throw new Error('Invalid target');
      return purchase.status === 'ACTIVE' || purchase.status === 'COMPLETED';
    };
    const schedule = () => {
      if (!valid() || terminalUnavailable) return;
      if (polls >= 6) { settling = false; return; }
      clearTimeout(timer);
      timer = setTimeout(() => { polls += 1; void reconcile(); }, 3000);
    };
    const reconcile = async () => {
      if (!valid() || terminalUnavailable || !paymentId) return;
      if (busy) { if (verifying) recheckRequested = true; return; }
      busy = true;
      clearTimeout(timer);
      // Keep the live SDK/WebView mounted while checking a bank challenge. An explicit blocked
      // state (conflict, in-progress payment) keeps its message across checks.
      update({ phase: settling ? 'processing' : 'checking', ...(initBlocked ? {} : { error: null }) });
      try {
        const result = await clientPaymentsService.reconcileNativePayment(paymentId);
        if (!valid()) return;
        if (result.paymentId !== paymentId || result.invoiceId !== invoiceId) throw new Error('Invalid identity');
        if (result.requiresReview || ['PARTIALLY_REFUNDED', 'REFUNDED'].includes(result.status)) {
          terminalResult = true; settling = false;
          canInitialize = false;
          update({ phase: 'review', config: null, canResume: false });
        } else if (result.status === 'COMPLETED') {
          settling = true;
          canInitialize = false;
          // Captured money cannot be retried while operational confirmation settles.
          update({ config: null, canResume: false });
          const confirmed = await target();
          if (!valid()) return;
          if (confirmed) {
            await AsyncStorage.removeItem(storageKey);
            terminalResult = true; settling = false;
            update({ phase: 'completed', config: null, canResume: false });
            void invalidateClientBookingResources(queryClient);
          } else { schedule(); update({ phase: settling ? 'processing' : 'pending' }); }
        } else if (result.status === 'FAILED') {
          terminalResult = true; settling = false;
          terminalFailure = true;
          if (paymentId === adoptedId) initBlocked = false; // the adopted attempt itself failed
          canInitialize = !initBlocked;
          // Only an authoritative failure reopens initialization after a submitted result.
          resultReceived = false;
          update({ phase: 'failed', config: null, canResume: false });
        } else if (result.unavailableReason) {
          terminalUnavailable = true; settling = false;
          canInitialize = false;
          update({ phase: 'unavailable', config: null, canResume: false, unavailableReason: result.unavailableReason });
        } else {
          canInitialize = result.canCreatePayment === true && !resultReceived && !initBlocked;
          payable = canInitialize;
          schedule();
          update({ phase: settling ? 'processing' : 'pending', canResume: canInitialize });
        }
      } catch {
        if (settling) schedule();
        update({ phase: settling ? 'processing' : 'error', error: settling ? null : 'nativePayment.verificationError' });
      } finally {
        busy = false;
        // A Wallet result can arrive while the foreground request is still running.
        if (queuedResult) {
          queuedResult = false;
          if (valid() && !closed()) await reconcile();
        }
      }
    };
    const persistIdentity = async () => {
      const pending: PendingIdentity = { clientId: clientId!, invoiceId, paymentId: paymentId!, bookingId, purchaseId };
      await AsyncStorage.setItem(storageKey, JSON.stringify(pending));
    };
    // A freshly initialized attempt becomes the live one: persisted, counted, and ready.
    const adoptAttempt = async (result: { paymentId: string; config: NativePaymentConfiguration }) => {
      createNativePaymentConfig(result.config);
      paymentId = result.paymentId;
      await persistIdentity();
      if (!valid()) return false;
      attempt += 1;
      terminalFailure = false; terminalResult = false; resultReceived = false;
      readyConfig = result.config;
      update({ attempt, phase: 'ready', config: result.config, paymentId, canResume: true });
      return true;
    };
    // Authoritative results an initialization request can return; true means it was handled.
    const handleInitError = async (error: unknown): Promise<boolean> => {
      const conflict = (error as { response?: { data?: { code?: string; paymentId?: string; invoiceId?: string } } })?.response?.data;
      const code = conflict?.code;
      if (code === 'BOOKING_EXPIRED' || code === 'BOOKING_CLOSED' || code === 'INVOICE_CLOSED') {
        terminalUnavailable = true; settling = false;
        canInitialize = false;
        update({ phase: 'unavailable', config: null, canResume: false, unavailableReason: code });
        return true;
      }
      if (conflict?.code === 'PAYMENT_ALREADY_COMPLETED') {
        const completedId = conflict.invoiceId === invoiceId && typeof conflict.paymentId === 'string'
          && conflict.paymentId ? conflict.paymentId : paymentId;
        if (completedId) {
          paymentId = completedId;
          update({ paymentId });
          busy = false;
          await reconcile();
          return true;
        }
      }
      if (code === 'NATIVE_PAYMENT_IN_PROGRESS' || code === 'HOSTED_PAYMENT_IN_PROGRESS') {
        // A provider payment is already in flight: stop initializing and keep verifying it (the
        // returned identity wins over a retained, possibly failed, local one).
        initBlocked = true; canInitialize = false; readyConfig = null;
        if (conflict?.invoiceId === invoiceId && typeof conflict.paymentId === 'string' && conflict.paymentId) {
          paymentId = adoptedId = conflict.paymentId;
          try { await persistIdentity(); } catch { /* restoration falls back to the server identity */ }
        }
        update({ phase: 'error', config: null, canResume: false, error: 'nativePayment.conflict', ...(paymentId ? { paymentId } : {}) });
        if (paymentId) { busy = false; await reconcile(); }
        return true;
      }
      if (code === 'PAYMENT_CONFIGURATION_CHANGED') {
        // Every further initialization hits the same stored-fingerprint conflict.
        initBlocked = true; canInitialize = false; readyConfig = null;
        update({ phase: 'error', config: null, canResume: false, error: 'nativePayment.conflict' });
        return true;
      }
      return false;
    };
    const initialize = async (restore = false) => {
      if (!valid() || terminalUnavailable || busy || !clientId || !canInitialize || settling || resultReceived) return;
      busy = true;
      clearTimeout(timer);
      update({ phase: 'loading', config: null, error: null });
      try {
        await target();
        if (!valid()) return;
        if (restore) {
          const raw = await AsyncStorage.getItem(storageKey);
          if (!valid()) return;
          if (raw) {
            const pending = JSON.parse(raw) as PendingIdentity;
            if (pending.clientId !== clientId || pending.invoiceId !== invoiceId
              || pending.bookingId !== bookingId || pending.purchaseId !== purchaseId
              || typeof pending.paymentId !== 'string' || !pending.paymentId) throw new Error('Invalid identity');
            paymentId = pending.paymentId;
            canInitialize = false;
            update({ paymentId });
            busy = false;
            await reconcile();
            return;
          }
        }
        if (!method) { update({ phase: 'choosing' }); return; }
        const result = await clientPaymentsService.initNativePayment(invoiceId, method);
        if (!valid()) return;
        if (result.invoiceId !== invoiceId || !result.paymentId
          || (paymentId && !terminalFailure && result.paymentId !== paymentId)) throw new Error('Invalid identity');
        await adoptAttempt(result);
      } catch (error) {
        if (!valid()) return;
        if (await handleInitError(error)) return;
        update({ phase: 'error', error: 'nativePayment.verificationError' });
      } finally { busy = false; }
    };
    // Authoritative pre-submission check: a fresh server verdict that this same reserved attempt
    // can still be paid (PENDING with canCreatePayment). Any doubt, error or newer check fails
    // closed. Provider configuration is validated by the server at initialization; a rotation
    // while Wallet is open invalidates the old key at the provider rather than here.
    const verifyPayable = async (): Promise<boolean> => {
      const deadline = Date.now() + 10000;
      while (busy && Date.now() < deadline) await new Promise((done) => setTimeout(done, 25));
      if (busy || !valid() || !paymentId || closed() || !readyConfig) return false;
      const startConfig = readyConfig;
      const check = async () => {
        payable = false; verifying = true; recheckRequested = false;
        try { await reconcile(); } finally { verifying = false; }
        return valid() && payable && !closed() && readyConfig === startConfig;
      };
      let ok = await check();
      // A check requested while ours was running must give its own verdict before authorizing.
      if (ok && recheckRequested) ok = await check();
      return ok;
    };
    controls.current = { reconcile, verifyPayable, retry: () => initialize(), paymentResult: async (renderedAttempt: number) => {
      if (!valid() || !paymentId || renderedAttempt !== attempt || terminalResult || terminalUnavailable || resultReceived) return;
      resultReceived = true; settling = true; polls = 0; canInitialize = false;
      // The SDK callback ends this bank interaction, but cannot decide payment success.
      // Remove its pay control while the same saved UUID is verified automatically.
      update({ phase: 'processing', config: null, error: null, canResume: false });
      if (busy) { queuedResult = true; return; }
      await reconcile();
    } };
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') { polls = 0; void reconcile(); }
    });
    void initialize(true);
    return () => { active = false; clearTimeout(timer); subscription.remove(); };
  }, [scope, clientId, invoiceId, bookingId, purchaseId, method, queryClient]);

  const reconcile = useCallback(async () => {
    if (currentScope.current === scope) await controls.current.reconcile();
  }, [scope]);
  const verifyPayable = useCallback(async () => (currentScope.current === scope ? controls.current.verifyPayable() : false), [scope]);
  const retryInitialization = useCallback(async () => {
    if (currentScope.current === scope) await controls.current.retry();
  }, [scope]);
  const renderedAttempt = state.scope === scope ? state.attempt : 0;
  const onPaymentResult = useCallback(async () => {
    if (currentScope.current === scope) await controls.current.paymentResult(renderedAttempt);
  }, [scope, renderedAttempt]);
  return { ...(state.scope === scope ? state : empty), reconcile, verifyPayable, retryInitialization, onPaymentResult };
}
