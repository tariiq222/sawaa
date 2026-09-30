'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useT } from '@/features/locale/locale-provider';
import { SawaaLayout } from '@/themes/sawaa/layout/layout';

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
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-5 px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold text-[var(--sw-secondary-700)]">{t('payment.callback.title')}</h1>
      <p className="text-[var(--sw-body)]">{t('payment.callback.description')}</p>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        {/* Website continuation is the primary action: this page is reached from
         * the web booking flow, and most users have no idea what "the app" is
         * here (audit M1). The deep link stays available as a secondary option. */}
        <a className="flex-1 rounded-xl bg-[var(--sw-primary-600)] px-5 py-3 font-semibold text-[var(--sw-primary-600-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sw-primary-600)]" href={`/booking/confirm${suffix}`}>
          {t('payment.callback.website')}
        </a>
        <a className="flex-1 rounded-xl border border-[var(--sw-primary-600)] px-5 py-3 font-semibold text-[var(--sw-primary-600)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sw-primary-600)]" href={`sawa://booking/payment-callback${suffix}`}>
          {t('payment.callback.app')}
        </a>
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <SawaaLayout>
      <Suspense fallback={null}>
        <PaymentCallbackContent />
      </Suspense>
    </SawaaLayout>
  );
}
