'use client';

import { useBranding } from '@/features/branding/public';

export function PremiumHomePage() {
  const branding = useBranding();

  return (
    <main>
      <section
        style={{
          minHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: `radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent) 20%, transparent), transparent 60%)`,
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(3rem, 8vw, 6rem)',
            fontWeight: 200,
            letterSpacing: '-0.02em',
            margin: 0,
            textAlign: 'center',
          }}
        >
          {branding.organizationNameAr}
        </h1>
        {branding.productTagline ? (
          <p
            style={{
              marginTop: '2rem',
              fontSize: '1rem',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              opacity: 0.7,
            }}
          >
            {branding.productTagline}
          </p>
        ) : null}
        <button
          style={{
            marginTop: '3rem',
            padding: '1rem 3rem',
            background: 'transparent',
            color: '#f5f5f5',
            border: '1px solid rgba(255,255,255,0.3)',
            fontSize: '0.875rem',
            letterSpacing: '0.2em',
            cursor: 'pointer',
          }}
        >
          BOOK A SESSION
        </button>
      </section>
    </main>
  );
}
