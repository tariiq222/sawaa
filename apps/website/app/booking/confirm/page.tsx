'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { publicFetch, PublicFetchError } from '@/lib/public-fetch';
import { useT } from '@/features/locale/locale-provider';
import { SawaaLayout } from '@/themes/sawaa/layout/layout';

interface BookingStatus {
  bookingId: string;
  status: string;
  paymentStatus: string;
}

type ConfirmState =
  | { phase: 'loading' }
  | { phase: 'success'; bookingId: string }
  | { phase: 'deposit_paid'; bookingId: string }
  | { phase: 'failed'; bookingId: string }
  | { phase: 'pending'; bookingId: string }
  | { phase: 'unable_to_verify'; bookingId: string }
  | { phase: 'invalid_reference'; bookingId: string | null };

function isTerminalReferenceError(error: unknown): boolean {
  return (
    error instanceof PublicFetchError &&
    (error.status === 400 || error.status === 404)
  );
}

function ConfirmContent() {
  const t = useT();
  const params = useSearchParams();
  const bookingId = params.get('bookingId');
  const [prevBookingId, setPrevBookingId] = useState(bookingId);
  const [state, setState] = useState<ConfirmState>(
    bookingId ? { phase: 'loading' } : { phase: 'invalid_reference', bookingId: null },
  );

  if (bookingId !== prevBookingId) {
    setPrevBookingId(bookingId);
    setState(bookingId ? { phase: 'loading' } : { phase: 'invalid_reference', bookingId: null });
  }

  // Bumping this re-runs the polling effect — used by the "check again" button
  // when verification is pending or transiently unable to verify.
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!bookingId) return;

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let activeAbortController: AbortController | null = null;
    let attempts = 0;
    const maxAttempts = 10;
    const intervalMs = 3000;

    async function poll() {
      try {
        activeAbortController = new AbortController();
        const data = await publicFetch<BookingStatus>(
          `/public/bookings/${encodeURIComponent(bookingId!)}/status`,
          { cache: 'no-store', signal: activeAbortController.signal },
        );

        if (cancelled) return;

        if (data.status === 'DEPOSIT_PAID') {
          // Deposit paid: slot is reserved, a balance remains due. Terminal — stop polling.
          setState({ phase: 'deposit_paid', bookingId: bookingId! });
          return;
        }

        if (data.paymentStatus === 'COMPLETED' || data.status === 'CONFIRMED') {
          setState({ phase: 'success', bookingId: bookingId! });
          return;
        }

        if (data.paymentStatus === 'FAILED' || data.status === 'CANCELLED') {
          setState({ phase: 'failed', bookingId: bookingId! });
          return;
        }

        // Still pending according to the API — retry up to maxAttempts
        attempts++;
        if (attempts >= maxAttempts) {
          setState({ phase: 'pending', bookingId: bookingId! });
          return;
        }
        timerId = setTimeout(poll, intervalMs);
      } catch (error) {
        if (cancelled) return;

        // 400/404 reference error is terminal: stop immediately and report invalid reference
        if (isTerminalReferenceError(error)) {
          setState({ phase: 'invalid_reference', bookingId: bookingId! });
          return;
        }

        // A transient network/server error during polling is NOT a payment failure
        // Retry until maxAttempts, then surface as unable_to_verify so the user can retry
        attempts++;
        if (attempts >= maxAttempts) {
          setState({ phase: 'unable_to_verify', bookingId: bookingId! });
          return;
        }
        timerId = setTimeout(poll, intervalMs);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (activeAbortController !== null) {
        activeAbortController.abort();
        activeAbortController = null;
      }
    };
  }, [bookingId, retryNonce]);

  if (state.phase === 'loading') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        {/* M3: visible waiting state — polling can take up to ~30s and previously
         * showed a bare text line with no indication of expected duration. */}
        <div
          aria-hidden
          style={{
            width: 48,
            height: 48,
            margin: '0 auto 1.5rem',
            border: '3px solid color-mix(in srgb, var(--primary) 20%, transparent)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'sw-spin 0.9s linear infinite',
          }}
        />
        <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>{t('booking.checkingPayment')}</div>
        <p style={{ opacity: 0.65, fontSize: '0.875rem', maxWidth: '40ch', margin: '0 auto' }}>
          {t('booking.paymentVerifyNote')}
        </p>
        <style>{`@keyframes sw-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (state.phase === 'success') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div aria-hidden style={{ display: 'inline-flex', marginBottom: '1.5rem', color: 'var(--primary)' }}>
          <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l2.5 2.5 5.5-6" />
          </svg>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>{t('booking.confirmed')}</h1>
        <p style={{ opacity: 0.7, marginBottom: '2rem' }}>{t('booking.confirmedDesc')}</p>
        <Link
          href="/booking"
          style={{ padding: '0.875rem 2rem', background: 'var(--primary)', color: 'var(--on-primary)', borderRadius: 'var(--radius)', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}
        >
          {t('booking.bookAnother')}
        </Link>
      </div>
    );
  }

  if (state.phase === 'deposit_paid') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div aria-hidden style={{ display: 'inline-flex', marginBottom: '1.5rem', color: 'var(--primary)' }}>
          <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l2.5 2.5 5.5-6" />
          </svg>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>{t('booking.depositPaid')}</h1>
        <p style={{ opacity: 0.7, marginBottom: '2rem' }}>{t('booking.depositPaidDesc')}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/account/bookings"
            style={{ padding: '0.875rem 2rem', background: 'var(--primary)', color: 'var(--on-primary)', borderRadius: 'var(--radius)', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}
          >
            {t('booking.viewBookings')}
          </Link>
          <Link
            href="/booking"
            style={{ padding: '0.875rem 2rem', background: 'transparent', color: 'var(--primary)', borderRadius: 'var(--radius)', fontWeight: 600, textDecoration: 'none', display: 'inline-block', border: '1.5px solid color-mix(in srgb, var(--primary) 35%, transparent)' }}
          >
            {t('booking.bookAnother')}
          </Link>
        </div>
      </div>
    );
  }

  if (state.phase === 'pending') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div
          aria-hidden
          style={{ display: 'inline-flex', marginBottom: '1.5rem', color: 'var(--primary)' }}
        >
          <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>{t('booking.paymentProcessing')}</h1>
        <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
          {t('booking.paymentProcessingDesc')}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setState({ phase: 'loading' });
              setRetryNonce((n) => n + 1);
            }}
            style={{ padding: '0.875rem 2rem', background: 'var(--primary)', color: 'var(--on-primary)', borderRadius: 'var(--radius)', fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            {t('booking.checkAgain')}
          </button>
          <Link
            href="/account/bookings"
            style={{ padding: '0.875rem 2rem', background: 'transparent', color: 'var(--primary)', borderRadius: 'var(--radius)', fontWeight: 600, textDecoration: 'none', display: 'inline-block', border: '1.5px solid color-mix(in srgb, var(--primary) 35%, transparent)' }}
          >
            {t('booking.viewBookings')}
          </Link>
        </div>
      </div>
    );
  }

  if (state.phase === 'unable_to_verify') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div
          aria-hidden
          style={{ display: 'inline-flex', marginBottom: '1.5rem', color: 'var(--sw-accent-500, #f59e0b)' }}
        >
          <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>{t('booking.unableToVerify')}</h1>
        <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
          {t('booking.unableToVerifyDesc')}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setState({ phase: 'loading' });
              setRetryNonce((n) => n + 1);
            }}
            style={{ padding: '0.875rem 2rem', background: 'var(--primary)', color: 'var(--on-primary)', borderRadius: 'var(--radius)', fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            {t('booking.checkAgain')}
          </button>
          <Link
            href="/account/bookings"
            style={{ padding: '0.875rem 2rem', background: 'transparent', color: 'var(--primary)', borderRadius: 'var(--radius)', fontWeight: 600, textDecoration: 'none', display: 'inline-block', border: '1.5px solid color-mix(in srgb, var(--primary) 35%, transparent)' }}
          >
            {t('booking.viewBookings')}
          </Link>
        </div>
      </div>
    );
  }

  if (state.phase === 'invalid_reference') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div
          aria-hidden
          style={{ display: 'inline-flex', marginBottom: '1.5rem', color: 'var(--muted-foreground, #6b7280)' }}
        >
          <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>{t('booking.invalidReference')}</h1>
        <p style={{ opacity: 0.7, marginBottom: '2rem' }}>{t('booking.invalidReferenceDesc')}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/booking"
            style={{ padding: '0.875rem 2rem', background: 'var(--primary)', color: 'var(--on-primary)', borderRadius: 'var(--radius)', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}
          >
            {t('booking.bookAnother')}
          </Link>
          <Link
            href="/account/bookings"
            style={{ padding: '0.875rem 2rem', background: 'transparent', color: 'var(--primary)', borderRadius: 'var(--radius)', fontWeight: 600, textDecoration: 'none', display: 'inline-block', border: '1.5px solid color-mix(in srgb, var(--primary) 35%, transparent)' }}
          >
            {t('booking.viewBookings')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '3rem' }}>
      <div aria-hidden style={{ display: 'inline-flex', marginBottom: '1.5rem', color: 'var(--destructive)' }}>
        <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9l6 6M15 9l-6 6" />
        </svg>
      </div>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>{t('booking.paymentFailed')}</h1>
      <p style={{ opacity: 0.7, marginBottom: '2rem' }}>{t('booking.paymentFailedDesc')}</p>
      <Link
        href="/booking"
        style={{ padding: '0.875rem 2rem', background: 'var(--primary)', color: 'var(--on-primary)', borderRadius: 'var(--radius)', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}
      >
        {t('booking.tryAgain')}
      </Link>
    </div>
  );
}

export default function BookingConfirmPage() {
  return (
    <SawaaLayout>
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '3rem' }}>جارٍ التحميل...</div>}>
        <ConfirmContent />
      </Suspense>
    </SawaaLayout>
  );
}
