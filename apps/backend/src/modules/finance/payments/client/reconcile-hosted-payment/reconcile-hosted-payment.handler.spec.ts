import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { buildBooking, buildPayment, createPrismaMock } from '../../../../../../test/factories';
import {
  HOSTED_RECONCILE_MIN_AGE_MS,
  ReconcileHostedPaymentHandler,
} from './reconcile-hosted-payment.handler';

const NOW = new Date('2026-11-24T10:00:00.000Z');
const OLD = new Date(NOW.getTime() - HOSTED_RECONCILE_MIN_AGE_MS - 1_000);
const YOUNG = new Date(NOW.getTime() - HOSTED_RECONCILE_MIN_AGE_MS + 1_000);

const BOOKING_ID = 'booking-1';
const PAYMENT_ID = 'pay-row-1';
const INVOICE_ID = 'invoice-1';
const HOSTED_ID = 'hosted-inv-1';
const MOYASAR_PAYMENT_ID = 'moy-pay-1';

describe('ReconcileHostedPaymentHandler', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const setup = (
    over: {
      bookingStatus?: string;
      paymentStatus?: string;
      updatedAt?: Date;
      gatewayRef?: string | null;
      invoiceStatus?: string;
      hasPayment?: boolean;
    } = {},
  ) => {
    const state = { bookingStatus: over.bookingStatus ?? 'AWAITING_PAYMENT', paymentStatus: over.paymentStatus ?? 'PENDING' };
    const row = {
      ...buildPayment({ id: PAYMENT_ID, status: state.paymentStatus as never }),
      invoiceId: INVOICE_ID,
      gatewayRef: over.gatewayRef === undefined ? HOSTED_ID : over.gatewayRef,
      updatedAt: over.updatedAt ?? OLD,
      invoice: { status: over.invoiceStatus ?? 'ISSUED' },
    };
    const prisma = createPrismaMock({
      booking: {
        findFirst: buildBooking({ id: BOOKING_ID, status: state.bookingStatus as never }),
        findUnique: jest.fn(async () => ({ status: state.bookingStatus })),
      },
      payment: {
        // the picker filters by method; the state read does not
        findFirst: jest.fn(async (args: { where: { method?: string } }) =>
          args.where.method
            ? (over.hasPayment === false ? null : row)
            : (over.hasPayment === false ? null : { status: state.paymentStatus })),
      },
    });
    const moyasar = {
      getCheckoutInvoice: jest.fn().mockResolvedValue({
        id: HOSTED_ID,
        status: 'paid',
        payments: [{ id: MOYASAR_PAYMENT_ID, status: 'paid' }],
      }),
      getPaymentStatus: jest.fn().mockResolvedValue({
        id: MOYASAR_PAYMENT_ID,
        status: 'paid',
        amount: 23000,
        refunded: 0,
        currency: 'SAR',
        invoiceId: HOSTED_ID,
      }),
    };
    const settlement = {
      execute: jest.fn(async () => {
        state.paymentStatus = 'COMPLETED';
        return { requiresReview: false };
      }),
    };
    const handler = new ReconcileHostedPaymentHandler(prisma as never, moyasar as never, settlement as never);
    return { handler, prisma, moyasar, settlement, state };
  };

  const run = (h: ReconcileHostedPaymentHandler) => h.execute({ clientId: 'client-1', bookingId: BOOKING_ID });

  it('settles a stale PENDING hosted payment that the provider reports paid', async () => {
    const { handler, moyasar, settlement } = setup();
    const res = await run(handler);

    expect(moyasar.getCheckoutInvoice).toHaveBeenCalledWith(expect.any(String), HOSTED_ID);
    expect(moyasar.getPaymentStatus).toHaveBeenCalledWith(expect.any(String), MOYASAR_PAYMENT_ID);
    expect(settlement.execute).toHaveBeenCalledTimes(1);
    const cmd = (settlement.execute.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(cmd).toMatchObject({
      invoiceId: INVOICE_ID,
      gatewayPaymentId: MOYASAR_PAYMENT_ID,
      gatewayRefs: [HOSTED_ID, MOYASAR_PAYMENT_ID],
    });
    expect(cmd).not.toHaveProperty('requiredPaymentId');
    expect(res).toMatchObject({ bookingId: BOOKING_ID, paymentStatus: 'COMPLETED', reconciled: true, checkedAt: NOW.toISOString() });
  });

  it('makes no provider call when the payment is younger than the minimum age', async () => {
    const { handler, moyasar, settlement } = setup({ updatedAt: YOUNG });
    const res = await run(handler);
    expect(moyasar.getCheckoutInvoice).not.toHaveBeenCalled();
    expect(settlement.execute).not.toHaveBeenCalled();
    expect(res).toMatchObject({ paymentStatus: 'PENDING', reconciled: false });
  });

  it('makes no provider call at exactly the minimum age (strictly older required)', async () => {
    const { handler, moyasar } = setup({ updatedAt: new Date(NOW.getTime() - HOSTED_RECONCILE_MIN_AGE_MS) });
    await run(handler);
    expect(moyasar.getCheckoutInvoice).not.toHaveBeenCalled();
  });

  it.each([
    ['payment already COMPLETED', { paymentStatus: 'COMPLETED' }],
    ['payment already FAILED', { paymentStatus: 'FAILED' }],
    ['booking CANCELLED', { bookingStatus: 'CANCELLED' }],
    ['booking EXPIRED', { bookingStatus: 'EXPIRED' }],
    ['invoice PAID', { invoiceStatus: 'PAID' }],
    ['invoice VOID', { invoiceStatus: 'VOID' }],
    ['no hosted invoice stored yet', { gatewayRef: null }],
    ['native reservation (gatewayRef is the row id)', { gatewayRef: PAYMENT_ID }],
    ['booking has no card payment', { hasPayment: false }],
  ])('makes no provider call when %s', async (_name, over) => {
    const { handler, moyasar, settlement } = setup(over);
    const res = await run(handler);
    expect(moyasar.getCheckoutInvoice).not.toHaveBeenCalled();
    expect(moyasar.getPaymentStatus).not.toHaveBeenCalled();
    expect(settlement.execute).not.toHaveBeenCalled();
    expect(res.reconciled).toBe(false);
  });

  it('returns the current state without throwing when the provider fails', async () => {
    const { handler, moyasar, settlement } = setup();
    moyasar.getCheckoutInvoice.mockRejectedValue(new ServiceUnavailableException('boom'));
    const res = await run(handler);
    expect(settlement.execute).not.toHaveBeenCalled();
    expect(res).toMatchObject({ paymentStatus: 'PENDING', reconciled: false });
  });

  it('swallows a provider NotFound on the payment lookup', async () => {
    const { handler, moyasar } = setup();
    moyasar.getPaymentStatus.mockRejectedValue(new NotFoundException());
    await expect(run(handler)).resolves.toMatchObject({ reconciled: false });
  });

  it('swallows a settlement error and reports the unchanged state', async () => {
    const { handler, settlement } = setup();
    settlement.execute.mockRejectedValue(new Error('deadlock'));
    await expect(run(handler)).resolves.toMatchObject({ paymentStatus: 'PENDING', reconciled: false });
  });

  it.each([['unknown booking', null], ['another clients booking', null]])(
    'throws NotFound for %s without touching the provider',
    async () => {
      const { handler, prisma, moyasar } = setup();
      prisma.booking.findFirst.mockResolvedValue(null);
      await expect(run(handler)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: BOOKING_ID, clientId: 'client-1' } }),
      );
      expect(moyasar.getCheckoutInvoice).not.toHaveBeenCalled();
    },
  );

  it.each(['invalid_transition', 'already_refunded'])(
    'treats a settlement skipped as %s (webhook won the race) as success with reconciled=false',
    async (reason) => {
      const { handler, settlement, state } = setup();
      settlement.execute.mockImplementation(async () => {
        state.paymentStatus = 'COMPLETED'; // the webhook settled it first
        return { skipped: true, reason, requiresReview: false };
      });
      const res = await run(handler);
      expect(res).toMatchObject({ paymentStatus: 'COMPLETED', reconciled: false });
    },
  );

  it('leaves the payment alone when the provider shows no terminal attempt', async () => {
    const { handler, moyasar, settlement } = setup();
    moyasar.getCheckoutInvoice.mockResolvedValue({ id: HOSTED_ID, status: 'initiated', payments: [{ id: 'a', status: 'initiated' }] });
    const res = await run(handler);
    expect(moyasar.getPaymentStatus).not.toHaveBeenCalled();
    expect(settlement.execute).not.toHaveBeenCalled();
    expect(res.reconciled).toBe(false);
  });

  it('does not mark FAILED after one failed attempt while the hosted invoice is still open (client may retry)', async () => {
    const { handler, moyasar, settlement } = setup();
    moyasar.getCheckoutInvoice.mockResolvedValue({ id: HOSTED_ID, status: 'initiated', payments: [{ id: 'a', status: 'failed' }] });
    await run(handler);
    expect(settlement.execute).not.toHaveBeenCalled();
  });

  it('reflects FAILED through the settlement failure path once the hosted invoice is dead', async () => {
    const { handler, moyasar, settlement } = setup();
    moyasar.getCheckoutInvoice.mockResolvedValue({ id: HOSTED_ID, status: 'expired', payments: [{ id: 'a', status: 'failed' }] });
    moyasar.getPaymentStatus.mockResolvedValue({
      id: 'a', status: 'failed', amount: 23000, refunded: 0, currency: 'SAR', invoiceId: HOSTED_ID,
    });
    await run(handler);
    expect(settlement.execute).toHaveBeenCalledWith(
      expect.objectContaining({ gatewayPaymentId: 'a', gatewayRefs: [HOSTED_ID, 'a'], message: expect.any(String) }),
    );
  });

  it('refuses to settle a payment that belongs to a different hosted invoice', async () => {
    const { handler, moyasar, settlement } = setup();
    moyasar.getPaymentStatus.mockResolvedValue({
      id: MOYASAR_PAYMENT_ID, status: 'paid', amount: 23000, refunded: 0, currency: 'SAR', invoiceId: 'someone-elses',
    });
    const res = await run(handler);
    expect(settlement.execute).not.toHaveBeenCalled();
    expect(res.reconciled).toBe(false);
  });

  it('prefers a paid attempt over a later failed one', async () => {
    const { handler, moyasar, settlement } = setup();
    moyasar.getCheckoutInvoice.mockResolvedValue({
      id: HOSTED_ID,
      status: 'paid',
      payments: [{ id: 'f', status: 'failed' }, { id: MOYASAR_PAYMENT_ID, status: 'paid' }, { id: 'g', status: 'failed' }],
    });
    await run(handler);
    expect(moyasar.getPaymentStatus).toHaveBeenCalledWith(expect.any(String), MOYASAR_PAYMENT_ID);
    expect(settlement.execute).toHaveBeenCalledWith(expect.objectContaining({ message: undefined }));
  });
});
