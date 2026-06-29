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
 */
export type PaymentPhase = 'polling' | 'confirmed' | 'pending' | 'failed';

const MAX_ATTEMPTS = 10;
const INTERVAL_MS = 3000;

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

/**
 * `webResult` is the `expo-web-browser` auth-session result type
 * ('success' | 'cancel' | 'dismiss' | 'locked'). When the user explicitly
 * aborted the gateway and the backend has not yet recorded any payment, we
 * short-circuit to 'failed' rather than spinning the full window on an
 * abandoned charge.
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

        if (isPaidInvoice(inv)) {
          setPhase('confirmed');
          return;
        }
        if (isFailedInvoice(inv)) {
          setPhase('failed');
          return;
        }
        // Bank-transfer style verification is a legitimate non-failed state.
        if (hasPendingPayment(inv)) {
          setPhase('pending');
          return;
        }

        // User aborted the gateway and nothing was charged yet → failed.
        if (
          attempts === 0 &&
          (webResult === 'cancel' || webResult === 'dismiss') &&
          (inv.payments?.length ?? 0) === 0
        ) {
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
