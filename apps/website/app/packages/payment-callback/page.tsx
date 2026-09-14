'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SawaaPackageStatusPage } from '@/themes/sawaa/pages/package-status';

function CallbackContent() {
  const params = useSearchParams();
  return <SawaaPackageStatusPage purchaseId={params.get('purchaseId')} />;
}

export default function PackagePaymentCallbackPage() {
  return <Suspense fallback={<p role="status">Loading payment status...</p>}><CallbackContent /></Suspense>;
}
