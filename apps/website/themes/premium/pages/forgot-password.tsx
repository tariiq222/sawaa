import { ForgotPasswordForm } from '@/features/auth/public';
import { getLocale } from '@/features/locale/public';
import { t } from '@/features/locale/dictionary';

export async function PremiumForgotPasswordPage() {
  const locale = await getLocale();
  return (
    <main style={{ padding: '4rem 2rem', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '1.75rem' }}>
        {t(locale, 'auth.forgotPasswordTitle')}
      </h1>
      <p style={{ opacity: 0.75, marginBottom: '2rem', fontSize: '0.9375rem' }}>
        {t(locale, 'auth.forgotPasswordSubtitle')}
      </p>
      <ForgotPasswordForm />
    </main>
  );
}
