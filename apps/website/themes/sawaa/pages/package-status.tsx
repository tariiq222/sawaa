'use client';

import { PackagePurchaseStatusFeature } from '@/features/packages/package-purchase';

export function SawaaPackageStatusPage({ purchaseId }: { purchaseId: string | null }) {
  if (!purchaseId) return <p role="alert">A purchase id is required.</p>;
  return <section className="sw-section-cream min-h-screen px-5 pb-20 pt-32"><PackagePurchaseStatusFeature purchaseId={purchaseId} /></section>;
}
