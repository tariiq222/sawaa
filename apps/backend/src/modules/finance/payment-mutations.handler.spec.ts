import { NotFoundException, BadRequestException } from "@nestjs/common";
import {
  BookingStatus,
  InvoiceStatus,
  PaymentStatus,
  RefundStatus,
} from "@prisma/client";
import { RefundPaymentHandler } from "./refund-payment/refund-payment.handler";
import { VerifyPaymentHandler } from "./verify-payment/verify-payment.handler";
import { DEFAULT_ORG_ID } from "../../common/constants";

const buildPaymentRow = (
  overrides: Partial<{
    id: string;
    status: string;
    gatewayRef: string | null;
    amount: unknown;
    invoiceId: string;
  }> = {},
) => ({
  id: "pay-1",
  status: "COMPLETED",
  gatewayRef: "pay_test_gw_123",
  amount: 100,
  invoiceId: "inv-1",
  ...overrides,
});

const buildPrisma = () => {
  const prisma: {
    payment: {
      findFirst: jest.Mock;
      findFirstOrThrow: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      aggregate: jest.Mock;
    };
    invoice: {
      findFirst: jest.Mock;
      update: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    refundRequest: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    booking: {
      findFirst: jest.Mock;
    };
    service: {
      findFirst: jest.Mock;
    };
    outboxEvent: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
  } = {
    payment: {
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      aggregate: jest.fn(),
    },
    invoice: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({
          id: "inv-1",
          bookingId: "book-1",
          clientId: "client-1",
          currency: "SAR",
          organizationId: "org-1",
          total: "100",
          vatAmt: "15",
          refundedAmount: "0",
        }),
    },
    refundRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: "rr-1" }),
      update: jest.fn().mockResolvedValue({ id: "rr-1" }),
      updateMany: jest.fn(),
    },
    // resolveInvoiceDeposit (VerifyPaymentHandler) loads booking → service via
    // scalar bookingId. Default to a service with NO deposit.
    booking: {
      findFirst: jest.fn().mockResolvedValue({
        serviceId: "svc-1",
        status: BookingStatus.CONFIRMED,
      }),
    },
    service: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ depositEnabled: false, depositAmount: null }),
    },
    outboxEvent: {
      create: jest.fn().mockResolvedValue({ id: "event-1" }),
    },
    $transaction: jest.fn(async (fn) => fn(prisma)),
    $queryRaw: jest.fn().mockResolvedValue([buildPaymentRow()]),
  };
  return prisma;
};

const buildRlsTx = (prisma: ReturnType<typeof buildPrisma>) => ({
  withTransaction: jest.fn((fn: any) => fn(prisma)),
  withBypassTransaction: jest.fn((fn: any) => fn(prisma)),
});

const buildMoyasar = () => ({
  getPaymentStatus: jest.fn().mockResolvedValue({
    id: "pay_test_gw_123",
    status: "paid",
    amount: 100,
    currency: "SAR",
    refunded: 0,
  }),
  createRefund: jest.fn().mockResolvedValue({
    id: "pay_test_gw_123",
    currency: "SAR",
    refunded: 100,
  }),
});
const unusedEventBus = {};

const PAY_ID = "pay-1";

const prepareVerifyState = (
  prisma: ReturnType<typeof buildPrisma>,
  payment: ReturnType<typeof buildPaymentRow> & { processedAt?: Date },
  invoice: {
    id: string;
    total: number;
    currency: string;
    bookingId: string | null;
    packagePurchaseId: string | null;
    status: InvoiceStatus;
    issuedAt: Date | null;
  },
  completedBefore = 0,
) => {
  let currentPayment = payment;
  prisma.payment.findFirst.mockImplementation(() =>
    Promise.resolve(currentPayment),
  );
  prisma.payment.findFirstOrThrow.mockImplementation(() =>
    Promise.resolve(currentPayment),
  );
  prisma.payment.updateMany.mockImplementation(({ where, data }) => {
    if (currentPayment.status !== where.status)
      return Promise.resolve({ count: 0 });
    currentPayment = { ...currentPayment, ...data };
    return Promise.resolve({ count: 1 });
  });
  prisma.payment.aggregate.mockResolvedValue({
    _sum: { amount: completedBefore },
  });
  prisma.invoice.findFirst.mockResolvedValue(invoice);
  return () => currentPayment;
};

