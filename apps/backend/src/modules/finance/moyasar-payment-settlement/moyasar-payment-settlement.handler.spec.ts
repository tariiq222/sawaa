import { ReconcileNativePaymentHandler } from '../native-payments/reconcile-native-payment/reconcile-native-payment.handler';
import { MoyasarPaymentSettlementHandler } from './moyasar-payment-settlement.handler';

describe('provider-authoritative settlement', () => {
  function setup() {
    const invoice: any = {
      id: 'invoice',
      clientId: 'client',
      bookingId: 'booking',
      packagePurchaseId: null,
      total: 230,
      currency: 'SAR',
      status: 'ISSUED',
      issuedAt: null,
    };
    const payment: any = {
      id: 'payment',
      invoiceId: 'invoice',
      gatewayRef: 'payment',
      status: 'PENDING',
      amount: 230,
      currency: 'SAR',
    };
    const booking: any = { status: 'PENDING' };
    let review: any = null;
    const prisma: any = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue(invoice),
        update: jest.fn(),
      },
      payment: {
        findFirst: jest.fn().mockImplementation(() => Promise.resolve(payment)),
        update: jest.fn().mockImplementation(({ data }: any) => {
          Object.assign(payment, data);
          return payment;
        }),
        create: jest.fn(),
        aggregate: jest.fn().mockImplementation(() =>
          Promise.resolve({
            _sum: { amount: payment.status === 'COMPLETED' ? 230 : 0 },
          }),
        ),
      },
      booking: {
        findUnique: jest.fn().mockResolvedValue(booking),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      outboxEvent: { create: jest.fn() },
      refundRequest: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(review)),
        create: jest.fn().mockImplementation(({ data }: any) => {
          review = data;
          return review;
        }),
      },
      $queryRaw: jest.fn(),
    };
    const handler = new MoyasarPaymentSettlementHandler(prisma, {
      withTransaction: (fn: any) => fn(prisma),
    } as any);
    const command: any = {
      invoiceId: 'invoice',
      gatewayPaymentId: 'payment',
      gatewayRefs: ['payment'],
      requiredPaymentId: 'payment',
      fetched: {
        id: 'payment',
        status: 'paid',
        amount: 230,
        currency: 'SAR',
        refunded: 0,
      },
    };
    return { handler, prisma, invoice, payment, booking, command };
  }
  it.each(['paid', 'captured', 'failed', 'voided'])(
    'applies %s exactly once across independent calls',
    async (status) => {
      const { handler, prisma, command } = setup();
      command.fetched.status = status;
      await handler.execute(command);
      await handler.execute(command);
      expect(prisma.payment.update).toHaveBeenCalledTimes(1);
      expect(prisma.outboxEvent.create).toHaveBeenCalledTimes(1);
    },
  );
  it.each(['initiated', 'authorized', 'refunded'])(
    'does not infer a completed payment from %s',
    async (status) => {
      const { handler, prisma, command } = setup();
      command.fetched.status = status;
      await handler.execute(command);
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
    },
  );
  it.each(['CANCELLED', 'EXPIRED', 'NO_SHOW'])(
    'records late money once and requests manual review for %s',
    async (status) => {
      const { handler, prisma, command, booking } = setup();
      booking.status = status;
      expect((await handler.execute(command)).requiresReview).toBe(true);
      await handler.execute(command);
      expect(prisma.payment.update).toHaveBeenCalledTimes(1);
      expect(prisma.refundRequest.create).toHaveBeenCalledTimes(1);
      expect(prisma.refundRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING_REVIEW',
            amount: 230,
          }),
        }),
      );
      expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
    },
  );
  it('preserves a closed invoice for review', async () => {
    const { handler, prisma, command, invoice } = setup();
    invoice.status = 'VOID';
    expect(await handler.execute(command)).toMatchObject({
      requiresReview: true,
      reason: 'terminal_invoice',
    });
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });
  it.each([
    { id: 'other' },
    { amount: 231 },
    { currency: 'USD' },
    { metadata: { invoiceId: 'other' } },
  ])('rejects incompatible provider values %p', async (patch) => {
    const { handler, prisma, command } = setup();
    Object.assign(command.fetched, patch);
    expect((await handler.execute(command)).skipped).toBe(true);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });
  it.each([200, 260])(
    'rejects invoice total changed to %p after reservation',
    async (total) => {
      const { handler, prisma, command, invoice } = setup();
      invoice.total = total;
      expect(await handler.execute(command)).toMatchObject({
        reason: 'amount_mismatch',
      });
      expect(prisma.payment.update).not.toHaveBeenCalled();
    },
  );
  it('applies the same frozen native amount check when called by webhook', async () => {
    const { handler, prisma, command, invoice } = setup();
    delete command.requiredPaymentId;
    invoice.total = 260;
    expect(await handler.execute(command)).toMatchObject({
      reason: 'amount_mismatch',
    });
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });
  it('does not overwrite refunded accounting on a replay', async () => {
    const { handler, prisma, command, payment } = setup();
    payment.status = 'REFUNDED';
    await handler.execute(command);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });
  it.each(['PENDING', 'AWAITING_PAYMENT', 'PENDING_GROUP_FILL'])(
    'preserves paid money for an elapsed unconfirmed hold in %s for either entry path',
    async (status) => {
      for (const [entry, programId] of [['native', null], ['webhook', null], ['native', 'program'], ['webhook', 'program']]) {
        const { handler, prisma, command, booking } = setup();
        Object.assign(booking, {
          status,
          programId,
          expiresAt: new Date(0),
        });
        if (entry === 'webhook') delete command.requiredPaymentId;
        expect((await handler.execute(command)).requiresReview).toBe(true);
        expect(prisma.payment.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ status: 'COMPLETED' }),
          }),
        );
        expect(prisma.refundRequest.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ status: 'PENDING_REVIEW' }),
          }),
        );
        await handler.execute(command);
        expect(prisma.payment.update).toHaveBeenCalledTimes(1);
        expect(prisma.refundRequest.create).toHaveBeenCalledTimes(1);
        expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
      }
    },
  );
  it.each(['CONFIRMED', 'DEPOSIT_PAID', 'COMPLETED'].flatMap(status => [null, 'program'].map(programId => ({ status, programId }))))(
    'settles remaining balance despite the original deadline: %p',
    async ({ status, programId }) => {
      const { handler, prisma, command, booking } = setup();
      Object.assign(booking, {
        status,
        programId,
        expiresAt: new Date(0),
      });
      expect((await handler.execute(command)).requiresReview).toBe(false);
      expect(prisma.refundRequest.create).not.toHaveBeenCalled();
      expect(prisma.outboxEvent.create).toHaveBeenCalledTimes(1);
    },
  );

  it('reports manual review through authenticated native reconciliation for elapsed program holds', async () => {
    const { handler, prisma, command, booking, payment } = setup();
    Object.assign(booking, {
      status: 'AWAITING_PAYMENT',
      programId: 'program',
      expiresAt: new Date(0),
    });
    prisma.payment.findUnique = jest
      .fn()
      .mockImplementation(async () => payment);
    prisma.refundRequest.findFirst = jest.fn().mockResolvedValue(null);
    const reconcile = new ReconcileNativePaymentHandler(
      prisma,
      { getPaymentStatus: async () => command.fetched } as never,
      handler,
    );
    expect(
      await reconcile.execute({ clientId: 'client', paymentId: 'payment' }),
    ).toMatchObject({ status: 'COMPLETED', requiresReview: true });
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
    expect(prisma.refundRequest.create).toHaveBeenCalledTimes(1);
  });
  it.each([null, 'program'])('settles a staff-managed historical import (programId=%s)', async (programId) => {
    const { handler, prisma, command, booking } = setup();
    Object.assign(booking, { status: 'PENDING', programId, expiresAt: new Date(0), isHistoricalImport: true });
    expect((await handler.execute(command)).requiresReview).toBe(false);
    expect(prisma.refundRequest.create).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

});
