import Image from 'next/image';
import { LoginForm } from '@/features/auth/public';
import { getLocale } from '@/features/locale/public';
import { t } from '@/features/locale/dictionary';

export async function SawaaLoginPage() {
  const locale = await getLocale();
  return (
    <section
      className="sw-section-mint relative overflow-hidden flex items-center justify-center px-5 pb-16 pt-32 sm:pt-36"
      style={{ minHeight: 'calc(100vh - 120px)' }}
    >
      {/* Decorative background shapes */}
      <div
        className="absolute -top-20 -start-20 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: 'color-mix(in srgb, var(--sw-primary-500) 8%, transparent)' }}
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-24 -end-24 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'color-mix(in srgb, var(--sw-secondary-700) 4%, transparent)' }}
        aria-hidden="true"
      />
      <div
        className="absolute top-1/4 -end-10 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: 'color-mix(in srgb, var(--sw-primary-500) 5%, transparent)' }}
        aria-hidden="true"
      />

      {/* Login card */}
      <div
        className="relative z-10 max-w-[440px] w-full mx-auto rounded-[28px]"
        style={{
          background: 'var(--sw-neutral-0)',
          boxShadow: 'var(--sw-shadow-xl)',
          padding: '2.5rem',
        }}
      >
        {/* Logo */}
        <Image
          src="/logos/sawa-logo.png"
          alt="سواء"
          width={120}
          height={40}
          className="h-10 mb-6 mx-auto block"
        />

        {/* Heading */}
        <h1
          style={{
            color: 'var(--sw-secondary-700)',
            fontWeight: 800,
            fontSize: '1.5rem',
            marginBottom: '0.375rem',
            textAlign: 'center',
          }}
        >
          {t(locale, 'auth.loginTitle')}
        </h1>

        {/* Subtitle */}
        <p
          style={{
            color: 'var(--sw-body)',
            fontSize: '0.9375rem',
            marginBottom: '1.75rem',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          {t(locale, 'auth.loginSubtitle')}
        </p>

        {/* Login form */}
        <LoginForm />

        {/* Register link */}
        <p
          style={{
            marginTop: '1.25rem',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: 'var(--sw-body)',
          }}
        >
          {t(locale, 'auth.noAccount')}{' '}
          <a
            href="/register"
            style={{ color: 'var(--sw-primary-600)', fontWeight: 700 }}
          >
            {t(locale, 'auth.register')}
          </a>
        </p>
      </div>
    </section>
  );
}
