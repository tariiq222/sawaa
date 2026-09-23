'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function buildNativeCallbackUrl(bookingId: string | null, invoiceId: string | null): string {
  const target = new URLSearchParams();
  if (bookingId) target.set('bookingId', bookingId);
  if (invoiceId) target.set('invoiceId', invoiceId);
  const qs = target.toString();
  return `sawa://booking/payment-callback${qs ? `?${qs}` : ''}`;
}

// Moyasar's 3DS flow returns the client here via a cross-site top-level GET
// redirect (callback_url is built in the backend's init-client-payment
// handler). Website callbacks immediately bounce to /booking/confirm, which
// polls the booking status. Mobile callbacks attempt the fixed app deep link
// and keep a visible link for browsers that block automatic opening. This
// route must NOT be added to middleware PROTECTED_PATHS: the return must stay
// publicly reachable.
function PaymentCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const source = params.get('source');
  const bookingId = params.get('bookingId');
  const invoiceId = params.get('invoiceId');
  const nativeUrl = buildNativeCallbackUrl(bookingId, invoiceId);
  const isMobileCallback = source === 'mobile';

  useEffect(() => {
    if (isMobileCallback) {
      // The URL is a fixed app route; callback parameters are identifiers only
      // and do not assert payment or enrollment success.
      location.assign(nativeUrl);
      return;
    }

    const target = new URLSearchParams();
    if (bookingId) target.set('bookingId', bookingId);
    if (invoiceId) target.set('invoiceId', invoiceId);
    const qs = target.toString();
    // No bookingId → /booking/confirm renders its failed state on its own.
    router.replace(qs ? `/booking/confirm?${qs}` : '/booking/confirm');
  }, [bookingId, invoiceId, isMobileCallback, nativeUrl, router]);

  if (isMobileCallback) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p>جارٍ فتح التطبيق...</p>
        <a href={nativeUrl}>العودة إلى التطبيق</a>
      </div>
    );
  }

  return <div style={{ textAlign: 'center', padding: '3rem' }}>جارٍ التحميل...</div>;
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '3rem' }}>جارٍ التحميل...</div>}>
      <PaymentCallbackContent />
    </Suspense>
  );
}
