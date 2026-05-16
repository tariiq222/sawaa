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
  | { phase: 'failed'; bookingId: string | null }
  | { phase: 'pending'; bookingId: string };

function ConfirmContent() {
  const t = useT();
  const params = useSearchParams();
  const bookingId = params.get('bookingId');
  const [state, setState] = useState<ConfirmState>(
    bookingId ? { phase: 'loading' } : { phase: 'failed', bookingId: null },
  );

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
        if (!cancelled) {
          setState({ phase: 'failed', bookingId: bookingId });
        }
      }
    }

    poll();
    return () => { cancelled = true; };
  }, [bookingId]);

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
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>&#x2705;</div>
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

  if (state.phase === 'pending') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>&#x23F3;</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>{t('booking.paymentProcessing')}</h1>
        <p style={{ opacity: 0.7, marginBottom: '2rem' }}>
          {t('booking.paymentProcessingDesc')}
        </p>
        <Link
          href="/account/bookings"
          style={{ padding: '0.875rem 2rem', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius)', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}
        >
          {t('booking.viewBookings')}
        </Link>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '3rem' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>&#x274C;</div>
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
