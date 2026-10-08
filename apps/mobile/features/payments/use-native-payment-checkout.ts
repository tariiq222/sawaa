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
interface PendingIdentity { clientId: string; invoiceId: string; paymentId: string; bookingId?: string; purchaseId?: string; failed?: boolean }
const empty: CheckoutState = { attempt: 0, phase: 'loading', config: null, paymentId: null, error: null, canResume: false, canRetryInit: true };

// Mirrors the backend attempt fingerprint (publishable key, mode, Apple Pay) plus the attempt terms.
function sameAttemptConfig(a: NativePaymentConfiguration, b: NativePaymentConfiguration): boolean {
  const pick = (c: NativePaymentConfiguration) => JSON.stringify([
    c.publishableKey, c.isLive, c.applePay ?? null, c.givenId, c.amount, c.currency, c.supportedNetworks,
  ]);
  return pick(a) === pick(b);
}

function errorKey(error: unknown): string {
  const code = (error as { response?: { data?: { code?: string; message?: string } } })?.response?.data?.code;
  if (['NATIVE_PAYMENT_IN_PROGRESS', 'HOSTED_PAYMENT_IN_PROGRESS', 'PAYMENT_CONFIGURATION_CHANGED'].includes(code ?? '')) return 'nativePayment.conflict';
  return 'nativePayment.verificationError';
}

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
    let verifying = false;
    let lastInitAt = 0;
    let recheckRequested = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const storageKey = `sawaa.native-payment:${clientId}:${invoiceId}`;
    const valid = () => active && currentScope.current === scope;
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
      // Keep the live SDK/WebView mounted while checking a bank challenge.
      update({ phase: settling ? 'processing' : 'checking', error: null });
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
          canInitialize = true;
          // Only an authoritative failure reopens initialization after a submitted result.
          resultReceived = false;
          try {
            const stored = await AsyncStorage.getItem(storageKey);
            if (stored) await AsyncStorage.setItem(storageKey, JSON.stringify({ ...JSON.parse(stored), failed: true }));
          } catch { /* the identity stays; bank transfer remains blocked conservatively */ }
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
          if (valid() && !terminalResult && !terminalUnavailable) await reconcile();
        }
      }
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
        // A provider payment is already in flight: stop initializing and keep verifying it.
        initBlocked = true; canInitialize = false; readyConfig = null;
        if (!paymentId && conflict?.invoiceId === invoiceId && typeof conflict.paymentId === 'string' && conflict.paymentId) {
          paymentId = conflict.paymentId;
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
        createNativePaymentConfig(result.config);
        paymentId = result.paymentId;
        const pending: PendingIdentity = { clientId, invoiceId, paymentId, bookingId, purchaseId };
        await AsyncStorage.setItem(storageKey, JSON.stringify(pending));
        if (!valid()) return;
        attempt += 1;
        terminalFailure = false; terminalResult = false; resultReceived = false;
        readyConfig = result.config; lastInitAt = Date.now();
        update({ attempt, phase: 'ready', config: result.config, paymentId, canResume: true });
      } catch (error) {
        if (!valid()) return;
        if (await handleInitError(error)) return;
        update({ phase: 'error', error: errorKey(error) });
      } finally { busy = false; }
    };
    // Authoritative pre-submission check: a fresh server verdict that this same
    // reserved attempt can still be paid. Any doubt or error fails closed.
    const verifyPayable = async (): Promise<boolean> => {
      const deadline = Date.now() + 10000;
      while (busy && Date.now() < deadline) await new Promise((done) => setTimeout(done, 25));
      if (busy || !valid() || !paymentId || terminalResult || terminalUnavailable) return false;
      payable = false;
      await reconcile();
      if (!valid() || !payable || !method || !readyConfig) return false;
      // The backend compares the attempt fingerprint only at initialization, so re-run it:
      // a rotated Moyasar/Apple Pay configuration rejects here and must not reach the token.
      // Any failure revokes the prepared configuration and surfaces an explicit state, so the
      // UI never keeps offering a Wallet action that would only be dismissed again.
      const revoke = (error: string, conflict = false) => {
        readyConfig = null;
        // Initialization keeps failing on the stored fingerprint while the rotated configuration
        // is active, so a conflict is not retryable (a later reconcile cannot re-enable it either).
        if (conflict) { initBlocked = true; canInitialize = false; }
        update({ phase: 'error', config: null, canResume: false, error });
        return false;
      };
      const startConfig = readyConfig;
      // Hold the exclusive slot while initializing: no poll or foreground reconcile may overlap
      // it, so no newer verdict can land after this one authorizes the token.
      busy = true; verifying = true; recheckRequested = false;
      clearTimeout(timer);
      const run = async (): Promise<boolean> => {
      // native/init is throttled (3 per minute); an attempt initialized moments ago already carries
      // the current configuration, and the reconciliation above covers closure and completion.
      if (Date.now() - lastInitAt < 20_000) return valid() && !terminalResult && !terminalUnavailable && readyConfig === startConfig;
      try {
          const fresh = await clientPaymentsService.initNativePayment(invoiceId, method);
          if (!valid()) return false;
          if (fresh.invoiceId === invoiceId && fresh.paymentId && fresh.paymentId !== paymentId) {
            // The backend legitimately replaces an attempt it saw FAILED. The Wallet authorization
            // belongs to the old attempt, so revoke it but adopt and persist the replacement.
            createNativePaymentConfig(fresh.config);
            paymentId = fresh.paymentId;
            const pending: PendingIdentity = { clientId: clientId!, invoiceId, paymentId, bookingId, purchaseId };
            await AsyncStorage.setItem(storageKey, JSON.stringify(pending));
            if (!valid()) return false;
            attempt += 1;
            terminalFailure = false; terminalResult = false; resultReceived = false;
            readyConfig = fresh.config; lastInitAt = Date.now();
            update({ attempt, phase: 'ready', config: fresh.config, paymentId, canResume: true });
            return false;
          }
          if (fresh.invoiceId !== invoiceId || fresh.paymentId !== paymentId
            || !sameAttemptConfig(fresh.config, startConfig)) return revoke('nativePayment.conflict', true);
          return valid() && !terminalResult && !terminalUnavailable && readyConfig === startConfig;
        } catch (error) {
          if (!valid()) return false;
          // Closure, completion and configuration results are authoritative, exactly as in initialize().
          if (await handleInitError(error)) return false;
          // A throttled request is temporary: fail closed with a clear message, keep retry available.
          if ((error as { response?: { status?: number } })?.response?.status === 429) return revoke('nativePayment.tryAgainShortly');
          return revoke('nativePayment.verificationError');
        }
      };
      let ok = false;
      try {
        ok = await run();
      } finally {
        busy = false; verifying = false;
        if (valid() && !terminalResult && !terminalUnavailable) schedule();
        if (queuedResult) {
          queuedResult = false;
          if (valid() && !terminalResult && !terminalUnavailable) await reconcile();
        }
      }
      // A check requested while initialization was in flight must give its verdict before
      // the token may be authorized.
      if (ok && recheckRequested) {
        recheckRequested = false;
        payable = false;
        await reconcile();
        ok = valid() && payable && !terminalResult && !terminalUnavailable && readyConfig === startConfig;
      }
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
