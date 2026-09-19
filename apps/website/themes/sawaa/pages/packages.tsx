import { getLocale } from '@/features/locale/public';
import { getPublicPackageFamilies } from '@/features/packages/packages.api';
import { PackageCatalogFeature } from '@/features/packages/package-catalog';

export async function SawaaPackagesPage() {
  const [locale, families] = await Promise.all([
    getLocale(),
    getPublicPackageFamilies().catch(() => []),
  ]);
  return <section className="sw-section-cream min-h-screen px-5 pb-20 pt-32"><div className="mx-auto max-w-5xl"><h1 className="mb-3 text-4xl font-black text-[var(--sw-secondary-700)]">{locale === 'ar' ? 'الباقات العلاجية' : 'Therapy packages'}</h1><p className="mb-10 max-w-2xl leading-8 text-[var(--sw-body)]">{locale === 'ar' ? 'اختر عدد الجلسات المناسب لك واحتفظ برصيدك للحجز.' : 'Choose the session count that suits you and keep your balance ready to book.'}</p><PackageCatalogFeature families={families} /></div></section>;
}
