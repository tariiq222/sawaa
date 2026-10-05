import type { Payment } from '@/lib/types/payment'

/** Use the server projection; older servers may only expose the underlying fields. */
export function paymentCollectionDate(payment: Payment): string {
  return payment.collectionDate ?? payment.effectiveReceivedAt ?? payment.createdAt
}
