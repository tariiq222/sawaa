import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { InitClientPaymentHandler } from './init-client-payment.handler';

const organizationId = '00000000-0000-0000-0000-000000000001';
const invoiceId = '00000000-0000-0000-0000-000000000101';
const bookingId = '00000000-0000-0000-0000-000000000201';
const clientId = '00000000-0000-0000-0000-000000000301';

const mockInvoice = {
  id: invoiceId,
  clientId,
  bookingId,
  total: 230,
  currency: 'SAR',
  organizationId,
};

const mockBooking = {
  id: bookingId,
  status: BookingStatus.PENDING,
};

const mockMoyasarPayment = {
  id: 'moyasar-payment-1',
  redirectUrl: 'https://checkout.moyasar.com/pay/moyasar-payment-1',
};

const buildPrisma = () => ({
  invoice: {
    findFirst: jest.fn().mockResolvedValue(mockInvoice),
  },
  booking: {
    findFirst: jest.fn().mockResolvedValue(mockBooking),
  },
  payment: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
    update: jest.fn().mockResolvedValue({ id: 'payment-1' }),
    delete: jest.fn().mockResolvedValue({ id: 'payment-1' }),
    // No prior COMPLETED payments by default → outstanding == total.
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
  },
});

const buildMoyasar = () => ({
  createPayment: jest.fn().mockResolvedValue(mockMoyasarPayment),
  // Default: any reconciled gateway session is terminally failed, so the handler
  // is free to discard the stale row and create a fresh one. Individual tests
  // override this to exercise the in-flight (`initiated`) and settled (`paid`)
  // branches of the G3 double-charge guard.
  getPaymentStatus: jest
    .fn()
    .mockResolvedValue({ id: 'moyasar-payment-existing', status: 'failed', amount: 230, currency: 'SAR' }),
});

const buildHandler = () => {
  const prisma = buildPrisma();
  const moyasar = buildMoyasar();
  const handler = new InitClientPaymentHandler(
    prisma as never,
    moyasar as never,
  );
  return { handler, prisma, moyasar };
};

