import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InitGuestPaymentHandler } from './init-guest-payment.handler';

const mockBooking = {
  id: 'booking-1',
  status: 'AWAITING_PAYMENT',
  price: 100,
  currency: 'SAR',
  clientId: 'client-1',
};

const mockClient = {
  phone: '+966500000000',
  email: 'guest@example.com',
};

const validOtp = { otpIdentifier: '+966500000000', otpJti: 'jti-1' };

const mockInvoice = {
  id: 'inv-1',
  total: 115,
  currency: 'SAR',
};

const mockPayment = {
  id: 'pay-1',
  invoiceId: 'inv-1',
  amount: 115,
  currency: 'SAR',
  status: 'PENDING',
  idempotencyKey: 'guest:booking-1',
};

const mockMoyasarPayment = {
  id: 'moyasar-pay-1',
  amount: 11500,
  currency: 'SAR',
  status: 'initiated' as const,
  description: 'Booking payment - booking-1',
  metadata: { invoiceId: 'inv-1', bookingId: 'booking-1' },
  redirectUrl: 'https://checkout.moyasar.com/pay/pay_xxx',
  createdAt: '2026-04-17T12:00:00Z',
  updatedAt: '2026-04-17T12:00:00Z',
};

const buildMoyasar = () => ({
  createPayment: jest.fn().mockResolvedValue(mockMoyasarPayment),
  toPaymentStatus: jest.fn().mockReturnValue('PENDING'),
  toPaymentMethod: jest.fn().mockReturnValue('ONLINE_CARD'),
});

interface MockPrisma {
  booking: { findFirst: jest.Mock };
  client: { findFirst: jest.Mock };
  invoice: { findFirst: jest.Mock };
  payment: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  usedOtpSession: { create: jest.Mock };
}

interface MockPrismaWithTx extends MockPrisma {
  $transaction: jest.Mock;
}

function buildPrisma(): MockPrismaWithTx {
  const prisma: MockPrismaWithTx = {
    booking: { findFirst: jest.fn().mockResolvedValue({ ...mockBooking }) },
    client: { findFirst: jest.fn().mockResolvedValue({ ...mockClient }) },
    invoice: { findFirst: jest.fn().mockResolvedValue({ ...mockInvoice }) },
    payment: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ ...mockPayment }),
      update: jest.fn().mockResolvedValue({ ...mockPayment, gatewayRef: 'moyasar-pay-1' }),
      delete: jest.fn().mockResolvedValue({ ...mockPayment }),
    },
    usedOtpSession: { create: jest.fn().mockResolvedValue({ jti: 'jti-1' }) },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: MockPrismaWithTx) => Promise<unknown>) => fn(prisma));
  return prisma;
}

const OLD_ENV = process.env;

