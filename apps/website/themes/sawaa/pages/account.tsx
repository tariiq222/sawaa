import { AccountFeature } from '@/features/account/account-feature';
import { getLocale } from '@/features/locale/public';

export async function SawaaAccountPage() {
  const locale = await getLocale();
  return (
    <section
      className="sw-section-cream relative overflow-hidden px-5 pb-20 -mt-[88px] pt-[140px] sm:pt-[160px]"
      style={{ minHeight: '100vh' }}
    >
      <div
        className="absolute -top-24 -start-20 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'color-mix(in srgb, var(--sw-primary-500) 6%, transparent)' }}
        aria-hidden="true"
      />
      <div className="relative max-w-3xl mx-auto">
        <AccountFeature locale={locale} />
      </div>
    </section>
  );
}