describe('InitClientPaymentHandler', () => {
  it('returns redirect data and creates a pending payment row', async () => {
    const { handler, prisma, moyasar } = buildHandler();

    const result = await handler.execute({ invoiceId, clientId, method: 'ONLINE_CARD' });

    expect(result).toEqual({
      paymentId: 'payment-1',
      redirectUrl: 'https://checkout.moyasar.com/pay/moyasar-payment-1',
    });
    // org scoping moved to RLS / removed in single-tenant migration
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: {
        invoiceId,
        amount: 230,
        currency: 'SAR',
        method: PaymentMethod.ONLINE_CARD,
        status: PaymentStatus.PENDING,
        idempotencyKey: `client:${invoiceId}`,
      },
      select: { id: true },
    });
    expect(moyasar.createPayment).toHaveBeenCalledWith(organizationId, {
      amountHalalas: 230,
      currency: 'SAR',
      description: `Invoice payment - ${invoiceId}`,
      callbackUrl: `http://localhost:3000/booking/payment-callback?bookingId=${bookingId}&invoiceId=${invoiceId}`,
      metadata: { invoiceId, bookingId, source: 'mobile-client' },
      givenId: expect.any(String),
    });
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { gatewayRef: 'moyasar-payment-1' },
      select: { id: true },
    });
  });

  it('sends a fresh given_id per attempt that does not pin the invoice/amount', async () => {
    // Regression for the P0 where the gateway idempotency key was
    // `payment:${org}:${invoiceId}` — pinned to the first amount, so a top-up
    // after a deposit hit `400 already created`. The key must be a unique
    // UUID-shaped value per attempt, never the static invoice-keyed string.
    const { handler, moyasar } = buildHandler();

    await handler.execute({ invoiceId, clientId });

    const { givenId } = moyasar.createPayment.mock.calls[0][1];
    expect(givenId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(givenId).not.toContain(invoiceId);
    expect(givenId).not.toContain('payment:');
  });

  it('throws ForbiddenException when the invoice belongs to another client', async () => {
    const { handler, prisma } = buildHandler();
    prisma.invoice.findFirst.mockResolvedValue({ ...mockInvoice, clientId: 'foreign-client' });

    await expect(handler.execute({ invoiceId, clientId })).rejects.toThrow(ForbiddenException);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the invoice is missing', async () => {
    const { handler, prisma } = buildHandler();
    prisma.invoice.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ invoiceId, clientId })).rejects.toThrow(NotFoundException);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('discards a terminally-failed gateway session and creates a fresh one', async () => {
    const { handler, prisma, moyasar } = buildHandler();
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-existing',
      status: PaymentStatus.PENDING,
      gatewayRef: 'moyasar-payment-existing',
    });
    moyasar.getPaymentStatus.mockResolvedValue({ status: 'failed' });

    const result = await handler.execute({ invoiceId, clientId });

    expect(result).toEqual({
      paymentId: 'payment-1',
      redirectUrl: 'https://checkout.moyasar.com/pay/moyasar-payment-1',
    });
    expect(moyasar.getPaymentStatus).toHaveBeenCalledWith(organizationId, 'moyasar-payment-existing');
    expect(prisma.payment.delete).toHaveBeenCalledWith({ where: { id: 'payment-existing' } });
    expect(prisma.payment.create).toHaveBeenCalled();
    expect(moyasar.createPayment).toHaveBeenCalled();
  });

  // ─── G3: double-charge guard on in-flight gateway sessions ───────────────────

  it('G3: rejects a second init while the gateway session is still initiated (no double charge)', async () => {
    const { handler, prisma, moyasar } = buildHandler();
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-existing',
      status: PaymentStatus.PENDING,
      gatewayRef: 'moyasar-payment-existing',
    });
    moyasar.getPaymentStatus.mockResolvedValue({ status: 'initiated' });

    await expect(handler.execute({ invoiceId, clientId })).rejects.toThrow(ConflictException);
    // The live session must be preserved — never deleted, never duplicated.
    expect(prisma.payment.delete).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(moyasar.createPayment).not.toHaveBeenCalled();
  });

  it('G3: rejects a second init when the gateway session already settled (paid)', async () => {
    const { handler, prisma, moyasar } = buildHandler();
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-existing',
      status: PaymentStatus.PENDING,
      gatewayRef: 'moyasar-payment-existing',
    });
    moyasar.getPaymentStatus.mockResolvedValue({ status: 'paid' });

    await expect(handler.execute({ invoiceId, clientId })).rejects.toThrow(ConflictException);
    expect(prisma.payment.delete).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(moyasar.createPayment).not.toHaveBeenCalled();
  });

  it('G3: fails closed (no recreate) when the gateway status cannot be reconciled', async () => {
    const { handler, prisma, moyasar } = buildHandler();
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-existing',
      status: PaymentStatus.PENDING,
      gatewayRef: 'moyasar-payment-existing',
    });
    moyasar.getPaymentStatus.mockRejectedValue(new Error('Moyasar 500'));

    await expect(handler.execute({ invoiceId, clientId })).rejects.toThrow(ConflictException);
    expect(prisma.payment.delete).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(moyasar.createPayment).not.toHaveBeenCalled();
  });

  it('deletes the pending row when Moyasar throws so the idempotency key is not claimed', async () => {
    const { handler, prisma, moyasar } = buildHandler();
    const error = new Error('Moyasar unavailable');
    moyasar.createPayment.mockRejectedValue(error);

    await expect(handler.execute({ invoiceId, clientId })).rejects.toThrow(error);

    // org scoping moved to RLS / removed in single-tenant migration
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: {
        invoiceId,
        amount: 230,
        currency: 'SAR',
        method: PaymentMethod.ONLINE_CARD,
        status: PaymentStatus.PENDING,
        idempotencyKey: `client:${invoiceId}`,
      },
      select: { id: true },
    });
    expect(prisma.payment.delete).toHaveBeenCalledWith({ where: { id: 'payment-1' } });
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when Moyasar returns an empty redirectUrl', async () => {
    const { handler, prisma, moyasar } = buildHandler();
    moyasar.createPayment.mockResolvedValue({ id: 'moyasar-empty', redirectUrl: null });

    await expect(handler.execute({ invoiceId, clientId })).rejects.toThrow(BadRequestException);

    expect(prisma.payment.delete).toHaveBeenCalledWith({ where: { id: 'payment-1' } });
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('deletes an orphan idempotent payment and creates a fresh gateway payment', async () => {
    const { handler, prisma, moyasar } = buildHandler();
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-orphan',
      status: PaymentStatus.PENDING,
      gatewayRef: null,
    });

    const result = await handler.execute({ invoiceId, clientId });

    expect(result).toEqual({
      paymentId: 'payment-1',
      redirectUrl: 'https://checkout.moyasar.com/pay/moyasar-payment-1',
    });
    expect(prisma.payment.delete).toHaveBeenCalledWith({ where: { id: 'payment-orphan' } });
    // org scoping moved to RLS / removed in single-tenant migration
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: {
        invoiceId,
        amount: 230,
        currency: 'SAR',
        method: PaymentMethod.ONLINE_CARD,
        status: PaymentStatus.PENDING,
        idempotencyKey: `client:${invoiceId}`,
      },
      select: { id: true },
    });
    expect(moyasar.createPayment).toHaveBeenCalledWith(organizationId, {
      amountHalalas: 230,
      currency: 'SAR',
      description: `Invoice payment - ${invoiceId}`,
      callbackUrl: `http://localhost:3000/booking/payment-callback?bookingId=${bookingId}&invoiceId=${invoiceId}`,
      metadata: { invoiceId, bookingId, source: 'mobile-client' },
      givenId: expect.any(String),
    });
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { gatewayRef: 'moyasar-payment-1' },
      select: { id: true },
    });
  });

  it('throws ConflictException when an idempotent payment is already completed', async () => {
    const { handler, prisma } = buildHandler();
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-completed',
      status: PaymentStatus.COMPLETED,
    });

    await expect(handler.execute({ invoiceId, clientId })).rejects.toThrow(ConflictException);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('sends invoice.total to Moyasar verbatim — total is already in halalas', async () => {
    const { handler, prisma, moyasar } = buildHandler();
    prisma.invoice.findFirst.mockResolvedValue({ ...mockInvoice, total: 12000 });

    await handler.execute({ invoiceId, clientId });

    const params = moyasar.createPayment.mock.calls[0][1];
    expect(params.amountHalalas).toBe(12000);
    expect(params.amountHalalas).not.toBe(1200000);
  });

  it('charges only the OUTSTANDING balance to Moyasar when a deposit was already collected', async () => {
    const { handler, prisma, moyasar } = buildHandler();
    prisma.invoice.findFirst.mockResolvedValue({ ...mockInvoice, total: 12000 });
    // A 5000-halala deposit is already COMPLETED → outstanding = 7000.
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 5000 } });

    await handler.execute({ invoiceId, clientId });

    const params = moyasar.createPayment.mock.calls[0][1];
    expect(params.amountHalalas).toBe(7000);
    expect(params.amountHalalas).not.toBe(12000);
    // The PENDING Payment row must also carry the outstanding amount, not total.
    expect(prisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: 7000 }),
    }));
  });

  it('throws BadRequestException when the invoice is already fully paid (outstanding <= 0)', async () => {
    const { handler, prisma, moyasar } = buildHandler();
    prisma.invoice.findFirst.mockResolvedValue({ ...mockInvoice, total: 12000 });
    // COMPLETED payments already cover the full total → outstanding = 0.
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 12000 } });

    await expect(handler.execute({ invoiceId, clientId })).rejects.toThrow(BadRequestException);
    expect(moyasar.createPayment).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  // ─── bookingId propagation end-to-end ────────────────────────────────────────
  // The Payment model has no bookingId column by design — the link flows via
  // Invoice.bookingId → the published PaymentCompletedEvent payload. These
  // tests pin that contract so a future refactor cannot silently break the
  // path from init → invoice → payment → event → booking confirmation.

  it('links the new Payment row to the invoice (which carries the bookingId)', async () => {
    const { handler, prisma } = buildHandler();
    prisma.invoice.findFirst.mockResolvedValue({ ...mockInvoice, bookingId });

    await handler.execute({ invoiceId, clientId });

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ invoiceId }),
        select: { id: true },
      }),
    );
  });

  it('includes the invoice.bookingId in Moyasar metadata so the webhook can route back to the booking', async () => {
    const { handler, moyasar } = buildHandler();

    await handler.execute({ invoiceId, clientId });

    const moyasarCall = moyasar.createPayment.mock.calls[0][1];
    expect(moyasarCall.metadata).toEqual(
      expect.objectContaining({ invoiceId, bookingId, source: 'mobile-client' }),
    );
  });

  it('embeds the invoice.bookingId in the Moyasar callbackUrl', async () => {
    const { handler, moyasar } = buildHandler();

    await handler.execute({ invoiceId, clientId });

    const moyasarCall = moyasar.createPayment.mock.calls[0][1];
    expect(moyasarCall.callbackUrl).toContain(`bookingId=${bookingId}`);
    expect(moyasarCall.callbackUrl).toContain(`invoiceId=${invoiceId}`);
  });

  it('skips the booking status guard for package-purchase invoices (bookingId is null)', async () => {
    // Package invoices have no bookingId — the consumer side (PaymentCompletedEventHandler)
    // also skips booking confirmation when bookingId is null. The init handler must not
    // block payment init by trying to validate a non-existent booking.
    const { handler, prisma, moyasar } = buildHandler();
    prisma.invoice.findFirst.mockResolvedValue({ ...mockInvoice, bookingId: null });

    const result = await handler.execute({ invoiceId, clientId });

    expect(result.paymentId).toBe('payment-1');
    expect(prisma.booking.findFirst).not.toHaveBeenCalled();
    expect(moyasar.createPayment).toHaveBeenCalled();
    const moyasarCall = moyasar.createPayment.mock.calls[0][1];
    expect(moyasarCall.metadata).toEqual(
      expect.objectContaining({ invoiceId, bookingId: '', source: 'mobile-client' }),
    );
  });

  it('throws BadRequestException when the linked booking is no longer in a payable status', async () => {
    // Booking already moved on (e.g. CONFIRMED by an admin direct-confirm before the
    // client finished paying). The init handler must reject rather than create a
    // dangling payment row.
    const { handler, prisma, moyasar } = buildHandler();
    prisma.invoice.findFirst.mockResolvedValue({ ...mockInvoice, bookingId });
    prisma.booking.findFirst.mockResolvedValue({ id: bookingId, status: BookingStatus.CONFIRMED });

    await expect(handler.execute({ invoiceId, clientId })).rejects.toThrow(BadRequestException);
    expect(moyasar.createPayment).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});
