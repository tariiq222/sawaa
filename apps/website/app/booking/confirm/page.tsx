'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { publicFetch } from '@/lib/public-fetch';
import { useT } from '@/features/locale/locale-provider';

interface BookingStatus {
  bookingId: string;
  status: string;
  paymentStatus: string;
}

type ConfirmState =
  | { phase: 'loading' }
  | { phase: 'success'; bookingId: string }
  | { phase: 'deposit_paid'; bookingId: string }
  | { phase: 'failed'; bookingId: string | null }
  | { phase: 'pending'; bookingId: string };

function ConfirmContent() {
  const t = useT();
  const params = useSearchParams();
  const bookingId = params.get('bookingId');
  const [state, setState] = useState<ConfirmState>(
    bookingId ? { phase: 'loading' } : { phase: 'failed', bookingId: null },
  );
  // Bumping this re-runs the polling effect — used by the "check again" button
  // when the payment is still pending after the initial polling window.
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!bookingId) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 10;
    const intervalMs = 3000;

    async function poll() {
      try {
        const data = await publicFetch<BookingStatus>(
          `/public/bookings/${encodeURIComponent(bookingId!)}/status`,
          { cache: 'no-store' },
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

        // Still pending — retry
        attempts++;
        if (attempts >= maxAttempts) {
          setState({ phase: 'pending', bookingId: bookingId! });
          return;
        }
        setTimeout(poll, intervalMs);
      } catch {
        if (cancelled) return;
        // A transient network/server error during polling is NOT a payment
        // failure — surface it as still-pending so the user can retry rather
        // than wrongly telling them payment failed.
        attempts++;
        if (attempts >= maxAttempts) {
          setState({ phase: 'pending', bookingId: bookingId! });
          return;
        }
        setTimeout(poll, intervalMs);
      }
    }

    poll();
    return () => { cancelled = true; };
  }, [bookingId, retryNonce]);

  if (state.phase === 'loading') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ marginBottom: '1rem' }}>{t('booking.checkingPayment')}</div>
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
          style={{ padding: '0.875rem 2rem', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius)', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}
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
            style={{ padding: '0.875rem 2rem', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius)', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}
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
            style={{ padding: '0.875rem 2rem', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius)', fontWeight: 600, border: 'none', cursor: 'pointer' }}
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
        style={{ padding: '0.875rem 2rem', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius)', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}
      >
        {t('booking.tryAgain')}
      </Link>
    </div>
  );
}

export default function BookingConfirmPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '3rem' }}>جارٍ التحميل...</div>}>
      <ConfirmContent />
    </Suspense>
  );
}
