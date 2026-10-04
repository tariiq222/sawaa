'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SawaaPackageStatusPage } from '@/themes/sawaa/pages/package-status';
import { SawaaLayout } from '@/themes/sawaa/layout/layout';

function CallbackContent() {
  const params = useSearchParams();
  return <SawaaPackageStatusPage purchaseId={params.get('purchaseId')} />;
}

export default function PackagePaymentCallbackPage() {
  return (
    <SawaaLayout>
      <Suspense fallback={<p role="status">Loading payment status...</p>}>
        <CallbackContent />
      </Suspense>
    </SawaaLayout>
  );
}
