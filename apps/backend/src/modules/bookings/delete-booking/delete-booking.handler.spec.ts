import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { DeleteBookingHandler } from './delete-booking.handler';

const buildPrisma = (overrides: Record<string, unknown> = {}) => {
  const callOrder: string[] = [];
  let tx: any;
  tx = {
    $queryRaw: jest.fn().mockImplementation(async (strings: string[]) => {
      const sql = strings.join(' ');
      if (sql.includes('FROM "Booking"')) {
        callOrder.push('booking-lock');
        return [{ id: 'book-1' }];
      }
      if (sql.includes('FROM "Invoice"')) {
        callOrder.push('invoice-lock');
        const invoice = await tx.invoice.findUnique();
        return invoice ? [invoice] : [];
      }
      if (sql.includes('FROM "PaymentCollectionIdempotency"')) {
        callOrder.push('idempotency-lock');
        return [];
      }
      if (sql.includes('FROM "RefundRequest"')) {
        callOrder.push('refund-lock');
        return [];
      }
      if (sql.includes('FROM "Payment"')) {
        callOrder.push('payment-lock');
        return [];
      }
      throw new Error(`Unexpected raw SQL: ${sql}`);
    }),
    invoice: {
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({ id: 'inv-1' }),
    },
    refundRequest: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    paymentCollectionIdempotency: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    bookingStatusLog: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    rating: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    intakeResponse: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockImplementation(async () => {
        callOrder.push('response-delete');
        return { count: 0 };
      }),
    },
    intakeResponseRevision: {
      createMany: jest.fn().mockImplementation(async () => {
        callOrder.push('response-revision');
        return { count: 0 };
      }),
    },
    payment: {
      findFirst: jest.fn().mockImplementation(async () => {
        callOrder.push('payment-guard');
        return null;
      }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    activityLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
    booking: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'book-1',
        status: BookingStatus.EXPIRED,
        bookingNumber: 1234,
        clientId: 'client-1',
        serviceNameSnapshot: 'جلسة فردية',
        scheduledAt: new Date('2026-01-01T10:00:00Z'),
        isHistoricalImport: false,
      }),
      delete: jest.fn().mockResolvedValue({ id: 'book-1' }),
    },
  };
  const prisma = {
    booking: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'book-1',
        status: BookingStatus.EXPIRED,
        bookingNumber: 1234,
        clientId: 'client-1',
        serviceNameSnapshot: 'جلسة فردية',
        scheduledAt: new Date('2026-01-01T10:00:00Z'),
      }),
    },
    payment: { findFirst: jest.fn().mockResolvedValue(null) },
    ...overrides,
  };
  return { prisma, tx, callOrder };
};

const buildRls = (tx: unknown) => ({
  withTransaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
});

