import { BurnoutTest } from '@/features/burnout-test/public';
import { getLocale } from '@/features/locale/public';

export async function SawaaBurnoutTestPage() {
  const locale = await getLocale();
  return <BurnoutTest locale={locale} />;
}
