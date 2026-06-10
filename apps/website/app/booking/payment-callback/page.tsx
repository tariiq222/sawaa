'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Moyasar's 3DS flow returns the client here via a cross-site top-level GET
// redirect (callback_url is built in the backend's init-client-payment
// handler). This page renders nothing user-facing — it immediately bounces to
// /booking/confirm, which polls the booking status. It must NOT be added to
// the middleware PROTECTED_PATHS: the bounce must stay publicly reachable.
function PaymentCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const target = new URLSearchParams();
    const bookingId = params.get('bookingId');
    const invoiceId = params.get('invoiceId');
    if (bookingId) target.set('bookingId', bookingId);
    if (invoiceId) target.set('invoiceId', invoiceId);
    const qs = target.toString();
    // No bookingId → /booking/confirm renders its failed state on its own.
    router.replace(qs ? `/booking/confirm?${qs}` : '/booking/confirm');
  }, [params, router]);

  return <div style={{ textAlign: 'center', padding: '3rem' }}>جارٍ التحميل...</div>;
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '3rem' }}>جارٍ التحميل...</div>}>
      <PaymentCallbackContent />
    </Suspense>
  );
}
