import { AuthGuard } from '@/features/auth/auth-guard';
import { PackageBalanceFeature } from '@/features/packages/package-balance';

export function SawaaAccountPackagesPage({ creditId }: { creditId?: string }) {
  return <section className="sw-section-cream min-h-screen px-5 pb-20 pt-32"><div className="mx-auto max-w-4xl"><AuthGuard><PackageBalanceFeature focusCreditId={creditId} /></AuthGuard></div></section>;
}
