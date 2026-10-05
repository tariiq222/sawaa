import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { GetInvoiceHandler } from './get-invoice.handler';
import { ListPaymentsHandler } from '../list-payments/list-payments.handler';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';

const mockInvoice = {
  id: 'inv-1',
  bookingId: 'booking-1',
  clientId: 'client-1',
  payments: [],
};

const mockPayment = {
  id: 'pay-1',
  invoiceId: 'inv-1',
  status: PaymentStatus.COMPLETED,
  method: PaymentMethod.CASH,
  amount: new Prisma.Decimal(15000),
  createdAt: new Date('2026-10-05T10:00:00Z'),
  processedAt: new Date('2026-10-05T10:00:00Z'),
  effectiveReceivedAt: new Date('2026-09-01T12:00:00Z'),
  receiptRecordedBy: 'staff-1',
  receiptEvidenceRef: 'receipt-1',
  receiptEntryReason: 'Late recording',
  invoice: { bookingId: 'booking-1', clientId: 'client-1', total: new Prisma.Decimal(40000) },
};
const mockClient = { id: 'client-1', name: 'Sara Ali', firstName: 'Sara', lastName: 'Ali', phone: '+966500000000' };

describe('GetInvoiceHandler', () => {
  it('returns invoice with payments when client owns the invoice', async () => {
    const prisma = { invoice: { findFirst: jest.fn().mockResolvedValue(mockInvoice) } };
    const handler = new GetInvoiceHandler(prisma as never);
    const result = await handler.execute({ invoiceId: 'inv-1', clientId: 'client-1' });
    expect(result.id).toBe('inv-1');
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'inv-1' }),
        include: expect.objectContaining({ payments: expect.anything() }),
      }),
    );
  });

  it('throws ForbiddenException when client does not own the invoice', async () => {
    const prisma = { invoice: { findFirst: jest.fn().mockResolvedValue({ ...mockInvoice, clientId: 'client-other' }) } };
    await expect(
      new GetInvoiceHandler(prisma as never).execute({ invoiceId: 'inv-1', clientId: 'client-1' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when invoice not found', async () => {
    const prisma = { invoice: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(new GetInvoiceHandler(prisma as never).execute({ invoiceId: 'bad', clientId: 'client-1' }))
      .rejects.toThrow(NotFoundException);
  });
});

describe('ListPaymentsHandler', () => {
  const buildPrisma = () => ({
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'pay-1' }]),
    client: { findMany: jest.fn().mockResolvedValue([mockClient]) },
    payment: {
      findMany: jest.fn().mockResolvedValue([mockPayment]),
      count: jest.fn().mockResolvedValue(1),
    },
  });

  it('returns paginated payments', async () => {
    const prisma = buildPrisma();
    const handler = new ListPaymentsHandler(prisma as never);
    const result = await handler.execute({ page: 1, limit: 10 });
    expect(result.items).toEqual([
      {
        ...mockPayment,
        collectionDate: '2026-09-01T12:00:00.000Z',
        invoice: { ...mockPayment.invoice, client: mockClient },
      },
    ]);
    const pageQuery = prisma.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(pageQuery.sql).toContain('ORDER BY COALESCE(p."effectiveReceivedAt", p."createdAt") DESC, p."id" DESC');
    expect(pageQuery.values).toEqual([10, 0]);
    expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['pay-1'] } },
    }));
    expect(result.meta.total).toBe(1);
  });

  it('filters by status', async () => {
    const prisma = buildPrisma();
    const handler = new ListPaymentsHandler(prisma as never);
    const result = await handler.execute({ page: 1, limit: 10, status: PaymentStatus.COMPLETED });
    expect(result.items.map(payment => payment.id)).toEqual(['pay-1']);
    expect((prisma.$queryRaw.mock.calls[0][0] as Prisma.Sql).values).toEqual(['COMPLETED', 10, 0]);
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: PaymentStatus.COMPLETED, id: { in: ['pay-1'] } } }),
    );
  });
});
