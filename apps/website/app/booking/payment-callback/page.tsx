'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useT } from '@/features/locale/locale-provider';

// Moyasar returns here after 3DS. The payment result is verified only after
// the client chooses a channel and that channel checks the booking status.
// Keep this public route out of middleware PROTECTED_PATHS.
function PaymentCallbackContent() {
  const t = useT();
  const params = useSearchParams();
  const identifiers = new URLSearchParams();
  const bookingId = params.get('bookingId');
  const invoiceId = params.get('invoiceId');
  if (bookingId) identifiers.set('bookingId', bookingId);
  if (invoiceId) identifiers.set('invoiceId', invoiceId);
  const query = identifiers.toString();
  const suffix = query ? `?${query}` : '';

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-5 px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold text-[var(--sw-secondary-700)]">{t('payment.callback.title')}</h1>
      <p className="text-[var(--sw-body)]">{t('payment.callback.description')}</p>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <a className="flex-1 rounded-xl bg-[var(--sw-primary-600)] px-5 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sw-primary-600)]" href={`sawa://booking/payment-callback${suffix}`}>
          {t('payment.callback.app')}
        </a>
        <a className="flex-1 rounded-xl border border-[var(--sw-primary-600)] px-5 py-3 font-semibold text-[var(--sw-primary-600)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sw-primary-600)]" href={`/booking/confirm${suffix}`}>
          {t('payment.callback.website')}
        </a>
      </div>
    </main>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={null}>
      <PaymentCallbackContent />
    </Suspense>
  );
}
