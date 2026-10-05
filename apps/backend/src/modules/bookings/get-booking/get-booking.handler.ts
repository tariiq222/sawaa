import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import {
  mapBookingRow,
  type BookingPackageFundingRelation,
  type BookingRelations,
} from '../booking-row.mapper';
import type { HistoricalPaymentMetadata } from '../historical-payment.helper';
import { resolveSessionValue } from '../session-value.helper';

export interface GetBookingQuery {
  bookingId: string;
  clientId?: string;
  /**
   * Caller identity for role-based ownership scoping (dashboard).
   *
   * When `role === 'EMPLOYEE'`, the booking is only returned if it is assigned
   * to the employee resolved from `userId` — mirroring the EMPLOYEE scoping in
   * list-bookings.handler. Privileged roles (OWNER/ADMIN/RECEPTIONIST/etc.) pass
   * no role here and keep full read access. AUTHZ-005.
   */
  role?: string | null;
  userId?: string;
}

@Injectable()
export class GetBookingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetBookingQuery) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: query.bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${query.bookingId} not found`);
    }
    if (query.clientId && booking.clientId !== query.clientId) {
      throw new ForbiddenException('Not your booking');
    }
    // AUTHZ-005: a counselor (EMPLOYEE) may only read bookings assigned to them.
    // Resolve their Employee.id from the JWT user id (Booking.employeeId is an
    // Employee.id, not a User.id) and reject access to any other employee's
    // booking. Other dashboard roles are unaffected.
    if (query.role === 'EMPLOYEE' && query.userId) {
      const emp = await this.prisma.employee.findFirst({
        where: { userId: query.userId },
        select: { id: true },
      });
      if (!emp || booking.employeeId !== emp.id) {
        throw new ForbiddenException('Booking is not assigned to you');
      }
    }

    const [client, employee, service, invoice, historicalRecord, credit, usage, rating] = await Promise.all([
      this.prisma.client.findFirst({ where: { id: booking.clientId } }),
      this.prisma.employee.findFirst({ where: { id: booking.employeeId } }),
      booking.serviceId ? this.prisma.service.findFirst({ where: { id: booking.serviceId } }) : Promise.resolve(null),
      this.prisma.invoice.findFirst({
        where: { bookingId: booking.id },
        select: {
          id: true,
          bookingId: true,
          subtotal: true,
          vatRate: true,
          total: true,
          status: true,
          payments: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              amount: true,
              refundedAmount: true,
                effectiveReceivedAt:true, createdAt:true, processedAt:true, receiptRecordedBy:true, receiptEvidenceRef:true, receiptEntryReason:true,
              method: true,
              status: true,
            },
          },
        },
      }),
      booking.isHistoricalImport
        ? this.prisma.legacyImportRecord.findFirst({
            where: {
              sourceSystem: 'booknetic',
              entityType: 'APPOINTMENT',
              targetType: 'Booking',
              targetId: booking.id,
            },
            select: { targetId: true, metadata: true },
          })
        : Promise.resolve(null),
      booking.packageCreditId
        ? this.prisma.packageCredit.findUnique({
            where: { id: booking.packageCreditId },
            select: { id: true, purchaseId: true, netValue: true, totalQuantity: true },
          })
        : Promise.resolve(null),
      booking.packageCreditId
        ? this.prisma.packageCreditUsage.findFirst({
            where: { bookingId: booking.id, creditId: booking.packageCreditId },
            select: { status: true },
          })
        : Promise.resolve(null),
      // Only the client-scoped mobile detail path needs rating state. Keeping
      // this conditional avoids adding a rating query to dashboard reads.
      query.clientId
        ? this.prisma.rating.findUnique({ where: { bookingId: booking.id }, select: { id: true } })
        : Promise.resolve(null),
    ]);

    const purchase = credit
      ? await this.prisma.packagePurchase.findUnique({
          where: { id: credit.purchaseId },
          select: { id: true, packageId: true, amountPaid: true, refundAmount: true },
        })
      : null;
    const pkg = purchase
      ? await this.prisma.sessionPackage.findFirst({
          where: { id: purchase.packageId },
          select: { id: true, nameAr: true, nameEn: true },
        })
      : null;
    // Fallback for a credit with no stored netValue (issued before phase 0
    // added the column): load every sibling credit of its purchase so
    // resolveSessionValue can split the purchase's net amount via
    // allocatePurchaseNet, same as the outstanding-credit report. A single
    // booking only ever has one package-funded credit, so this is one query.
    const siblingCredits =
      credit && credit.netValue == null
        ? await this.prisma.packageCredit.findMany({
            where: { purchaseId: credit.purchaseId },
            select: { id: true, unitPriceSnapshot: true, totalQuantity: true },
          })
        : [];
    const packageFundingByBookingId = new Map<string, BookingPackageFundingRelation>();
    if (credit && usage && purchase && pkg) {
      // Reporting-only figure: one session's share of the credit's net value.
      // The amount DUE on a package booking stays zero regardless of this.
      const sessionValue = resolveSessionValue(credit, purchase, siblingCredits);
      packageFundingByBookingId.set(booking.id, {
        creditId: credit.id,
        purchaseId: purchase.id,
        packageId: pkg.id,
        packageNameAr: pkg.nameAr,
        packageNameEn: pkg.nameEn ?? null,
        usageStatus: usage.status as 'RESERVED' | 'CONSUMED' | 'RETURNED',
        sessionValue,
      });
    }

    // Build paymentsByBookingId for this single booking
    // Payment.amount is Decimal(12,2) SAR → convert to halalat (× 100)
    const paymentsByBookingId = new Map<string, {
      id: string;
      amount: number;
      refundedAmount: number;
      effectiveReceivedAt?:Date|null; createdAt?:Date; processedAt?:Date|null; receiptRecordedBy?:string|null; receiptEvidenceRef?:string|null; receiptEntryReason?:string|null;
      method: string;
      status: string;
    }>();
    if (invoice && invoice.payments.length > 0) {
      const p = invoice.payments[0];
      paymentsByBookingId.set(booking.id, {
        id: p.id,
        amount: Math.round(Number(p.amount)),
        refundedAmount: Math.round(Number(p.refundedAmount)),
        method: p.method as string,
        status: p.status as string,
            effectiveReceivedAt:p.effectiveReceivedAt, createdAt:p.createdAt, processedAt:p.processedAt, receiptRecordedBy:p.receiptRecordedBy, receiptEvidenceRef:p.receiptEvidenceRef, receiptEntryReason:p.receiptEntryReason,
      });
    }

    const invoicesByBookingId = new Map<string, {
      id: string;
      subtotal: number;
      vatRate: number;
      total: number;
      outstanding: number;
      status: string;
    }>();
    if (invoice) {
      const paidHalalas = invoice.payments
        .filter((p) => p.status === 'COMPLETED')
        .reduce((sum, p) => sum + Math.round(Number(p.amount)), 0);
      const total = Math.round(Number(invoice.total));
      invoicesByBookingId.set(booking.id, {
        id: invoice.id,
        subtotal: Math.round(Number(invoice.subtotal)),
        vatRate: Number(invoice.vatRate),
        total,
        outstanding: Math.max(0, total - paidHalalas),
        status: invoice.status as string,
      });
    }

    const relations: BookingRelations = {
      clientsById: new Map(client ? [[client.id, client]] : []),
      employeesById: new Map(employee ? [[employee.id, employee]] : []),
      servicesById: new Map(service ? [[service.id, service]] : []),
      paymentsByBookingId,
      invoicesByBookingId,
      packageFundingByBookingId,
      historicalPaymentsByBookingId: new Map(
        historicalRecord?.targetId && historicalRecord.metadata
          ? [[
              historicalRecord.targetId,
              historicalRecord.metadata as HistoricalPaymentMetadata,
            ]]
          : [],
      ),
    };

    return mapBookingRow(booking, relations, query.clientId ? { hasRated: Boolean(rating) } : undefined);
  }
}
