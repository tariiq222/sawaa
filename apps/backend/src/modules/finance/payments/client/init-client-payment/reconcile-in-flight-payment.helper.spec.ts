import { ConflictException, Logger } from '@nestjs/common';
import {
  reconcileOrDiscardInFlightPayment,
  type InFlightPaymentRow,
} from './reconcile-in-flight-payment.helper';

const messages = {
  alreadyPaid: 'Payment for this invoice has already been completed',
  inFlight: 'هناك دفعة قيد التنفيذ لهذه الفاتورة، أكمل الدفع الحالي أو انتظر انتهاء الجلسة',
};

const buildPrisma = () => ({
  payment: {
    delete: jest.fn().mockResolvedValue({ id: 'payment-1' }),
  },
});

const buildMoyasar = (status: string) => ({
  getPaymentStatus: jest
    .fn()
    .mockResolvedValue({ id: 'moyasar-payment-existing', status, amount: 100, currency: 'SAR' }),
});

const buildMoyasarFailing = () => ({
  getPaymentStatus: jest.fn().mockRejectedValue(new Error('network down')),
});

const silentLogger = () => {
  const logger = new Logger('test');
  jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  return logger;
};

const rowWithRef: InFlightPaymentRow = { id: 'payment-1', gatewayRef: 'moyasar-payment-existing' };
const rowWithoutRef: InFlightPaymentRow = { id: 'payment-1', gatewayRef: null };

describe('reconcileOrDiscardInFlightPayment', () => {
  it('discards a row that has no gatewayRef yet (never created a gateway session)', async () => {
    const prisma = buildPrisma();
    const moyasar = buildMoyasar('initiated'); // should not be consulted

    await reconcileOrDiscardInFlightPayment(
      prisma as never,
      moyasar as never,
      silentLogger(),
      rowWithoutRef,
      messages,
    );

    expect(moyasar.getPaymentStatus).not.toHaveBeenCalled();
    expect(prisma.payment.delete).toHaveBeenCalledWith({ where: { id: 'payment-1' } });
  });

  it.each(['failed', 'voided', 'refunded'])(
    'discards a terminally-%s gateway session so a fresh payment can be created',
    async (status) => {
      const prisma = buildPrisma();
      const moyasar = buildMoyasar(status);

      await reconcileOrDiscardInFlightPayment(
        prisma as never,
        moyasar as never,
        silentLogger(),
        rowWithRef,
        messages,
      );

      expect(moyasar.getPaymentStatus).toHaveBeenCalledTimes(1);
      expect(prisma.payment.delete).toHaveBeenCalledWith({ where: { id: 'payment-1' } });
    },
  );

  it.each(['paid', 'captured', 'authorized'])(
    'rejects (no discard) when the gateway reports %s — prevents double charge',
    async (status) => {
      const prisma = buildPrisma();
      const moyasar = buildMoyasar(status);

      await expect(
        reconcileOrDiscardInFlightPayment(
          prisma as never,
          moyasar as never,
          silentLogger(),
          rowWithRef,
          messages,
        ),
      ).rejects.toMatchObject({ message: messages.alreadyPaid });

      expect(prisma.payment.delete).not.toHaveBeenCalled();
    },
  );

  it('rejects with the inFlight message when the gateway session is still initiated', async () => {
    const prisma = buildPrisma();
    const moyasar = buildMoyasar('initiated');

    await expect(
      reconcileOrDiscardInFlightPayment(
        prisma as never,
        moyasar as never,
        silentLogger(),
        rowWithRef,
        messages,
      ),
    ).rejects.toMatchObject({ message: messages.inFlight });

    expect(prisma.payment.delete).not.toHaveBeenCalled();
  });

  it('fails closed (ConflictException, no discard) when the gateway lookup throws', async () => {
    const prisma = buildPrisma();
    const moyasar = buildMoyasarFailing();

    await expect(
      reconcileOrDiscardInFlightPayment(
        prisma as never,
        moyasar as never,
        silentLogger(),
        rowWithRef,
        messages,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.payment.delete).not.toHaveBeenCalled();
  });

  it('honors caller-specific messages (package-purchase context)', async () => {
    const prisma = buildPrisma();
    const moyasar = buildMoyasar('paid');
    const pkgMessages = {
      alreadyPaid: 'This purchase has already been paid',
      inFlight: 'هناك دفعة قيد التنفيذ لهذه الباقة، أكمل الدفع الحالي أو انتظر انتهاء الجلسة',
    };

    await expect(
      reconcileOrDiscardInFlightPayment(
        prisma as never,
        moyasar as never,
        silentLogger(),
        rowWithRef,
        pkgMessages,
      ),
    ).rejects.toMatchObject({ message: pkgMessages.alreadyPaid });
  });
});