describe("RefundPaymentHandler", () => {
  const _PAYMENT_BASE = {
    id: PAY_ID,
    amount: 100,
    gatewayRef: "pay_test_gw_123",
    invoice: {
      id: "inv-1",
      bookingId: "book-1",
      clientId: "client-1",
      currency: "SAR",
      organizationId: "org-1",
    },
  };

  it("refunds a completed payment, finalizes its RefundRequest, and stages RefundCompletedEvent in the outbox", async () => {
    const prisma = buildPrisma();
    const moyasar = buildMoyasar();
    const refunded = {
      id: PAY_ID,
      status: PaymentStatus.REFUNDED,
      failureReason: "client request",
    };
    const refundRequest = {
      id: "rr-1",
      paymentId: PAY_ID,
      amount: 100,
      invoiceId: "inv-1",
      status: RefundStatus.PROCESSING,
      gatewayRef: null,
      idempotencyKey: "refund:rr-1",
      sourceEventId: null,
      providerState: "BEFORE_CALL",
      providerLeaseOwner: null,
      providerLeaseExpiresAt: null,
      baselineRefundedAmount: null,
      targetCumulativeRefundedAmount: null,
      observedCumulativeRefundedAmount: null,
    };
    prisma.refundRequest.create.mockImplementation(({ data }) => {
      refundRequest.id = data.id;
      refundRequest.idempotencyKey = data.idempotencyKey;
      return Promise.resolve({ id: data.id });
    });
    prisma.refundRequest.findUniqueOrThrow.mockResolvedValue(refundRequest);
    prisma.refundRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.payment.findUniqueOrThrow
      .mockResolvedValueOnce({
        id: PAY_ID,
        gatewayRef: "pay_test_gw_123",
        amount: 100,
        refundedAmount: 0,
        currency: "SAR",
      })
      .mockResolvedValueOnce(refunded);
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    prisma.payment.update.mockResolvedValue(refunded);
    prisma.invoice.findUniqueOrThrow.mockResolvedValue({
      id: "inv-1",
      bookingId: "book-1",
      clientId: "client-1",
      currency: "SAR",
      organizationId: "org-1",
      total: 100,
      vatAmt: 15,
      refundedAmount: 0,
    });
    prisma.invoice.update.mockResolvedValue({
      id: "inv-1",
      status: InvoiceStatus.REFUNDED,
    });

    const handler = new RefundPaymentHandler(
      prisma as never,
      buildRlsTx(prisma) as never,
      unusedEventBus as never,
      moyasar as never,
    );
    const result = await handler.execute({
      paymentId: PAY_ID,
      reason: "client request",
    });

    expect(result.status).toBe(PaymentStatus.REFUNDED);
    expect(prisma.refundRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentId: PAY_ID,
          status: "PROCESSING",
        }),
      }),
    );
    expect(prisma.refundRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: RefundStatus.COMPLETED }),
      }),
    );
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PAY_ID },
        data: expect.objectContaining({
          status: PaymentStatus.REFUNDED,
          failureReason: expect.stringMatching(
            /^Booking cancellation refund \(refund:/,
          ),
          refundedAmount: { increment: 100 },
        }),
      }),
    );
    expect(prisma.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aggregateId: expect.any(String),
          eventType: "finance.refund.completed",
          payload: expect.objectContaining({
            payload: expect.objectContaining({
              paymentId: PAY_ID,
              bookingId: "book-1",
              organizationId: DEFAULT_ORG_ID,
            }),
          }),
        }),
      }),
    );
  });

  it("throws NotFoundException when payment not found", async () => {
    const prisma = buildPrisma();
    prisma.$queryRaw.mockResolvedValueOnce([]);

    await expect(
      new RefundPaymentHandler(
        prisma as never,
        buildRlsTx(prisma) as never,
        unusedEventBus as never,
        buildMoyasar() as never,
      ).execute({ paymentId: "bad", reason: "x" }),
    ).rejects.toThrow(NotFoundException);
  });

  it("throws BadRequestException when payment is not COMPLETED", async () => {
    const prisma = buildPrisma();
    prisma.$queryRaw.mockResolvedValueOnce([
      { ...buildPaymentRow(), status: PaymentStatus.PENDING },
    ]);

    await expect(
      new RefundPaymentHandler(
        prisma as never,
        buildRlsTx(prisma) as never,
        unusedEventBus as never,
        buildMoyasar() as never,
      ).execute({ paymentId: PAY_ID, reason: "x" }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe("VerifyPaymentHandler", () => {
  const INVOICE_ID = "inv-1";
  const invoice = {
    id: INVOICE_ID,
    total: 230,
    currency: "SAR",
    bookingId: "book-1",
    packagePurchaseId: null,
    status: InvoiceStatus.DRAFT,
    issuedAt: null,
  };

  it("locks the invoice, approves with CAS, marks it PAID, and stages PaymentCompletedEvent", async () => {
    const prisma = buildPrisma();
    const pendingPayment = {
      ...buildPaymentRow({ amount: 230, invoiceId: INVOICE_ID }),
      amount: 230,
      status: PaymentStatus.PENDING_VERIFICATION,
      gatewayRef: null,
    };
    prepareVerifyState(prisma, pendingPayment, invoice, 0);
    prisma.invoice.update.mockResolvedValue({
      id: INVOICE_ID,
      status: InvoiceStatus.PAID,
    });

    const handler = new VerifyPaymentHandler(
      prisma as never,
      buildRlsTx(prisma) as never,
    );
    const result = await handler.execute({
      paymentId: PAY_ID,
      action: "approve",
      transferRef: "REF-123",
    });

    expect(result.status).toBe(PaymentStatus.COMPLETED);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.payment.aggregate).toHaveBeenCalledWith({
      where: { invoiceId: INVOICE_ID, status: PaymentStatus.COMPLETED },
      _sum: { amount: true },
    });
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PAY_ID, status: PaymentStatus.PENDING_VERIFICATION },
        data: expect.objectContaining({
          status: PaymentStatus.COMPLETED,
          gatewayRef: "REF-123",
        }),
      }),
    );
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: INVOICE_ID },
        data: expect.objectContaining({ status: InvoiceStatus.PAID }),
      }),
    );
    expect(prisma.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "finance.payment.completed",
          status: "PENDING_V2",
          deliveryLane: "PENDING_V2",
          payload: expect.objectContaining({
            payload: expect.objectContaining({ invoiceId: INVOICE_ID }),
          }),
        }),
      }),
    );
  });

  it("aggregates completed payments before the candidate and marks a partial result PARTIALLY_PAID", async () => {
    const prisma = buildPrisma();
    const pendingPayment = {
      ...buildPaymentRow({ amount: 100, invoiceId: INVOICE_ID }),
      amount: 100,
      status: PaymentStatus.PENDING_VERIFICATION,
      gatewayRef: null,
    };
    prepareVerifyState(prisma, pendingPayment, invoice, 20);

    const handler = new VerifyPaymentHandler(
      prisma as never,
      buildRlsTx(prisma) as never,
    );
    await handler.execute({ paymentId: PAY_ID, action: "approve" });

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: InvoiceStatus.PARTIALLY_PAID }),
      }),
    );
    expect(prisma.payment.aggregate).toHaveBeenCalledWith({
      where: { invoiceId: INVOICE_ID, status: PaymentStatus.COMPLETED },
      _sum: { amount: true },
    });
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
  });

  it("rejects with a compare-and-set transition and stages no event", async () => {
    const prisma = buildPrisma();
    const pendingPayment = {
      ...buildPaymentRow(),
      status: PaymentStatus.PENDING_VERIFICATION,
      gatewayRef: null,
    };
    prepareVerifyState(prisma, pendingPayment, invoice);

    const handler = new VerifyPaymentHandler(
      prisma as never,
      buildRlsTx(prisma) as never,
    );
    const result = await handler.execute({
      paymentId: PAY_ID,
      action: "reject",
    });

    expect(result.status).toBe(PaymentStatus.FAILED);
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: PAY_ID, status: PaymentStatus.PENDING_VERIFICATION },
      data: {
        status: PaymentStatus.FAILED,
        failureReason: "Bank transfer rejected",
      },
    });
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when payment not found", async () => {
    const prisma = buildPrisma();
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(
      new VerifyPaymentHandler(
        prisma as never,
        buildRlsTx(prisma) as never,
      ).execute({
        paymentId: "bad",
        action: "approve",
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("treats repeated approval of an already completed payment as an idempotent replay", async () => {
    const prisma = buildPrisma();
    const completedPayment = {
      ...buildPaymentRow(),
      status: PaymentStatus.COMPLETED,
      gatewayRef: null,
    };
    prepareVerifyState(prisma, completedPayment, invoice);

    await expect(
      new VerifyPaymentHandler(
        prisma as never,
        buildRlsTx(prisma) as never,
      ).execute({
        paymentId: PAY_ID,
        action: "approve",
      }),
    ).resolves.toMatchObject({ id: PAY_ID, status: PaymentStatus.COMPLETED });
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
  });
});
