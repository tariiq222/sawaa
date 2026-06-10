import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListClientInvoicesHandler } from './list-client-invoices.handler';

describe('ListClientInvoicesHandler', () => {
  let handler: ListClientInvoicesHandler;

  const baseInvoice = {
    id: 'inv-1',
    number: 1001,
    clientId: 'cl-1',
    bookingId: 'bk-1',
    subtotal: 15000,
    discountAmt: 0,
    vatRate: 0.15,
    vatAmt: 2250,
    total: 17250,
    refundedAmount: 0,
    currency: 'SAR',
    status: 'PAID',
    issuedAt: new Date('2026-01-02T10:00:00Z'),
    paidAt: new Date('2026-01-02T11:00:00Z'),
    createdAt: new Date('2026-01-02T09:00:00Z'),
  };

  const mockPrisma = {
    invoice: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    booking: { findMany: jest.fn() },
    payment: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListClientInvoicesHandler,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    handler = module.get<ListClientInvoicesHandler>(ListClientInvoicesHandler);
  });

  it('returns empty list when no invoices', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.invoice.count.mockResolvedValue(0);

    const result = await handler.execute('cl-1');

    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    expect(mockPrisma.booking.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.payment.findMany).not.toHaveBeenCalled();
  });

  it('excludes DRAFT invoices in the where clause', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.invoice.count.mockResolvedValue(0);

    await handler.execute('cl-1');

    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: 'cl-1', status: { not: 'DRAFT' } },
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(mockPrisma.invoice.count).toHaveBeenCalledWith({
      where: { clientId: 'cl-1', status: { not: 'DRAFT' } },
    });
  });

  it('maps invoice with booking snapshot and latest payment status', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([baseInvoice]);
    mockPrisma.invoice.count.mockResolvedValue(1);
    mockPrisma.booking.findMany.mockResolvedValue([
      { id: 'bk-1', serviceNameSnapshot: 'جلسة استشارية', scheduledAt: new Date('2026-01-05T14:00:00Z') },
    ]);
    mockPrisma.payment.findMany.mockResolvedValue([
      { id: 'pay-2', invoiceId: 'inv-1', status: 'COMPLETED', createdAt: new Date('2026-01-02T11:00:00Z') },
      { id: 'pay-1', invoiceId: 'inv-1', status: 'FAILED', createdAt: new Date('2026-01-02T10:30:00Z') },
    ]);

    const result = await handler.execute('cl-1');

    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual({
      id: 'inv-1',
      number: 1001,
      bookingId: 'bk-1',
      serviceName: 'جلسة استشارية',
      scheduledAt: '2026-01-05T14:00:00.000Z',
      subtotal: 15000,
      discountAmt: 0,
      vatRate: 0.15,
      vatAmt: 2250,
      total: 17250,
      refundedAmount: 0,
      currency: 'SAR',
      status: 'PAID',
      paymentStatus: 'COMPLETED',
      issuedAt: '2026-01-02T10:00:00.000Z',
      paidAt: '2026-01-02T11:00:00.000Z',
      createdAt: '2026-01-02T09:00:00.000Z',
    });
  });

  it('handles invoice without booking or payments', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([
      { ...baseInvoice, id: 'inv-2', bookingId: null, status: 'ISSUED', issuedAt: null, paidAt: null },
    ]);
    mockPrisma.invoice.count.mockResolvedValue(1);
    mockPrisma.payment.findMany.mockResolvedValue([]);

    const result = await handler.execute('cl-1');
    const item = result.items[0];

    expect(mockPrisma.booking.findMany).not.toHaveBeenCalled();
    expect(item.bookingId).toBeNull();
    expect(item.serviceName).toBe('');
    expect(item.scheduledAt).toBeNull();
    expect(item.paymentStatus).toBeNull();
    expect(item.issuedAt).toBeNull();
    expect(item.paidAt).toBeNull();
  });

  it('clamps pagination parameters', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.invoice.count.mockResolvedValue(0);

    const result = await handler.execute('cl-1', -5, 999);

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(100);
    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 100 }),
    );
  });

  it('respects pagination parameters', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.invoice.count.mockResolvedValue(45);

    const result = await handler.execute('cl-1', 3, 10);

    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(10);
    expect(result.total).toBe(45);
    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });
});
