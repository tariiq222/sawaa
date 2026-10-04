import Link from 'next/link';
import { getLocale } from '@/features/locale/public';
import { getPublicPackageFamily } from '@/features/packages/packages.api';
import { PackagePurchaseFeature } from '@/features/packages/package-purchase';
import { t as translate } from '@/features/locale/dictionary';

export async function SawaaPackagePurchasePage({ packageId, packageFamilyId }: { packageId: string; packageFamilyId?: string }) {
  const [locale, family] = await Promise.all([
    getLocale(),
    packageFamilyId ? getPublicPackageFamily(packageFamilyId).catch(() => null) : Promise.resolve(null),
  ]);
  if (!family) return <section className="min-h-screen px-5 pb-20 pt-32 text-center"><p role="alert" className="mb-4 text-[var(--sw-body)]">{translate(locale, 'packages.notFound')}</p><Link href="/packages" className="text-sm font-bold text-[var(--sw-primary-700)] underline">{translate(locale, 'packages.backToPackages')}</Link></section>;
  return <section className="sw-section-cream min-h-screen px-5 pb-20 pt-32"><PackagePurchaseFeature family={family} packageId={packageId} /></section>;
}
