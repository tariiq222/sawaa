import { getPublicPackageFamily } from '@/features/packages/packages.api';
import { PackagePurchaseFeature } from '@/features/packages/package-purchase';

export async function SawaaPackagePurchasePage({ packageId, packageFamilyId }: { packageId: string; packageFamilyId?: string }) {
  const family = packageFamilyId ? await getPublicPackageFamily(packageFamilyId).catch(() => null) : null;
  if (!family) return <section className="min-h-screen px-5 pb-20 pt-32 text-center"><p role="alert">Package not found.</p></section>;
  return <section className="sw-section-cream min-h-screen px-5 pb-20 pt-32"><PackagePurchaseFeature family={family} packageId={packageId} /></section>;
}
