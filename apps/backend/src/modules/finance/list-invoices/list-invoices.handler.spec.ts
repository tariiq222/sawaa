import { ListInvoicesHandler } from './list-invoices.handler';
import { InvoiceStatus } from '@prisma/client';

const mockInvoices = [
  {
    id: 'inv-1',
    number: 12,
    clientId: 'client-1',
    bookingId: 'booking-1',
    subtotal: 100,
    vatAmt: 15,
    total: 115,
    refundedAmount: 0,
    currency: 'SAR',
    status: 'PAID',
    issuedAt: new Date('2026-05-01'),
    paidAt: new Date('2026-05-02'),
    sentToClientAt: null,
    pdfUrl: 'finance/invoices/inv-1.pdf',
    createdAt: new Date('2026-05-01'),
  },
  {
    id: 'inv-2',
    number: 13,
    clientId: 'client-2',
    bookingId: null,
    subtotal: 200,
    vatAmt: 30,
    total: 230,
    refundedAmount: 0,
    currency: 'SAR',
    status: 'DRAFT',
    issuedAt: null,
    paidAt: null,
    sentToClientAt: null,
    pdfUrl: null,
    createdAt: new Date('2026-05-03'),
  },
];

const mockClients = [
  { id: 'client-1', name: 'Legacy Name', firstName: 'Sara', lastName: 'Ali' },
  { id: 'client-2', name: 'Fallback Only', firstName: null, lastName: null },
];

const buildPrisma = () => ({
  invoice: {
    findMany: jest.fn().mockResolvedValue(mockInvoices),
    count: jest.fn().mockResolvedValue(2),
  },
  client: {
    findMany: jest.fn().mockResolvedValue(mockClients),
  },
});

describe('ListInvoicesHandler', () => {
  it('returns paginated invoices with derived client name and hasPdf flag', async () => {
    const prisma = buildPrisma();
    const handler = new ListInvoicesHandler(prisma as never);
    const result = await handler.execute({ page: 1, limit: 10 });

    expect(result.items).toHaveLength(2);
    expect(result.meta.total).toBe(2);

    const [first, second] = result.items;
    // composed first/last name takes precedence over legacy `name`
    expect(first.clientName).toBe('Sara Ali');
    expect(first.hasPdf).toBe(true);
    expect(first.bookingId).toBe('booking-1');
    // falls back to legacy `name` when first/last are absent
    expect(second.clientName).toBe('Fallback Only');
    expect(second.hasPdf).toBe(false);
    // raw pdfUrl is never leaked to the client
    expect(first).not.toHaveProperty('pdfUrl');
  });

  it('filters by status when provided', async () => {
    const prisma = buildPrisma();
    const handler = new ListInvoicesHandler(prisma as never);
    await handler.execute({ status: InvoiceStatus.PAID, page: 1, limit: 10 });
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: InvoiceStatus.PAID }) }),
    );
  });

  it('filters by clientId and bookingId on the invoice itself', async () => {
    const prisma = buildPrisma();
    const handler = new ListInvoicesHandler(prisma as never);
    await handler.execute({ clientId: 'client-1', bookingId: 'booking-1', page: 1, limit: 10 });
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: 'client-1', bookingId: 'booking-1' }),
      }),
    );
  });

  it('includes date range filtering', async () => {
    const prisma = buildPrisma();
    const handler = new ListInvoicesHandler(prisma as never);
    const fromDate = new Date('2026-05-01');
    const toDate = new Date('2026-05-31');
    await handler.execute({ fromDate, toDate, page: 1, limit: 10 });
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: { gte: fromDate, lte: toDate } }),
      }),
    );
  });

  it('does not query clients when there are no invoices', async () => {
    const prisma = buildPrisma();
    prisma.invoice.findMany.mockResolvedValueOnce([]);
    prisma.invoice.count.mockResolvedValueOnce(0);
    const handler = new ListInvoicesHandler(prisma as never);
    const result = await handler.execute({ page: 1, limit: 10 });
    expect(result.items).toHaveLength(0);
    expect(prisma.client.findMany).not.toHaveBeenCalled();
  });
});
