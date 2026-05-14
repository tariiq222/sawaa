import { getLocale } from '@/features/locale/public';
import { t } from '@/features/locale/dictionary';
import { AccountFeature } from '@/features/account/account-feature';

export async function PremiumAccountPage() {
  const locale = await getLocale();
  return (
    <main style={{ padding: '4rem 2rem', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--primary)', marginBottom: '2rem', fontSize: '1.75rem' }}>
        {t(locale, 'account.title')}
      </h1>
      <AccountFeature locale={locale} />
    </main>
  );
}
