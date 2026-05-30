import { ForgotPasswordForm } from '@/features/auth/public';
import { getLocale } from '@/features/locale/public';
import { t } from '@/features/locale/dictionary';
import { AuthCard } from '../components/auth-card';

export async function SawaaForgotPasswordPage() {
  const locale = await getLocale();
  return (
    <AuthCard
      title={t(locale, 'auth.forgotPasswordTitle')}
      subtitle={t(locale, 'auth.forgotPasswordSubtitle')}
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
