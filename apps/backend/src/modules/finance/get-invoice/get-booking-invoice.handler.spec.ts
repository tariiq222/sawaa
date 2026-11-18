import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildInvoice, createPrismaMock } from '../../../../test/factories';
import { GetBookingInvoiceHandler } from './get-booking-invoice.handler';

const mockInvoice = buildInvoice({
  id: 'inv-1',
  branchId: 'branch-1',
  clientId: 'client-1',
  employeeId: 'emp-1',
  bookingId: 'booking-1',
  subtotal: new Prisma.Decimal('100.00'),
  discountAmt: new Prisma.Decimal('10.00'),
  vatRate: new Prisma.Decimal('0.15'),
  vatAmt: new Prisma.Decimal('13.50'),
  total: new Prisma.Decimal('103.50'),
  refundedAmount: new Prisma.Decimal('0.00'),
  refundedVatAmt: new Prisma.Decimal('0.00'),
  currency: 'SAR',
  status: 'PAID',
  issuedAt: new Date('2026-04-17T10:00:00Z'),
  dueAt: null,
  paidAt: new Date('2026-04-17T10:05:00Z'),
  createdAt: new Date('2026-04-17T10:00:00Z'),
});

describe('GetBookingInvoiceHandler', () => {
  const buildPrisma = (invoice: typeof mockInvoice | null = mockInvoice) =>
    createPrismaMock({
      invoice: { findFirst: invoice },
      organizationSettings: {
        findFirst: {
          companyNameEn: 'Fallback Clinic',
          companyNameAr: 'عيادة احتياطية',
        },
      },
    });

  it('returns invoice scoped to booking + client', async () => {
    const prisma = buildPrisma();
    const handler = new GetBookingInvoiceHandler(prisma as never);

    const result = await handler.execute('booking-1', 'client-1');

    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: 'booking-1', clientId: 'client-1' },
      }),
    );
    expect(result.id).toBe('inv-1');
    expect(result.total).toBe(103.5);
  });

  it('returns the seller name from OrganizationSettings', async () => {
    const prisma = buildPrisma();
    const handler = new GetBookingInvoiceHandler(prisma as never);

    const result = await handler.execute('booking-1', 'client-1');

    expect(prisma.organizationSettings.findFirst).toHaveBeenCalledWith({
      select: { companyNameEn: true, companyNameAr: true },
    });
    expect(result.sellerName).toBe('Fallback Clinic');
  });

  it('throws NotFoundException when no invoice belongs to the booking for this client', async () => {
    const prisma = buildPrisma(null);
    const handler = new GetBookingInvoiceHandler(prisma as never);

    await expect(handler.execute('booking-x', 'client-1')).rejects.toThrow(NotFoundException);
  });
});
