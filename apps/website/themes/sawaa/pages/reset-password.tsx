import { ResetPasswordForm } from '@/features/auth/public';
import { getLocale } from '@/features/locale/public';
import { t } from '@/features/locale/dictionary';

export async function SawaaResetPasswordPage() {
  const locale = await getLocale();
  return (
    <main style={{ padding: '4rem 2rem', maxWidth: 480, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--primary-dark)', marginBottom: '0.5rem' }}>
        {t(locale, 'auth.resetPasswordTitle')}
      </h1>
      <p style={{ opacity: 0.7, marginBottom: '2rem', fontSize: '0.9375rem' }}>
        {t(locale, 'auth.resetPasswordSubtitle')}
      </p>
      <ResetPasswordForm />
    </main>
  );
}
