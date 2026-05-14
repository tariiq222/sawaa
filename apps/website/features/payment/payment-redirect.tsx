'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface PaymentRedirectProps {
  redirectUrl: string;
  bookingId: string;
}

export function PaymentRedirect({ redirectUrl, bookingId }: PaymentRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    if (!redirectUrl) {
      router.replace(`/booking/confirm?bookingId=${bookingId}&status=failed`);
      return;
    }
    window.location.href = redirectUrl;
  }, [redirectUrl, bookingId]);

  return (
    <div style={{ textAlign: 'center', padding: '3rem' }}>
      <div style={{ marginBottom: '1rem' }}>Redirecting to payment...</div>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '0.5rem 1rem',
          background: 'var(--primary)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius)',
          cursor: 'pointer',
        }}
      >
        Click here if not redirected
      </button>
    </div>
  );
}