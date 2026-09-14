import { getPublicPackageFamily } from '@/features/packages/packages.api';
import { PackageDetailFeature } from '@/features/packages/package-detail';

export async function SawaaPackageDetailPage({ familyId }: { familyId: string }) {
  const family = await getPublicPackageFamily(familyId).catch(() => null);
  if (!family) return <section className="min-h-screen px-5 pb-20 pt-32 text-center"><p role="alert">Package not found.</p></section>;
  return <section className="sw-section-cream min-h-screen px-5 pb-20 pt-32"><PackageDetailFeature family={family} /></section>;
}
