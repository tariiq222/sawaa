import { GroupSessionReadyHandler } from './group-session-ready.handler';
import { ConflictException } from '@nestjs/common';

const mockInvoice = { id: 'inv-1', bookingId: 'bk-1', total: 200 };

const buildDeps = (overrides: Partial<{
  bookings: object[];
  invoiceExists: boolean;
}> = {}) => {
  const bookings = overrides.bookings ?? [
    { id: 'bk-1', clientId: 'cl-1', employeeId: 'emp-1', branchId: 'br-1', price: '200.00', discountedPrice: null, currency: 'SAR' },
    { id: 'bk-2', clientId: 'cl-2', employeeId: 'emp-1', branchId: 'br-1', price: '200.00', discountedPrice: null, currency: 'SAR' },
  ];

  const prisma = {
    booking: { findMany: jest.fn().mockResolvedValue(bookings) },
    invoice: { findFirst: jest.fn().mockResolvedValue(overrides.invoiceExists ? mockInvoice : null) },
  };

  const createInvoice = {
    execute: jest.fn().mockResolvedValue(mockInvoice),
  };

  const eventBus = {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
  };

  return { prisma, createInvoice, eventBus };
};

describe('GroupSessionReadyHandler', () => {
  it('creates an invoice for each booking', async () => {
    const { prisma, createInvoice, eventBus } = buildDeps();
    const handler = new GroupSessionReadyHandler(prisma as never, eventBus as never, createInvoice as never);
    await handler.handleMinReached(['bk-1', 'bk-2'], 'emp-1:svc-1:2026-05-01T10:00:00.000Z');
    expect(createInvoice.execute).toHaveBeenCalledTimes(2);
  });

  it('uses discountedPrice when present', async () => {
    const { prisma, createInvoice, eventBus } = buildDeps({
      bookings: [
        { id: 'bk-1', clientId: 'cl-1', employeeId: 'emp-1', branchId: 'br-1', price: '200.00', discountedPrice: '150.00', currency: 'SAR' },
      ],
    });
    const handler = new GroupSessionReadyHandler(prisma as never, eventBus as never, createInvoice as never);
    await handler.handleMinReached(['bk-1'], 'key');
    expect(createInvoice.execute).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 150 }));
  });

  it('falls back to existing invoice on ConflictException (idempotency)', async () => {
    const { prisma, createInvoice, eventBus } = buildDeps({ invoiceExists: true });
    createInvoice.execute = jest.fn().mockRejectedValue(new ConflictException('exists'));
    const handler = new GroupSessionReadyHandler(prisma as never, eventBus as never, createInvoice as never);
    await handler.handleMinReached(['bk-1', 'bk-2'], 'key');
    expect(prisma.invoice.findFirst).toHaveBeenCalledTimes(2);
  });

  it('emits group_session.payment_links_ready with all invoices', async () => {
    const { prisma, createInvoice, eventBus } = buildDeps();
    const handler = new GroupSessionReadyHandler(prisma as never, eventBus as never, createInvoice as never);
    await handler.handleMinReached(['bk-1', 'bk-2'], 'key');
    expect(eventBus.publish).toHaveBeenCalledWith(
      'group_session.payment_links_ready',
      expect.objectContaining({
        payload: expect.objectContaining({
          paymentLinks: expect.arrayContaining([
            expect.objectContaining({ bookingId: 'bk-1', invoiceId: 'inv-1' }),
            expect.objectContaining({ bookingId: 'bk-2', invoiceId: 'inv-1' }),
          ]),
        }),
      }),
    );
  });

  it('does not emit event when no bookings are found', async () => {
    const { prisma, createInvoice, eventBus } = buildDeps({ bookings: [] });
    const handler = new GroupSessionReadyHandler(prisma as never, eventBus as never, createInvoice as never);
    await handler.handleMinReached([], 'key');
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('registers subscribe listener on register()', () => {
    const { prisma, createInvoice, eventBus } = buildDeps();
    const handler = new GroupSessionReadyHandler(prisma as never, eventBus as never, createInvoice as never);
    handler.register();
    expect(eventBus.subscribe).toHaveBeenCalledWith('group_session.min_reached', expect.any(Function));
  });
});