describe('DeleteBookingHandler', () => {
  it('hard-deletes a clean terminal booking with no invoice', async () => {
    const { prisma, tx } = buildPrisma();
    await new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
      bookingId: 'book-1',
      changedBy: 'admin-1',
    });

    expect(tx.invoice.delete).not.toHaveBeenCalled();
    expect(tx.bookingStatusLog.deleteMany).toHaveBeenCalledWith({ where: { bookingId: 'book-1' } });
    expect(tx.rating.deleteMany).toHaveBeenCalledWith({ where: { bookingId: 'book-1' } });
    expect(tx.intakeResponse.deleteMany).toHaveBeenCalledWith({ where: { bookingId: 'book-1' } });
    expect(tx.booking.delete).toHaveBeenCalledWith({ where: { id: 'book-1' } });
  });

  it('does not run a global payment guard when the booking has no invoice', async () => {
    const { prisma, tx } = buildPrisma();

    await new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
      bookingId: 'book-1',
      changedBy: 'admin-1',
    });

    expect(tx.payment.findFirst).not.toHaveBeenCalled();
  });

  it('archives every intake response before deleting booking responses', async () => {
    const { prisma, tx, callOrder } = buildPrisma();
    tx.intakeResponse.findMany.mockResolvedValue([
      {
        id: 'response-current',
        bookingId: 'book-1',
        formId: 'form-1',
        clientId: 'client-1',
        answers: { q1: 'current' },
        supersededAt: null,
      },
      {
        id: 'response-old',
        bookingId: 'book-1',
        formId: 'form-1',
        clientId: 'client-1',
        answers: { q1: 'old' },
        supersededAt: new Date('2026-01-02T10:00:00Z'),
      },
    ]);

    await new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
      bookingId: 'book-1',
      changedBy: 'admin-1',
    });

    expect(tx.intakeResponseRevision.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          sourceResponseId: 'response-current',
          bookingId: 'book-1',
          formId: 'form-1',
          clientId: 'client-1',
          answers: { q1: 'current' },
          reason: 'AUTHORIZED_DELETE',
        }),
        expect.objectContaining({
          sourceResponseId: 'response-old',
          answers: { q1: 'old' },
          reason: 'AUTHORIZED_DELETE',
        }),
      ],
    });
    expect(callOrder.indexOf('response-revision')).toBeLessThan(callOrder.indexOf('response-delete'));
  });

  it('does not delete a booking when intake archival fails', async () => {
    const { prisma, tx } = buildPrisma();
    tx.intakeResponse.findMany.mockResolvedValue([{
      id: 'response-1',
      bookingId: 'book-1',
      formId: 'form-1',
      clientId: 'client-1',
      answers: { q1: 'answer' },
      supersededAt: null,
    }]);
    tx.intakeResponseRevision.createMany.mockRejectedValue(new Error('archive unavailable'));

    await expect(new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
      bookingId: 'book-1',
      changedBy: 'admin-1',
    })).rejects.toThrow('archive unavailable');
    expect(tx.intakeResponse.deleteMany).not.toHaveBeenCalled();
    expect(tx.booking.delete).not.toHaveBeenCalled();
  });

  it('takes the booking row lock before intake archival and deletion', async () => {
    const { prisma, tx, callOrder } = buildPrisma();
    await new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
      bookingId: 'book-1',
      changedBy: 'admin-1',
    });

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect((tx.$queryRaw.mock.calls[0][0] as string[]).join('')).toMatch(/FOR UPDATE/i);
    expect(callOrder.indexOf('booking-lock')).toBeLessThan(callOrder.indexOf('response-delete'));
  });

  it('locks the related invoice before the fresh transaction payment guard', async () => {
    const { prisma, tx, callOrder } = buildPrisma();
    tx.invoice.findUnique.mockResolvedValue({ id: 'invoice-1' });

    await new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
      bookingId: 'book-1',
      changedBy: 'admin-1',
    });

    expect(callOrder.indexOf('booking-lock')).toBeLessThan(callOrder.indexOf('invoice-lock'));
    expect(callOrder.indexOf('invoice-lock')).toBeLessThan(callOrder.indexOf('payment-guard'));
  });

  it('locks the invoice and every restrictive finance dependent NOWAIT before the payment guard', async () => {
    const { prisma, tx, callOrder } = buildPrisma();
    tx.invoice.findUnique.mockResolvedValue({ id: 'invoice-1' });

    await new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
      bookingId: 'book-1',
      changedBy: 'admin-1',
    });

    const rawSql = tx.$queryRaw.mock.calls.map((call: unknown[]) =>
      (call[0] as string[]).join(' ').replace(/\s+/g, ' ').trim(),
    );
    expect(rawSql).toEqual([
      expect.stringMatching(/FROM "Booking".*FOR UPDATE$/i),
      expect.stringMatching(/FROM "Invoice".*"bookingId".*FOR UPDATE NOWAIT$/i),
      expect.stringMatching(/FROM "PaymentCollectionIdempotency".*"invoiceId".*ORDER BY.*FOR UPDATE NOWAIT$/i),
      expect.stringMatching(/FROM "RefundRequest".*"invoiceId".*ORDER BY.*FOR UPDATE NOWAIT$/i),
      expect.stringMatching(/FROM "Payment".*"invoiceId".*ORDER BY.*FOR UPDATE NOWAIT$/i),
    ]);
    expect(callOrder.indexOf('payment-guard')).toBeGreaterThanOrEqual(0);
    expect(tx.$queryRaw.mock.invocationCallOrder.at(-1)).toBeLessThan(
      tx.payment.findFirst.mock.invocationCallOrder[0],
    );
  });

  it.each([
    { code: '55P03' },
    { code: 'P2010', meta: { code: '55P03' } },
    {
      code: 'P2010',
      meta: { driverAdapterError: { cause: { originalCode: '55P03' } } },
    },
  ])('maps a finance NOWAIT contention to 409 without deleting (%j)', async (lockError) => {
    const { prisma, tx } = buildPrisma();
    tx.invoice.findUnique.mockResolvedValue({ id: 'invoice-1' });
    tx.$queryRaw
      .mockResolvedValueOnce([{ id: 'book-1' }])
      .mockRejectedValueOnce(lockError);

    await expect(
      new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
        bookingId: 'book-1',
        changedBy: 'admin-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.payment.deleteMany).not.toHaveBeenCalled();
    expect(tx.invoice.delete).not.toHaveBeenCalled();
    expect(tx.booking.delete).not.toHaveBeenCalled();
  });

  it('does not translate an unrelated database error', async () => {
    const { prisma, tx } = buildPrisma();
    const databaseError = new Error('database unavailable');
    tx.$queryRaw.mockRejectedValueOnce(databaseError);

    await expect(
      new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
        bookingId: 'book-1',
        changedBy: 'admin-1',
      }),
    ).rejects.toBe(databaseError);
  });

  it('writes an immutable audit row inside the transaction before deleting the booking (R-11/R-17)', async () => {
    const { prisma, tx } = buildPrisma();
    const callOrder: string[] = [];
    tx.activityLog.create.mockImplementation(async () => { callOrder.push('audit'); return { id: 'log-1' }; });
    tx.booking.delete.mockImplementation(async () => { callOrder.push('delete'); return { id: 'book-1' }; });

    await new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
      bookingId: 'book-1',
      changedBy: 'admin-7',
    });

    expect(tx.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'DELETE',
        entity: 'Booking',
        entityId: 'book-1',
        userId: 'admin-7',
        metadata: expect.objectContaining({ bookingNumber: 1234, clientId: 'client-1' }),
      }),
    });
    // The audit row must land before the booking row is removed.
    expect(callOrder).toEqual(['audit', 'delete']);
  });

  it('deletes invoice, payments and refund requests when an invoice exists', async () => {
    const { prisma, tx } = buildPrisma();
    tx.invoice.findUnique = jest.fn().mockResolvedValue({ id: 'inv-1' });

    await new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
      bookingId: 'book-1',
      changedBy: 'admin-1',
    });

    expect(tx.refundRequest.deleteMany).toHaveBeenCalledWith({ where: { invoiceId: 'inv-1' } });
    expect(tx.paymentCollectionIdempotency.deleteMany).toHaveBeenCalledWith({
      where: { invoiceId: 'inv-1' },
    });
    expect(tx.payment.deleteMany).toHaveBeenCalledWith({ where: { invoiceId: 'inv-1' } });
    expect(tx.paymentCollectionIdempotency.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.payment.deleteMany.mock.invocationCallOrder[0],
    );
    expect(tx.invoice.delete).toHaveBeenCalledWith({ where: { id: 'inv-1' } });
    expect(tx.booking.delete).toHaveBeenCalled();
  });

  it.each([
    PaymentStatus.COMPLETED,
    PaymentStatus.REFUNDED,
    PaymentStatus.PENDING_VERIFICATION,
  ])('rejects deletion when a %s payment exists', async (status) => {
    const { prisma, tx } = buildPrisma({
      payment: { findFirst: jest.fn().mockResolvedValue({ id: 'pay-1', status }) },
    });

    await expect(
      new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
        bookingId: 'book-1',
        changedBy: 'admin-1',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.booking.delete).not.toHaveBeenCalled();
  });

  it.each(['preflight', 'transaction'])('retains partially refunded history at the %s guard', async (stage) => {
    const { prisma, tx } = buildPrisma();
    const matchPartialRefund = async ({ where }: any) =>
      where.status.in.includes(PaymentStatus.PARTIALLY_REFUNDED) ? { id: 'partial-payment' } : null;
    tx.invoice.findUnique.mockResolvedValue({ id: 'inv-1' });
    if (stage === 'preflight') prisma.payment.findFirst.mockImplementation(matchPartialRefund);
    else tx.payment.findFirst.mockImplementation(matchPartialRefund);

    await expect(new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
      bookingId: 'book-1', changedBy: 'admin-1',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.refundRequest.deleteMany).not.toHaveBeenCalled();
    expect(tx.payment.deleteMany).not.toHaveBeenCalled();
    expect(tx.invoice.delete).not.toHaveBeenCalled();
    expect(tx.booking.delete).not.toHaveBeenCalled();
  });

  it('rejects deletion of a non-terminal (active) booking', async () => {
    const { prisma, tx } = buildPrisma({
      booking: {
        findFirst: jest.fn().mockResolvedValue({ id: 'book-1', status: BookingStatus.CONFIRMED }),
      },
    });

    await expect(
      new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
        bookingId: 'book-1',
        changedBy: 'admin-1',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.payment.findFirst).not.toHaveBeenCalled();
    expect(tx.booking.delete).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the booking does not exist', async () => {
    const { prisma, tx } = buildPrisma({
      booking: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
        bookingId: 'missing',
        changedBy: 'admin-1',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
