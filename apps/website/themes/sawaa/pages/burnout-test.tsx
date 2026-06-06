import { BurnoutTest } from '@/features/burnout-test/public';
import { getLocale } from '@/features/locale/public';

export async function SawaaBurnoutTestPage() {
  const locale = await getLocale();
  return (
    <section
      className="sw-section-mint relative overflow-hidden -mt-[88px] pt-[120px] sm:pt-[140px] pb-16"
      style={{ minHeight: '100vh' }}
    >
      <div className="relative">
        <BurnoutTest locale={locale} />
      </div>
    </section>
  );
}
