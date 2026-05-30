import { LoginForm } from '@/features/auth/public';
import { getLocale } from '@/features/locale/public';
import { t } from '@/features/locale/dictionary';
import { AuthCard } from '../components/auth-card';

export async function SawaaLoginPage() {
  const locale = await getLocale();
  return (
    <AuthCard
      title={t(locale, 'auth.loginTitle')}
      subtitle={t(locale, 'auth.loginSubtitle')}
      footer={
        <>
          {t(locale, 'auth.noAccount')}{' '}
          <a
            href="/register"
            className="text-[var(--sw-primary-600)] font-bold hover:underline"
          >
            {t(locale, 'auth.register')}
          </a>
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
