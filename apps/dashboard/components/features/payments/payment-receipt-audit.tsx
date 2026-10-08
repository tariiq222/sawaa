"use client"

import type { Payment } from '@/lib/types/payment'
import { useLocale } from '@/components/locale-provider'
import { DetailRow, DetailSection } from '@/components/features/detail-sheet-parts'
import { paymentCollectionDate } from './payment-dates'

export function PaymentReceiptAudit({ payment }: { payment: Payment }) {
  const { locale, t } = useLocale()
  const format = (value: string) => new Date(value).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    timeZone: 'Asia/Riyadh', calendar: 'gregory',
  })
  return (
    <DetailSection title={t('payments.audit.title')}>
      <DetailRow label={t('payments.audit.receivedAt')} value={format(paymentCollectionDate(payment))} numeric />
      <DetailRow label={t('payments.audit.recordedAt')} value={format(payment.createdAt)} numeric />
      {payment.processedAt && <DetailRow label={t('payments.audit.processedAt')} value={format(payment.processedAt)} numeric />}
      {payment.receiptRecordedBy && <DetailRow label={t('payments.audit.recordedBy')} value={payment.receiptRecordedBy} />}
      {payment.receiptEvidenceRef && <DetailRow label={t('payments.audit.evidence')} value={payment.receiptEvidenceRef} />}
      {payment.receiptEntryReason && <DetailRow label={t('payments.audit.reason')} value={payment.receiptEntryReason} />}
    </DetailSection>
  )
}
