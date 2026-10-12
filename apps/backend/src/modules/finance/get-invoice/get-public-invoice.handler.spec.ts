import { NotFoundException } from '@nestjs/common';
import { GetPublicInvoiceHandler } from './get-public-invoice.handler';

const mockInvoice = {
  id: 'inv-1',
  number: 42,
  organizationId: 'org-1',
  branchId: 'branch-1',
  clientId: 'client-1',
  employeeId: 'emp-1',
  bookingId: 'booking-1',
  subtotal: '100.00',
  discountAmt: '10.00',
  vatRate: '0.15',
  vatAmt: '13.50',
  total: '103.50',
  refundedAmount: '0.00',
  refundedVatAmt: '0.00',
  currency: 'SAR',
  status: 'PAID',
  issuedAt: new Date('2026-04-17T10:00:00Z'),
  dueAt: null,
  paidAt: new Date('2026-04-17T10:05:00Z'),
  createdAt: new Date('2026-04-17T10:00:00Z'),
  notes: 'staff only',
  discountAppliedBy: 'staff-1',
  payments: [
    {
      id: 'pay-1', number: 5, amount: '10350', refundedAmount: '0', currency: 'SAR',
      method: 'ONLINE_CARD', status: 'COMPLETED',
      createdAt: new Date('2026-04-17T10:01:00Z'), processedAt: new Date('2026-04-17T10:05:00Z'),
    },
  ],
};

describe('GetPublicInvoiceHandler', () => {
  const buildPrisma = (invoice: typeof mockInvoice | null = mockInvoice) => ({
    invoice: { findFirst: jest.fn().mockResolvedValue(invoice) },
    organizationSettings: {
      findFirst: jest.fn().mockResolvedValue({
        companyNameEn: 'Fallback Clinic',
        companyNameAr: 'عيادة احتياطية',
      }),
    },
  });

  it('returns invoice scoped to invoice + client', async () => {
    const prisma = buildPrisma();
    const handler = new GetPublicInvoiceHandler(prisma as never);

    const result = await handler.execute('inv-1', 'client-1');

    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1', clientId: 'client-1' },
      }),
    );
    expect(result.id).toBe('inv-1');
    expect(result.total).toBe(103.5);
  });

  it('returns the seller name from OrganizationSettings (English preferred)', async () => {
    const prisma = buildPrisma();
    const handler = new GetPublicInvoiceHandler(prisma as never);

    const result = await handler.execute('inv-1', 'client-1');

    expect(prisma.organizationSettings.findFirst).toHaveBeenCalledWith({
      select: { companyNameEn: true, companyNameAr: true },
    });
    expect(result.sellerName).toBe('Fallback Clinic');
  });

  it('falls back to Arabic company name when English is missing', async () => {
    const prisma = buildPrisma();
    prisma.organizationSettings.findFirst.mockResolvedValueOnce({
      companyNameEn: null,
      companyNameAr: 'عيادة احتياطية',
    });
    const handler = new GetPublicInvoiceHandler(prisma as never);

    const result = await handler.execute('inv-1', 'client-1');
    expect(result.sellerName).toBe('عيادة احتياطية');
  });

  it('falls back to "Sawaa" when settings have no names', async () => {
    const prisma = buildPrisma();
    prisma.organizationSettings.findFirst.mockResolvedValueOnce({
      companyNameEn: null,
      companyNameAr: null,
    });
    const handler = new GetPublicInvoiceHandler(prisma as never);

    const result = await handler.execute('inv-1', 'client-1');
    expect(result.sellerName).toBe('Sawaa');
  });

  it('throws NotFoundException when no invoice belongs to this client', async () => {
    const prisma = buildPrisma(null);
    const handler = new GetPublicInvoiceHandler(prisma as never);

    await expect(handler.execute('inv-x', 'client-1')).rejects.toThrow(NotFoundException);
  });

  it('returns the superset shape (invoice number + client-safe payments) with no staff-only fields', async () => {
    const prisma = buildPrisma();
    const handler = new GetPublicInvoiceHandler(prisma as never);

    const result = await handler.execute('inv-1', 'client-1');

    expect(result.number).toBe(42);
    expect(result.payments).toEqual([
      {
        id: 'pay-1', number: 5, amount: 10350, refundedAmount: 0, currency: 'SAR',
        method: 'ONLINE_CARD', status: 'COMPLETED',
        createdAt: '2026-04-17T10:01:00.000Z', processedAt: '2026-04-17T10:05:00.000Z',
      },
    ]);
    expect(result).not.toHaveProperty('notes');
    expect(result).not.toHaveProperty('discountAppliedBy');
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { payments: expect.objectContaining({ orderBy: { createdAt: 'desc' } }) },
      }),
    );
    const select = (prisma.invoice.findFirst.mock.calls[0][0] as any).include.payments.select;
    expect(select).not.toHaveProperty('gatewayRef');
    expect(select).not.toHaveProperty('receiptUrl');
    expect(select).not.toHaveProperty('idempotencyKey');
  });

  it('returns 404 for a foreign-owner invoice: ownership is inside the query, no existence leak', async () => {
    const prisma = buildPrisma(null);
    const handler = new GetPublicInvoiceHandler(prisma as never);

    await expect(handler.execute('inv-1', 'other-client')).rejects.toThrow(NotFoundException);
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv-1', clientId: 'other-client' } }),
    );
  });
});
