import { Prisma } from '@prisma/client';

export type CollectionDateFallback = 'CREATED' | 'PROCESSED';
const riyadhDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
});
type CollectionDates = { effectiveReceivedAt?: Date | null; createdAt: Date; processedAt?: Date | null };

/** Operational timestamps stay intact; every collection consumer names its legacy fallback. */
export function paymentCollectionDate(payment: CollectionDates, fallback: 'CREATED'): Date;
export function paymentCollectionDate(payment: CollectionDates, fallback: 'PROCESSED'): Date | null;
export function paymentCollectionDate(payment: CollectionDates, fallback: CollectionDateFallback): Date | null {
  return payment.effectiveReceivedAt ?? (fallback === 'CREATED' ? payment.createdAt : payment.processedAt ?? null);
}

/** Alias is fixed by the reporting queries; no request strings enter SQL identifiers. */
export function paymentCollectionDateSql(fallback: CollectionDateFallback): Prisma.Sql {
  return fallback === 'CREATED'
    ? Prisma.sql`COALESCE(p."effectiveReceivedAt", p."createdAt")`
    : Prisma.sql`COALESCE(p."effectiveReceivedAt", p."processedAt")`;
}

export function paymentCollectionDateWhere(
  range: { gte?: Date; lt?: Date; lte?: Date },
  fallback: CollectionDateFallback,
): Prisma.PaymentWhereInput {
  return { OR: [
    { effectiveReceivedAt: range },
    { effectiveReceivedAt: null, ...(fallback === 'CREATED' ? {createdAt: range} : {processedAt: range}) },
  ] };
}

export function paymentCollectionDay(payment: CollectionDates, fallback: 'CREATED'): string {
  return riyadhDayFormatter.format(paymentCollectionDate(payment, fallback));
}
