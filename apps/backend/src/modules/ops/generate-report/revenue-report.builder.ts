import { PrismaService } from '../../../infrastructure/database';
import { PaymentStatus, Prisma, RefundStatus } from '@prisma/client';

export interface RevenueReportParams {
  from: Date;
  to: Date;
  branchId?: string;
  employeeId?: string;
}

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
  const { from, to, branchId, employeeId } = params;

  const bookingWhere = {
    scheduledAt: { gte: from, lte: to },
    ...(branchId ? { branchId } : {}),
    ...(employeeId ? { employeeId } : {}),
  };

  const invoiceWhere = {
    ...(branchId ? { branchId } : {}),
    ...(employeeId ? { employeeId } : {}),
  };
  const hasInvoiceFilter = Object.keys(invoiceWhere).length > 0;

  const [totalBookings, payments, refunds, redemptions, recentPaymentsRaw] =
    await Promise.all([
      prisma.booking.count({ where: bookingWhere }),
      prisma.payment.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          ...(hasInvoiceFilter ? { invoice: { is: invoiceWhere } } : {}),
        },
        select: {
          amount: true,
          method: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.refundRequest.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          status: RefundStatus.COMPLETED,
        },
        select: { amount: true },
      }),
      prisma.couponRedemption.findMany({
        where: { redeemedAt: { gte: from, lte: to } },
        select: { couponId: true, discount: true },
      }),
      prisma.payment.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          ...(hasInvoiceFilter ? { invoice: { is: invoiceWhere } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          createdAt: true,
          invoice: {
            select: {
              clientId: true,
              bookingId: true,
            },
          },
        },
      }),
    ]);

  let totalRevenueDec = new Prisma.Decimal(0);
  const methodMapDec = new Map<string, { amountDec: Prisma.Decimal; count: number }>();
  const statusMapDec = new Map<
    PaymentStatus,
    { amountDec: Prisma.Decimal; count: number }
  >();
  const dayMapDec = new Map<string, { amountDec: Prisma.Decimal; count: number }>();

  for (const p of payments) {
    const amountDec = new Prisma.Decimal(p.amount.toString());

    const sEntry = statusMapDec.get(p.status) ?? {
      amountDec: new Prisma.Decimal(0),
      count: 0,
    };
    sEntry.amountDec = sEntry.amountDec.plus(amountDec);
    sEntry.count += 1;
    statusMapDec.set(p.status, sEntry);

    if (p.status === PaymentStatus.COMPLETED) {
      totalRevenueDec = totalRevenueDec.plus(amountDec);
      const mEntry = methodMapDec.get(p.method) ?? {
        amountDec: new Prisma.Decimal(0),
        count: 0,
      };
      mEntry.amountDec = mEntry.amountDec.plus(amountDec);
      mEntry.count += 1;
      methodMapDec.set(p.method, mEntry);
      const day = p.createdAt.toISOString().slice(0, 10);
      const dEntry = dayMapDec.get(day) ?? {
        amountDec: new Prisma.Decimal(0),
        count: 0,
      };
      dEntry.amountDec = dEntry.amountDec.plus(amountDec);
      dEntry.count += 1;
      dayMapDec.set(day, dEntry);
    }
  }

  let refundsTotalDec = new Prisma.Decimal(0);
  for (const r of refunds) {
    refundsTotalDec = refundsTotalDec.plus(new Prisma.Decimal(r.amount.toString()));
  }

  const totalRevenue = totalRevenueDec.toNumber();
  const refundsTotal = refundsTotalDec.toNumber();
  const netRevenue = totalRevenueDec.minus(refundsTotalDec).toNumber();

  const averagePerBooking =
    totalBookings > 0
      ? totalRevenueDec
          .div(new Prisma.Decimal(totalBookings))
          .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
          .toNumber()
      : 0;

  const couponAgg = new Map<
    string,
    { uses: number; discountDec: Prisma.Decimal }
  >();
  for (const r of redemptions) {
    const entry = couponAgg.get(r.couponId) ?? {
      uses: 0,
      discountDec: new Prisma.Decimal(0),
    };
    entry.uses += 1;
    entry.discountDec = entry.discountDec.plus(
      new Prisma.Decimal(r.discount.toString()),
    );
    couponAgg.set(r.couponId, entry);
  }
  const couponIds = [...couponAgg.keys()];
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
        uses: agg.uses,
        discountAmount: agg.discountDec.toNumber(),
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

  const recentPayments = recentPaymentsRaw.map((p) => {
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
      date: p.createdAt.toISOString(),
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
    byMethod: [...methodMapDec.entries()].map(([method, v]) => ({
      method,
      amount: v.amountDec.toNumber(),
      count: v.count,
    })),
    byStatus: [...statusMapDec.entries()].map(([status, v]) => ({
      status,
      amount: v.amountDec.toNumber(),
      count: v.count,
    })),
    byDay: [...dayMapDec.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        amount: v.amountDec.toNumber(),
        count: v.count,
      })),
    couponsUsed,
    recentPayments,
  };
}
