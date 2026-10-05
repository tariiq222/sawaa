import { BadRequestException, NotFoundException } from "@nestjs/common";
import { InitNativePaymentHandler } from "./init-native-payment.handler";
import { nativePaymentConfigFingerprint } from "../native-payment-config-fingerprint";

describe("native payment reservation", () => {
  const config = {
    enabled: true,
    isLive: false,
    publishableKey: "pk_test_valid",
    supportedNetworks: ["mada", "visa", "mastercard"],
    applePay: null,
  };
  const setup = () => {
    let saved: any = null;
    const invoice = {
      id: "invoice",
      clientId: "client",
      bookingId: "booking",
      currency: "SAR",
      total: 230,
      status: "ISSUED",
    };
    const prisma: any = {
      invoice: { findFirst: jest.fn().mockResolvedValue(invoice) },
      booking: {
        findFirst: jest.fn().mockResolvedValue({
          id: "booking",
          status: "PENDING",
          programId: null,
        }),
      },
      payment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        findFirst: jest.fn().mockImplementation(() => Promise.resolve(saved)),
        create: jest.fn().mockImplementation(({ data }: any) => {
          saved = data;
          return Promise.resolve(data);
        }),
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(saved)),
      },
      $queryRaw: jest.fn(),
    };
    const settings = {
      getPaymentConfiguration: jest.fn().mockResolvedValue(config),
    };
    const reconcile = {
      execute: jest
        .fn()
        .mockResolvedValue({ status: "PENDING", canCreatePayment: true }),
    };
    const gateway = {
      getCheckoutInvoice: jest.fn(),
      findCheckoutInvoiceByMetadata: jest.fn(),
    };
    const handler = new InitNativePaymentHandler(
      prisma,
      { withTransaction: (fn: any) => fn(prisma) } as any,
      settings as any,
      reconcile as any,
      gateway as any,
    );
    return {
      handler,
      prisma,
      settings,
      reconcile,
      invoice,
      setSaved: (value: any) => {
        saved = value;
      },
    };
  };
  it("reserves amount and provider UUID atomically without a hosted URL", async () => {
    const { handler, prisma } = setup();
    const result = await handler.execute({
      clientId: "client",
      invoiceId: "invoice",
    });
    expect(result.config.amount).toBe(230);
    expect(result.config.givenId).toBe(result.paymentId);
    expect(result).not.toHaveProperty("redirectUrl");
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: result.paymentId,
          gatewayRef: result.paymentId,
          amount: 230,
          status: "PENDING",
        }),
      }),
    );
  });
  it("resumes a package native attempt already reserved on the invoice", async () => {
    const { handler, setSaved, reconcile, prisma } = setup();
    setSaved({
      id: "old",
      gatewayRef: "old",
      invoiceId: "invoice",
      amount: 230,
      currency: "SAR",
      status: "PENDING",
      nativeConfigFingerprint: nativePaymentConfigFingerprint(config as any),
      idempotencyKey: "client-pkg:invoice",
    });
    expect(
      (await handler.execute({ clientId: "client", invoiceId: "invoice" }))
        .paymentId,
    ).toBe("old");
    expect(reconcile.execute).toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
  it("never presents a new card form for a provider-created pending attempt", async () => {
    const { handler, setSaved, reconcile, prisma } = setup();
    setSaved({
      id: "old",
      gatewayRef: "old",
      invoiceId: "invoice",
      amount: 230,
      currency: "SAR",
      status: "PENDING",
      nativeConfigFingerprint: nativePaymentConfigFingerprint(config as any),
    });
    reconcile.execute.mockResolvedValue({ status: "PENDING" });
    await expect(
      handler.execute({ clientId: "client", invoiceId: "invoice" }),
    ).rejects.toMatchObject({
      response: { code: "NATIVE_PAYMENT_IN_PROGRESS" },
    });
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
  it.each([
    { gatewayRef: "hosted", status: "PENDING" },
    { gatewayRef: null, status: "PENDING" },
    { gatewayRef: null, status: "PENDING_VERIFICATION" },
  ])("rejects a competing reservation %p", async (patch) => {
    const { handler, setSaved, prisma } = setup();
    setSaved({ id: "other", ...patch });
    await expect(
      handler.execute({ clientId: "client", invoiceId: "invoice" }),
    ).rejects.toThrow();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
  it("fails closed if config changed on the reserved attempt", async () => {
    const { handler, setSaved, reconcile } = setup();
    setSaved({
      id: "old",
      gatewayRef: "old",
      invoiceId: "invoice",
      amount: 230,
      currency: "SAR",
      status: "PENDING",
      nativeConfigFingerprint: "old-key",
    });
    await expect(
      handler.execute({ clientId: "client", invoiceId: "invoice" }),
    ).rejects.toThrow("configuration");
    expect(reconcile.execute).not.toHaveBeenCalled();
  });
  it.each([0, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects unsafe/nonpayable amount %p",
    async (total) => {
      const { handler, invoice } = setup();
      invoice.total = total;
      await expect(
        handler.execute({ clientId: "client", invoiceId: "invoice" }),
      ).rejects.toThrow();
    },
  );
  it("rejects unavailable Apple Pay", async () => {
    const { handler } = setup();
    await expect(
      handler.execute({
        clientId: "client",
        invoiceId: "invoice",
        method: "APPLE_PAY",
      }),
    ).rejects.toThrow();
  });
  it.each(["CONFIRMED", "COMPLETED"])(
    "accepts remaining balance on a %s booking",
    async (status) => {
      const { handler, prisma } = setup();
      prisma.booking.findFirst.mockResolvedValue({
        id: "booking",
        status,
        programId: null,
      });
      expect(
        (await handler.execute({ clientId: "client", invoiceId: "invoice" }))
          .config.amount,
      ).toBe(230);
    },
  );
  it("retains the failed attempt when creating a retry UUID", async () => {
    const { handler, prisma, reconcile, setSaved } = setup();
    const old = {
      id: "old",
      gatewayRef: "old",
      invoiceId: "invoice",
      amount: 230,
      currency: "SAR",
      status: "PENDING",
      nativeConfigFingerprint: nativePaymentConfigFingerprint(config as any),
      idempotencyKey: "native:invoice",
    };
    setSaved(old);
    reconcile.execute.mockImplementation(async () => {
      old.status = "FAILED";
      return { status: "FAILED" };
    });
    prisma.payment.update = jest.fn().mockImplementation(async () => {
      setSaved(null);
      return { ...old, idempotencyKey: null };
    });
    prisma.payment.delete = jest.fn();
    const result = await handler.execute({
      clientId: "client",
      invoiceId: "invoice",
    });
    expect(result.paymentId).not.toBe("old");
    expect(prisma.payment.delete).not.toHaveBeenCalled();
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "old" },
      data: { status: "FAILED", idempotencyKey: null },
    });
  });
  it("returns an already paid invoice native attempt identity only when bound", async () => {
    const { handler, invoice, setSaved } = setup();
    invoice.status = "PAID";
    setSaved({ id: "paid", gatewayRef: "paid", status: "COMPLETED" });
    await expect(
      handler.execute({ clientId: "client", invoiceId: "invoice" }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        paymentId: "paid",
        invoiceId: "invoice",
      }),
    });
  });
  it("settles a paid existing attempt before signaling already completed", async () => {
    const { handler, setSaved, reconcile, prisma } = setup();
    setSaved({
      id: "old",
      gatewayRef: "old",
      amount: 230,
      currency: "SAR",
      status: "PENDING",
      nativeConfigFingerprint: nativePaymentConfigFingerprint(config as any),
    });
    reconcile.execute.mockResolvedValue({ status: "COMPLETED" });
    await expect(
      handler.execute({ clientId: "client", invoiceId: "invoice" }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "PAYMENT_ALREADY_COMPLETED",
        paymentId: "old",
        invoiceId: "invoice",
      }),
    });
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
  it.each([
    {
      gatewayRef: "hosted-invoice",
      status: "PENDING",
      nativeConfigFingerprint: null,
    },
    {
      gatewayRef: null,
      status: "PENDING_VERIFICATION",
      nativeConfigFingerprint: null,
    },
    {
      gatewayRef: "competitor",
      status: "PENDING",
      nativeConfigFingerprint: "different-config",
    },
  ])(
    "never exposes a competing reservation that wins the replacement gap: %p",
    async (competitor) => {
      const { handler, prisma, reconcile, setSaved } = setup();
      const old = {
        id: "old",
        gatewayRef: "old",
        invoiceId: "invoice",
        amount: 230,
        currency: "SAR",
        status: "PENDING",
        nativeConfigFingerprint: nativePaymentConfigFingerprint(config as any),
      };
      setSaved(old);
      prisma.payment.findUnique.mockImplementation(async () => old);
      prisma.payment.update = jest.fn().mockResolvedValue(old);
      // Deterministically place the competitor after FAILED commits and before
      // the replacement transaction reads pending rows under its invoice lock.
      reconcile.execute.mockImplementation(async () => {
        old.status = "FAILED";
        setSaved({
          id: "competitor",
          invoiceId: "invoice",
          amount: 230,
          currency: "SAR",
          ...competitor,
        });
        return { status: "FAILED" };
      });
      await expect(
        handler.execute({ clientId: "client", invoiceId: "invoice" }),
      ).rejects.toThrow();
      expect(prisma.payment.create).not.toHaveBeenCalled();
    },
  );
  it.each(["CONFIRMED", "DEPOSIT_PAID", "COMPLETED"].flatMap(status => [null, "program"].map(programId => ({ status, programId }))))(
    "allows remaining balance after the original hold deadline: %p",
    async ({ status, programId }) => {
      const { handler, prisma } = setup();
      prisma.booking.findFirst.mockResolvedValue({
        id: "booking",
        status,
        programId,
        expiresAt: new Date(0),
      });
      expect(
        (await handler.execute({ clientId: "client", invoiceId: "invoice" }))
          .config.amount,
      ).toBe(230);
    },
  );
  it.each([null, "program"])(
    "rejects an elapsed unconfirmed hold before reserving money (programId=%s)",
    async (programId) => {
      const { handler, prisma } = setup();
      prisma.booking.findFirst.mockResolvedValue({
        id: "booking", status: "AWAITING_PAYMENT", programId,
        expiresAt: new Date(0), isHistoricalImport: false,
      });
      await expect(handler.execute({ clientId: "client", invoiceId: "invoice" }))
        .rejects.toThrow(BadRequestException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    },
  );
  it.each([null, "program"])(
    "keeps imported appointments staff-managed despite an old deadline (programId=%s)",
    async (programId) => {
      const { handler, prisma } = setup();
      prisma.booking.findFirst.mockResolvedValue({
        id: "booking", status: "PENDING", programId,
        expiresAt: new Date(0), isHistoricalImport: true,
      });
      expect((await handler.execute({ clientId: "client", invoiceId: "invoice" })).config.amount).toBe(230);
    },
  );

});
