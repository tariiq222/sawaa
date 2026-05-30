import { ResetPasswordForm } from '@/features/auth/public';
import { getLocale } from '@/features/locale/public';
import { t } from '@/features/locale/dictionary';
import { AuthCard } from '../components/auth-card';

export async function SawaaResetPasswordPage() {
  const locale = await getLocale();
  return (
    <AuthCard
      title={t(locale, 'auth.resetPasswordTitle')}
      subtitle={t(locale, 'auth.resetPasswordSubtitle')}
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
