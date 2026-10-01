import { useCallback, useEffect, useState } from 'react';

import { clientPaymentsService, type ClientInvoice } from '@/services/client/payments';

/**
 * Terminal payment phases for the booking success screen.
 *
 * The WebBrowser result alone is NOT trustworthy: the gateway may have failed,
 * or the user may have dismissed the browser before the redirect completed. The
 * backend invoice is the source of truth, so we poll it (mirroring the website
 * confirm-page polling) and only then branch the UI.
 *
 * - no invoice → 'confirmed' (pay-at-clinic / no online charge required)
 * - invoice PAID / DEPOSIT_PAID → 'confirmed'
 * - invoice cancelled/void or a payment FAILED → 'failed'
 * - a payment still PENDING / PENDING_VERIFICATION → 'pending'
 * - still settling after the polling window → 'pending'
 *
 * When the client cancelled or dismissed the hosted gateway the rules differ,
 * because the backend creates the PENDING card payment before the gateway
 * opens (see `abortedGatewayPhase`).
 */
export type PaymentPhase = 'polling' | 'confirmed' | 'pending' | 'failed';

const MAX_ATTEMPTS = 10;
const INTERVAL_MS = 3000;
/**
 * Extra checks after the client closed the gateway while a hosted (card /
 * Apple Pay) payment is still PENDING. They catch a charge that settled just
 * before the browser was dismissed; after them the attempt counts as abandoned.
 */
export const ABORTED_GATEWAY_RECHECKS = 2;

function isPaidInvoice(inv: ClientInvoice): boolean {
  return inv.status === 'PAID' || inv.status === 'DEPOSIT_PAID';
}

function isFailedInvoice(inv: ClientInvoice): boolean {
  return (
    inv.status === 'CANCELLED' ||
    inv.status === 'VOID' ||
    (inv.payments?.some((p) => p.status === 'FAILED') ?? false)
  );
}

function hasPendingPayment(inv: ClientInvoice): boolean {
  return (
    inv.payments?.some(
      (p) => p.status === 'PENDING' || p.status === 'PENDING_VERIFICATION',
    ) ?? false
  );
}

function normalized(value: string | null | undefined): string {
  return value?.trim().toUpperCase() ?? '';
}

/**
 * Payments that settle outside the hosted gateway: a bank transfer awaiting
 * its receipt or a receipt awaiting staff verification. Closing the browser
 * says nothing about them, so they stay 'pending'.
 */
function hasPendingOfflinePayment(inv: ClientInvoice): boolean {
  return (
    inv.payments?.some((p) => {
      const status = normalized(p.status);
      if (status === 'PENDING_VERIFICATION') return true;
      return status === 'PENDING' && normalized(p.method).replace('-', '_') === 'BANK_TRANSFER';
    }) ?? false
  );
}

function hasPendingHostedPayment(inv: ClientInvoice): boolean {
  return (
    inv.payments?.some(
      (p) =>
        normalized(p.status) === 'PENDING' &&
        normalized(p.method).replace('-', '_') !== 'BANK_TRANSFER',
    ) ?? false
  );
}

export function isAbortedGatewayResult(webResult?: string): boolean {
  return webResult === 'cancel' || webResult === 'dismiss';
}

/**
 * Phase after the client cancelled/dismissed the hosted gateway.
 *
 * The backend records a PENDING card payment before the gateway opens, so a
 * PENDING hosted payment alone does not mean money is on its way. `null` means
 * "check again shortly" (a recheck is still allowed).
 */
export function abortedGatewayPhase(
  inv: ClientInvoice,
  recheckAllowed: boolean,
): Exclude<PaymentPhase, 'polling'> | null {
  if (isPaidInvoice(inv)) return 'confirmed';
  if (inv.status === 'CANCELLED' || inv.status === 'VOID') return 'failed';
  if (hasPendingOfflinePayment(inv)) return 'pending';
  if (hasPendingHostedPayment(inv) && recheckAllowed) return null;
  return 'failed';
}

const CONFIRMED_BOOKING_STATUSES = new Set(['CONFIRMED', 'COMPLETED']);

/**
 * A paid invoice is NOT enough to call an appointment confirmed: the booking
 * itself must have reached CONFIRMED/COMPLETED (settlement lag or a deposit can
 * leave it pending). Mirrors the existing-checkout flow.
 *
 * An invoiced appointment is not confirmed until its booking can be read and
 * has a confirmed status. A failed read must never become a success message.
 */
export function resolveConfirmedPhase(
  paymentPhase: PaymentPhase,
  hasInvoice: boolean,
  bookingLoaded: boolean,
  bookingStatus: string | null | undefined,
): PaymentPhase {
  if (paymentPhase !== 'confirmed' || !hasInvoice) {
    return paymentPhase;
  }
  const status = bookingStatus?.trim().toUpperCase() ?? '';
  return bookingLoaded && CONFIRMED_BOOKING_STATUSES.has(status) ? 'confirmed' : 'pending';
}

/**
 * `webResult` is the `expo-web-browser` auth-session result type
 * ('success' | 'cancel' | 'dismiss' | 'locked'). When the user explicitly
 * aborted the gateway we resolve with `abortedGatewayPhase` instead of
 * spinning the full window (and ending on 'pending') for an abandoned charge,
 * so the success screen offers a payment retry for the same invoice.
 */
export function usePaymentStatus(invoiceId?: string, webResult?: string) {
  const [phase, setPhase] = useState<PaymentPhase>(invoiceId ? 'polling' : 'confirmed');
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!invoiceId) {
      setPhase('confirmed');
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    setPhase('polling');

    async function poll() {
      try {
        const inv = await clientPaymentsService.getInvoice(invoiceId!);
        if (cancelled) return;

        if (isAbortedGatewayResult(webResult)) {
          const abortedPhase = abortedGatewayPhase(inv, attempts < ABORTED_GATEWAY_RECHECKS);
          if (abortedPhase) {
            setPhase(abortedPhase);
            return;
          }
          attempts += 1;
          timer = setTimeout(poll, INTERVAL_MS);
          return;
        }

        if (isPaidInvoice(inv)) {
          setPhase('confirmed');
          return;
        }
        // A pending payment attempt (including a retry after a prior failure)
        // takes precedence over historical FAILED rows so the user sees the
        // correct settling state instead of a false negative.
        if (hasPendingPayment(inv)) {
          setPhase('pending');
          return;
        }
        if (isFailedInvoice(inv)) {
          setPhase('failed');
          return;
        }

        attempts += 1;
        if (attempts >= MAX_ATTEMPTS) {
          setPhase('pending');
          return;
        }
        timer = setTimeout(poll, INTERVAL_MS);
      } catch {
        if (cancelled) return;
        // A transient error during polling is NOT a payment failure — keep
        // retrying and fall back to 'pending', never to a false 'confirmed'.
        attempts += 1;
        if (attempts >= MAX_ATTEMPTS) {
          setPhase('pending');
          return;
        }
        timer = setTimeout(poll, INTERVAL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [invoiceId, webResult, retryNonce]);

  const checkAgain = useCallback(() => {
    setPhase('polling');
    setRetryNonce((n) => n + 1);
  }, []);

  return { phase, checkAgain };
}
