import type { CancellationRefund, PersistedCancellationRefund } from '@sawaa/api-client';
import { useT } from '@/features/locale/locale-provider';
import { halalasToSar } from '@/lib/money';

export function CancellationRefundSummary({ refund, preview = false }: { refund: CancellationRefund | PersistedCancellationRefund; preview?: boolean }) {
  const t = useT();
  const key = preview && refund.status === 'CREDIT_RETURNED' ? 'creditPreview'
    : preview && refund.execution === 'AUTOMATIC' ? 'automaticPreview'
    : preview && refund.execution === 'REVIEW' ? 'reviewPreview' : refund.status;
  const rows: [string, number][] = [
    ['amount', refund.refundAmount], ['alreadyAmount', refund.alreadyRefundedAmount],
    ['pendingAmount', refund.pendingRefundAmount],
    ...('completedAmount' in refund ? [['completedAmount', refund.completedAmount], ['failedAmount', refund.failedAmount]] as [string, number][] : []),
  ];
  return <div role="status" className="space-y-2 text-sm text-[var(--sw-body)]">
    <p>{t(`cancellation.${key}` as never)}</p>
    {refund.status !== 'CREDIT_RETURNED' && rows.map(([label, amount]) => amount > 0 &&
      <p key={label}>{t(`cancellation.${label}` as never)}: {halalasToSar(amount)} {refund.currency}{label === 'amount' && preview ? ` (${refund.refundPercent}%)` : ''}</p>)}
  </div>;
}