describe('InitGuestPaymentHandler', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV, PUBLIC_WEBSITE_URL: 'https://clinic.example.com' };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('execute', () => {
    it('creates a PENDING payment and returns redirect URL from Moyasar', async () => {
      const prisma = buildPrisma();
      const moyasar = buildMoyasar();
      const handler = new InitGuestPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(prisma)) } as never, moyasar as never);

      const result = await handler.execute({ bookingId: 'booking-1', ...validOtp });

      expect(prisma.booking.findFirst).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        select: { id: true, status: true, price: true, currency: true, clientId: true },
      });
      expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
        where: { bookingId: 'booking-1' },
        select: { id: true, total: true, currency: true },
      });
      expect(prisma.payment.findFirst).toHaveBeenCalledWith({
        where: { idempotencyKey: 'guest:booking-1' },
      });
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: {
          // org scoping moved to RLS / removed in single-tenant migration
          invoiceId: 'inv-1',
          amount: mockInvoice.total,
          currency: 'SAR',
          method: 'ONLINE_CARD',
          status: 'PENDING',
          idempotencyKey: 'guest:booking-1',
        },
        select: { id: true },
      });
      expect(moyasar.createPayment).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
        {
          amountHalalas: 115,
          currency: 'SAR',
          description: 'Booking payment - booking-1',
          callbackUrl: 'https://clinic.example.com/booking/confirm?bookingId=booking-1',
          metadata: { invoiceId: 'inv-1', bookingId: 'booking-1' },
          idempotencyKey: 'payment:00000000-0000-0000-0000-000000000001:inv-1',
        },
      );
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { gatewayRef: 'moyasar-pay-1' },
        select: { id: true },
      });
      expect(result).toEqual({
        paymentId: 'pay-1',
        redirectUrl: 'https://checkout.moyasar.com/pay/pay_xxx',
      });
    });

    it('throws NotFoundException when booking does not exist', async () => {
      const prisma = buildPrisma();
      prisma.booking.findFirst = jest.fn().mockResolvedValue(null);
      const moyasar = buildMoyasar();
      const handler = new InitGuestPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(prisma)) } as never, moyasar as never);

      await expect(handler.execute({ bookingId: 'nonexistent', ...validOtp })).rejects.toThrow(NotFoundException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when booking is not AWAITING_PAYMENT', async () => {
      const prisma = buildPrisma();
      prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: 'CONFIRMED' });
      const moyasar = buildMoyasar();
      const handler = new InitGuestPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(prisma)) } as never, moyasar as never);

      await expect(handler.execute({ bookingId: 'booking-1', ...validOtp })).rejects.toThrow(BadRequestException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when invoice does not exist', async () => {
      const prisma = buildPrisma();
      prisma.invoice.findFirst = jest.fn().mockResolvedValue(null);
      const moyasar = buildMoyasar();
      const handler = new InitGuestPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(prisma)) } as never, moyasar as never);

      await expect(handler.execute({ bookingId: 'booking-1', ...validOtp })).rejects.toThrow(NotFoundException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when existing payment is COMPLETED', async () => {
      const prisma = buildPrisma();
      prisma.payment.findFirst = jest.fn().mockResolvedValue({ ...mockPayment, status: 'COMPLETED' });
      const moyasar = buildMoyasar();
      const handler = new InitGuestPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(prisma)) } as never, moyasar as never);

      await expect(handler.execute({ bookingId: 'booking-1', ...validOtp })).rejects.toThrow(ConflictException);
      expect(moyasar.createPayment).not.toHaveBeenCalled();
    });

    it('deletes a stale pending payment and creates a fresh one with a valid redirectUrl on retry', async () => {
      const prisma = buildPrisma();
      prisma.payment.findFirst = jest.fn().mockResolvedValue({ ...mockPayment, gatewayRef: 'moyasar-pay-existing' });
      const moyasar = buildMoyasar();
      const handler = new InitGuestPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(prisma)) } as never, moyasar as never);

      const result = await handler.execute({ bookingId: 'booking-1', ...validOtp });

      expect(result).toEqual({ paymentId: 'pay-1', redirectUrl: 'https://checkout.moyasar.com/pay/pay_xxx' });
      expect(prisma.payment.delete).toHaveBeenCalledWith({ where: { id: 'pay-1' } });
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(moyasar.createPayment).toHaveBeenCalled();
    });

    it('deletes existing pending payment without gatewayRef and creates new one', async () => {
      const prisma = buildPrisma();
      prisma.payment.findFirst = jest.fn().mockResolvedValue({ ...mockPayment, gatewayRef: null });
      const moyasar = buildMoyasar();
      const handler = new InitGuestPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(prisma)) } as never, moyasar as never);

      const result = await handler.execute({ bookingId: 'booking-1', ...validOtp });

      expect(result).toEqual({ paymentId: 'pay-1', redirectUrl: 'https://checkout.moyasar.com/pay/pay_xxx' });
      expect(prisma.payment.delete).toHaveBeenCalledWith({ where: { id: 'pay-1' } });
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(moyasar.createPayment).toHaveBeenCalled();
    });

    it('returns existing pending payment without creating new one (idempotency)', async () => {
      const prisma = buildPrisma();
      prisma.payment.findFirst = jest.fn().mockResolvedValue({ ...mockPayment, gatewayRef: undefined });
      const moyasar = buildMoyasar();
      const handler = new InitGuestPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(prisma)) } as never, moyasar as never);

      const result = await handler.execute({ bookingId: 'booking-1', ...validOtp });

      expect(result).toEqual({ paymentId: 'pay-1', redirectUrl: 'https://checkout.moyasar.com/pay/pay_xxx' });
      expect(prisma.payment.delete).toHaveBeenCalledWith({ where: { id: 'pay-1' } });
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(moyasar.createPayment).toHaveBeenCalled();
    });

    it('sends invoice.total to Moyasar verbatim — total is already in halalas', async () => {
      const prisma = buildPrisma();
      prisma.invoice.findFirst = jest.fn().mockResolvedValue({ ...mockInvoice, total: 12000 });
      const moyasar = buildMoyasar();
      const handler = new InitGuestPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(prisma)) } as never, moyasar as never);

      await handler.execute({ bookingId: 'booking-1', ...validOtp });

      const params = moyasar.createPayment.mock.calls[0][1];
      expect(params.amountHalalas).toBe(12000);
      expect(params.amountHalalas).not.toBe(1200000);
    });

    it('throws BadRequestException when Moyasar returns an empty redirectUrl', async () => {
      const prisma = buildPrisma();
      const moyasar = buildMoyasar();
      moyasar.createPayment.mockResolvedValue({ ...mockMoyasarPayment, redirectUrl: null });
      const handler = new InitGuestPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(prisma)) } as never, moyasar as never);

      await expect(handler.execute({ bookingId: 'booking-1', ...validOtp })).rejects.toThrow(BadRequestException);

      expect(prisma.payment.delete).toHaveBeenCalledWith({ where: { id: 'pay-1' } });
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('uses default callback URL when PUBLIC_WEBSITE_URL is not set', async () => {
      process.env.PUBLIC_WEBSITE_URL = '';
      const prisma = buildPrisma();
      const moyasar = buildMoyasar();
      const handler = new InitGuestPaymentHandler(prisma as never, { withTransaction: jest.fn((fn: any) => fn(prisma)) } as never, moyasar as never);

      await handler.execute({ bookingId: 'booking-1', ...validOtp });

      expect(moyasar.createPayment).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
        expect.objectContaining({
          callbackUrl: 'http://localhost:3000/booking/confirm?bookingId=booking-1',
        }),
      );
    });
  });
});
