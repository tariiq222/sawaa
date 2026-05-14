'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ConfirmContent() {
  const params = useSearchParams();
  const status = params.get('status') ?? 'pending';
  const bookingId = params.get('bookingId');

  if (status === 'success') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>✅</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Booking Confirmed!</h1>
        {bookingId && (
          <p style={{ opacity: 0.7, marginBottom: '0.5rem' }}>Booking ID: {bookingId}</p>
        )}
        <p style={{ opacity: 0.7, marginBottom: '2rem' }}>A confirmation email has been sent to your inbox.</p>
        <a
          href="/booking"
          style={{ padding: '0.875rem 2rem', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius)', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}
        >
          Book Another Appointment
        </a>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>❌</div>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Payment Failed</h1>
        <p style={{ opacity: 0.7, marginBottom: '2rem' }}>Your booking could not be confirmed. Please try again.</p>
        <a
          href="/booking"
          style={{ padding: '0.875rem 2rem', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius)', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}
        >
          Try Again
        </a>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '3rem' }}>
      <div style={{ marginBottom: '1rem' }}>Checking payment status...</div>
      <a
        href="/booking"
        style={{ padding: '0.875rem 2rem', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius)', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}
      >
        Go to Booking
      </a>
    </div>
  );
}

export default function BookingConfirmPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '3rem' }}>Loading...</div>}>
      <ConfirmContent />
    </Suspense>
  );
}