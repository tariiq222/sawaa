import { RegisterForm } from '@/features/auth/public';
import { getLocale } from '@/features/locale/public';
import { t } from '@/features/locale/dictionary';
import { AuthCard } from '../components/auth-card';

export async function SawaaRegisterPage() {
  const locale = await getLocale();
  return (
    <AuthCard
      title={t(locale, 'auth.registerTitle')}
      subtitle={t(locale, 'auth.registerSubtitle')}
      footer={
        <>
          {t(locale, 'auth.hasAccount')}{' '}
          <a
            href="/login"
            className="text-[var(--sw-primary-600)] font-bold hover:underline"
          >
            {t(locale, 'auth.login')}
          </a>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
