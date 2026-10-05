import { paymentCollectionDate } from '../../finance/payment-collection-date.helper';
import { PrismaService } from '../../../infrastructure/database';
import { PaymentStatus, Prisma } from '@prisma/client';
import { buildRevenueReportQuery, type RevenueReportParams } from './revenue-report-query.helper';
export type { RevenueReportParams } from './revenue-report-query.helper';

export interface RevenueReportResult {
  totalRevenue: number;
  netRevenue: number;
  totalBookings: number;
  averagePerBooking: number;
  refundsTotal: number;
  byMethod: Array<{ method: string; amount: number; count: number }>;
  byStatus: Array<{ status: PaymentStatus; amount: number; count: number }>;
  byDay: Array<{ date: string; amount: number; count: number }>;
  couponsUsed: Array<{
    code: string;
    uses: number;
    discountAmount: number;
    isActive: boolean;
  }>;
  recentPayments: Array<{
    id: string;
    date: string;
    recordedAt?: string;
    processedAt?: string | null;
    receiptRecordedBy?: string | null;
    receiptEvidenceRef?: string | null;
    receiptEntryReason?: string | null;
    clientName: string;
    serviceName: string;
    method: string;
    amount: number;
    status: PaymentStatus;
  }>;
}

export async function buildRevenueReport(
  prisma: PrismaService,
  params: RevenueReportParams,
): Promise<RevenueReportResult> {
  const query = buildRevenueReportQuery(params);

  const [paymentStatusRaw, paymentMethodRaw, paymentDayRaw, refundRaw, bookingRaw, redemptions, recentPaymentsRaw] =
    await Promise.all([
      prisma.$queryRaw<Array<{ status: string; amount: unknown; count: unknown }>>(
        query.paymentStatusAggregate,
      ),
      prisma.$queryRaw<Array<{ method: string; amount: unknown; count: unknown }>>(
        query.paymentMethodAggregate,
      ),
      prisma.$queryRaw<Array<{ date: string; amount: unknown; count: unknown }>>(
        query.paymentDayAggregate,
      ),
      prisma.$queryRaw<Array<{ amount: unknown }>>(query.refundAggregate),
      prisma.$queryRaw<Array<{ total: unknown; avgDurationMins: unknown }>>(
        query.bookingAggregate,
      ),
      prisma.$queryRaw<Array<{ couponId: string; uses: unknown; discount: unknown }>>(
        query.couponAggregate,
      ),
      prisma.$queryRaw<Array<{id: string}>>(query.recentPaymentIds).then(ids => prisma.payment.findMany({
        where: {...query.paymentWhere, id: {in: ids.map(({id}) => id)}},
        take: 10,
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          createdAt: true,
          effectiveReceivedAt: true,
          processedAt: true,
          receiptRecordedBy: true,
          receiptEvidenceRef: true,
          receiptEntryReason: true,
          invoice: {
            select: {
              clientId: true,
              bookingId: true,
            },
          },
        },
      })),
    ]);

  const asDecimal = (value: unknown) => new Prisma.Decimal(String(value ?? 0));
  const asInt = (value: unknown) =>
    typeof value === 'bigint' ? Number(value) : Number(value ?? 0);
  const asHalalas = (value: unknown) =>
    asDecimal(value).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();

  const totalRevenueDec = paymentMethodRaw.reduce(
    (sum, row) => sum.plus(asDecimal(row.amount)),
    new Prisma.Decimal(0),
  );
  const refundsTotalDec = asDecimal(refundRaw[0]?.amount);
  const totalBookings = asInt(bookingRaw[0]?.total);

  const totalRevenue = asHalalas(totalRevenueDec);
  const refundsTotal = asHalalas(refundsTotalDec);
  const netRevenue = asHalalas(totalRevenueDec.minus(refundsTotalDec));

  const averagePerBooking =
    totalBookings > 0
      ? totalRevenueDec
          .div(new Prisma.Decimal(totalBookings))
          .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
          .toNumber()
      : 0;

  const couponIds = redemptions.map((row) => row.couponId);
  const couponAgg = new Map(redemptions.map((row) => [row.couponId, row]));
  const coupons = couponIds.length
    ? await prisma.coupon.findMany({
        where: { id: { in: couponIds } },
        select: { id: true, code: true, isActive: true, expiresAt: true },
      })
    : [];
  const couponById = new Map(coupons.map((c) => [c.id, c]));
  const now = new Date();
  const couponsUsed = couponIds
    .map((id) => {
      const rec = couponById.get(id);
      const agg = couponAgg.get(id)!;
      const expired = rec?.expiresAt ? rec.expiresAt < now : false;
      return {
        code: rec?.code ?? '',
        uses: asInt(agg.uses),
        discountAmount: asHalalas(agg.discount),
        isActive: rec?.isActive === true && !expired,
      };
    })
    .filter((c) => c.code)
    .sort((a, b) => b.uses - a.uses);

  const recentClientIds = [
    ...new Set(
      recentPaymentsRaw
        .map((p) => p.invoice?.clientId)
        .filter((id): id is string => !!id),
    ),
  ];
  const recentBookingIds = [
    ...new Set(
      recentPaymentsRaw
        .map((p) => p.invoice?.bookingId)
        .filter((id): id is string => !!id),
    ),
  ];

  const [recentClients, recentBookings] = await Promise.all([
    recentClientIds.length
      ? prisma.client.findMany({
          where: { id: { in: recentClientIds } },
          select: { id: true, name: true, firstName: true, lastName: true },
        })
      : Promise.resolve([] as Array<{
          id: string;
          name: string;
          firstName: string | null;
          lastName: string | null;
        }>),
    recentBookingIds.length
      ? prisma.booking.findMany({
          where: { id: { in: recentBookingIds } },
          select: { id: true, serviceId: true },
        })
      : Promise.resolve([] as Array<{ id: string; serviceId: string | null }>),
  ]);
  const recentServiceIds = [...new Set(recentBookings.map((b) => b.serviceId).filter((id): id is string => id !== null))];
  const recentServices = recentServiceIds.length
    ? await prisma.service.findMany({
        where: { id: { in: recentServiceIds } },
        select: { id: true, nameAr: true, nameEn: true },
      })
    : [];

  const clientById = new Map(recentClients.map((c) => [c.id, c]));
  const bookingById = new Map(recentBookings.map((b) => [b.id, b]));
  const serviceById = new Map(recentServices.map((s) => [s.id, s]));

  const recentPayments = recentPaymentsRaw.sort((a, b) => paymentCollectionDate(b, 'CREATED').getTime() - paymentCollectionDate(a, 'CREATED').getTime() || b.id.localeCompare(a.id)).map((p) => {
    const c = p.invoice ? clientById.get(p.invoice.clientId) : undefined;
    const b = p.invoice?.bookingId
      ? bookingById.get(p.invoice.bookingId)
      : undefined;
    const s = b?.serviceId ? serviceById.get(b.serviceId) : undefined;
    const clientName =
      c?.firstName || c?.lastName
        ? [c?.firstName, c?.lastName].filter(Boolean).join(' ')
        : c?.name ?? '';
    return {
      id: p.id,
      date: paymentCollectionDate(p, 'CREATED').toISOString(),
      recordedAt: p.createdAt.toISOString(),
      processedAt: p.processedAt?.toISOString() ?? null,
      receiptRecordedBy: p.receiptRecordedBy ?? null,
      receiptEvidenceRef: p.receiptEvidenceRef ?? null,
      receiptEntryReason: p.receiptEntryReason ?? null,
      clientName,
      serviceName: s?.nameAr ?? '',
      method: p.method,
      amount: Number(p.amount.toString()),
      status: p.status,
    };
  });

  return {
    totalRevenue,
    netRevenue,
    totalBookings,
    averagePerBooking,
    refundsTotal,
    byMethod: paymentMethodRaw.map((row) => ({
      method: row.method,
      amount: asHalalas(row.amount),
      count: asInt(row.count),
    })),
    byStatus: paymentStatusRaw.map((row) => ({
      status: row.status as PaymentStatus,
      amount: asHalalas(row.amount),
      count: asInt(row.count),
    })),
    byDay: paymentDayRaw.map((row) => ({
      date: row.date,
      amount: asHalalas(row.amount),
      count: asInt(row.count),
    })),
    couponsUsed,
    recentPayments,
  };
}
