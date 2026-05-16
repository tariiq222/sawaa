'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div style={{ display: 'flex', minHeight: '50vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '6rem 1rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
        <div
          style={{
            width: '4rem',
            height: '4rem',
            borderRadius: '50%',
            background: 'color-mix(in srgb, var(--destructive, #ef4444) 10%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="var(--destructive, #ef4444)">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
          حدث خطأ غير متوقع
        </h2>
        <p style={{ maxWidth: '28rem', fontSize: '0.875rem', opacity: 0.6 }}>
          {error.message || 'نعتذر، حدث خطأ أثناء تحميل الصفحة. يرجى المحاولة مرة أخرى.'}
        </p>
      </div>
      <button
        onClick={() => reset()}
        style={{
          padding: '0.625rem 1.25rem',
          borderRadius: '0.5rem',
          background: 'var(--primary)',
          color: 'var(--on-primary, #fff)',
          fontSize: '0.875rem',
          fontWeight: 500,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
