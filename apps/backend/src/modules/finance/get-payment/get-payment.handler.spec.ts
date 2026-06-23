import { NotFoundException } from '@nestjs/common';
import { GetPaymentHandler } from './get-payment.handler';

// ---------------------------------------------------------------------------
// GetPaymentHandler
//
// Returns a single payment + invoice snapshot (bookingId, clientId, total) +
// a list of refundRequests, then enriches the invoice with the joined client
// (firstName / lastName / phone). The refundRequests list is ordered by
// createdAt desc, so the most recent refund is first.
// ---------------------------------------------------------------------------

const buildPayment = (overrides: Record<string, unknown> = {}) => ({
  id: 'pay-1',
  invoiceId: 'inv-1',
  amount: 15000,
  currency: 'SAR',
  method: 'CASH',
  status: 'COMPLETED',
  gatewayRef: null,
  idempotencyKey: null,
  createdAt: new Date('2026-01-15T10:00:00Z'),
  invoice: {
    bookingId: 'book-1',
    clientId: 'client-1',
    total: 15000,
  },
  refundRequests: [],
  ...overrides,
});

const buildInvoice = (overrides: Record<string, unknown> = {}) => ({
  bookingId: 'book-1',
  clientId: 'client-1',
  total: 15000,
  ...overrides,
});

const buildRefund = (overrides: Record<string, unknown> = {}) => ({
  id: 'rr-1',
  amount: 5000,
  status: 'COMPLETED',
  reason: 'customer request',
  createdAt: new Date('2026-02-01T10:00:00Z'),
  ...overrides,
});

const buildClient = (overrides: Record<string, unknown> = {}) => ({
  id: 'client-1',
  name: 'فاطمة',
  firstName: 'فاطمة',
  lastName: 'الزيد',
  phone: '+966500000000',
  ...overrides,
});

const buildHandler = (overrides: {
  payment?: ReturnType<typeof buildPayment> | null;
  client?: ReturnType<typeof buildClient> | null;
} = {}) => {
  const payment = overrides.payment === null ? null : overrides.payment ?? buildPayment();
  const client = overrides.client === null ? null : overrides.client ?? buildClient();
  const prisma = {
    payment: {
      findUnique: jest.fn().mockResolvedValue(payment),
    },
    client: {
      findUnique: jest.fn().mockResolvedValue(client),
    },
  };
  const handler = new GetPaymentHandler(prisma as never);
  return { handler, prisma };
};

describe('GetPaymentHandler', () => {
  it('returns the payment with its invoice + client enrichment and refundRequests', async () => {
    const payment = buildPayment({
      refundRequests: [buildRefund({ id: 'rr-2', amount: 3000 }), buildRefund({ id: 'rr-1', amount: 5000 })],
    });
    const { handler } = buildHandler({ payment });

    const result = await handler.execute({ paymentId: 'pay-1' });

    expect(result.id).toBe('pay-1');
    expect(result.invoice).toEqual(
      expect.objectContaining({
        bookingId: 'book-1',
        clientId: 'client-1',
        total: 15000,
        client: expect.objectContaining({
          id: 'client-1',
          firstName: 'فاطمة',
          lastName: 'الزيد',
          phone: '+966500000000',
        }),
      }),
    );
    expect(result.refundRequests).toHaveLength(2);
    expect(result.refundRequests[0].id).toBe('rr-2');
  });

  it('throws NotFoundException when the payment does not exist', async () => {
    const { handler } = buildHandler({ payment: null });
    await expect(handler.execute({ paymentId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('selects the invoice fields needed for downstream display (bookingId / clientId / total only)', async () => {
    const { handler, prisma } = buildHandler();

    await handler.execute({ paymentId: 'pay-1' });

    expect(prisma.payment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        include: expect.objectContaining({
          invoice: expect.objectContaining({
            select: { bookingId: true, clientId: true, total: true },
          }),
          refundRequests: expect.objectContaining({
            select: expect.objectContaining({
              id: true,
              amount: true,
              status: true,
              reason: true,
              createdAt: true,
            }),
            orderBy: { createdAt: 'desc' },
          }),
        }),
      }),
    );
  });

  it('orders refundRequests by createdAt descending (most recent refund first)', async () => {
    const payment = buildPayment({
      refundRequests: [
        buildRefund({ id: 'rr-newest', createdAt: new Date('2026-03-01T10:00:00Z') }),
        buildRefund({ id: 'rr-mid', createdAt: new Date('2026-02-01T10:00:00Z') }),
        buildRefund({ id: 'rr-oldest', createdAt: new Date('2026-01-01T10:00:00Z') }),
      ],
    });
    const { handler } = buildHandler({ payment });

    const result = await handler.execute({ paymentId: 'pay-1' });

    expect(result.refundRequests.map((r) => r.id)).toEqual([
      'rr-newest',
      'rr-mid',
      'rr-oldest',
    ]);
  });

  it('returns an empty refundRequests array when there are no refunds', async () => {
    const payment = buildPayment({ refundRequests: [] });
    const { handler } = buildHandler({ payment });

    const result = await handler.execute({ paymentId: 'pay-1' });
    expect(result.refundRequests).toEqual([]);
  });

  it('returns invoice: null when the payment has no linked invoice (e.g. partial write)', async () => {
    // P1: invoiceId may be present on the row but the include can still be null
    // — the handler must not throw, it must surface invoice=null.
    const payment = buildPayment();
    (payment as unknown as { invoice: ReturnType<typeof buildInvoice> | null }).invoice = null;
    const { handler, prisma } = buildHandler({ payment });

    const result = await handler.execute({ paymentId: 'pay-1' });

    expect(result.invoice).toBeNull();
    // No client lookup when invoice is null (defensive: don't 404 from a
    // missing client when the parent invoice itself is missing).
    expect(prisma.client.findUnique).not.toHaveBeenCalled();
  });

  it('returns invoice.client: null when the invoice has no clientId', async () => {
    // Invoice snapshot from the include, but the clientId is null
    // (e.g. legacy walk-in or pre-claim). Client lookup must be skipped.
    const payment = buildPayment();
    (payment as unknown as { invoice: ReturnType<typeof buildInvoice> }).invoice = buildInvoice({
      clientId: null as unknown as string,
    });
    const { handler, prisma } = buildHandler({ payment });

    const result = await handler.execute({ paymentId: 'pay-1' });

    expect(result.invoice?.clientId).toBeNull();
    expect(result.invoice?.client).toBeNull();
    expect(prisma.client.findUnique).not.toHaveBeenCalled();
  });

  it('selects only the safe client fields needed for the receipt (no passwordHash, no tokenVersion)', async () => {
    const { handler, prisma } = buildHandler();

    await handler.execute({ paymentId: 'pay-1' });

    expect(prisma.client.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'client-1' },
        select: { id: true, name: true, firstName: true, lastName: true, phone: true },
      }),
    );
  });
});
