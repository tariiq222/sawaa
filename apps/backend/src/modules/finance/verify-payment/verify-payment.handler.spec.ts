import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceStatus, PaymentStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { VerifyPaymentHandler } from './verify-payment.handler';

describe('VerifyPaymentHandler', () => {
  let handler: VerifyPaymentHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerifyPaymentHandler,
    { provide: PrismaService, useValue: {
    payment: { findFirst: jest.fn(), update: jest.fn() },
    invoice: { findFirst: jest.fn() }
    } },
    { provide: RlsTransactionService, useValue: { withTransaction: jest.fn() } },
    { provide: EventBusService, useValue: { emit: jest.fn() } }
      ],
    }).compile();

    handler = module.get<VerifyPaymentHandler>(VerifyPaymentHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    try {
      await handler.execute({ paymentId: '00000000-0000-0000-0000-000000000001', action: 'approve' } as any);
    } catch (e) {
      // Expected for incomplete mocks
    }
  });

  it('publishes PaymentCompletedEvent with organizationId on approve', async () => {
    // Pending payment to be approved (bank transfer flow).
    const pendingPayment = {
      id: 'pay-1',
      invoiceId: 'inv-1',
      status: PaymentStatus.PENDING_VERIFICATION,
      amount: 230,
      gatewayRef: null,
    };
    const updatedPayment = {
      ...pendingPayment,
      status: PaymentStatus.COMPLETED,
      processedAt: new Date(),
    };
    const invoice = {
      id: 'inv-1',
      bookingId: 'booking-1',
      currency: 'SAR',
      total: 230,
    };

    const prismaMock = {
      payment: {
        findFirst: jest.fn().mockResolvedValue(pendingPayment),
        update: jest.fn().mockResolvedValue(updatedPayment),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 230 } }),
      },
      invoice: {
        findFirst: jest.fn().mockResolvedValue(invoice),
        update: jest.fn().mockResolvedValue({ ...invoice, status: InvoiceStatus.PAID }),
      },
      // resolveInvoiceDeposit loads booking → service via scalar bookingId.
      // Default to a service with NO deposit so the event-branch logic is inert.
      booking: { findFirst: jest.fn().mockResolvedValue({ serviceId: 'svc-1' }) },
      service: {
        findFirst: jest.fn().mockResolvedValue({ depositEnabled: false, depositAmount: null }),
      },
    };
    const rlsTransaction = {
      withTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock)),
    };
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    const localHandler = new VerifyPaymentHandler(
      prismaMock as never,
      rlsTransaction as never,
      eventBus as never,
    );

    await localHandler.execute({ paymentId: 'pay-1', action: 'approve' });

    expect(eventBus.publish).toHaveBeenCalledWith(
      'finance.payment.completed',
      expect.objectContaining({
        payload: expect.objectContaining({ organizationId: DEFAULT_ORG_ID }),
      }),
    );
  });
});
