import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ReconcileNativePaymentHandler } from "./reconcile-native-payment.handler";
describe("native reconciliation", () => {
  const setup = () => {
    const payment = {
      id: "payment",
      invoiceId: "invoice",
      gatewayRef: "payment",
      amount: 230,
      currency: "SAR",
      status: "PENDING",
    };
    const prisma: any = {
      payment: { findUnique: jest.fn().mockResolvedValue(payment) },
      invoice: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: "invoice", clientId: "client", status: "ISSUED", bookingId: "booking", total: 230, currency: "SAR" }),
      },
      booking: { findFirst: jest.fn().mockResolvedValue({ status: "AWAITING_PAYMENT", programId: null, expiresAt: new Date("2099-01-01") }) },
      refundRequest: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const moyasar = {
      getPaymentStatus: jest.fn().mockResolvedValue({
        id: "payment",
        status: "paid",
        amount: 230,
        currency: "SAR",
      }),
    };
    const settlement = {
      execute: jest.fn().mockResolvedValue({ requiresReview: false }),
    };
    return {
      prisma,
      moyasar,
      settlement,
      handler: new ReconcileNativePaymentHandler(
        prisma as any,
        moyasar as any,
        settlement as any,
      ),
    };
  };
  it("rejects another owner before provider access", async () => {
    const { handler, prisma, moyasar } = setup();
    prisma.invoice.findFirst.mockResolvedValue({
      id: "invoice",
      clientId: "other",
    });
    await expect(
      handler.execute({ clientId: "client", paymentId: "payment" }),
    ).rejects.toThrow(ForbiddenException);
    expect(moyasar.getPaymentStatus).not.toHaveBeenCalled();
  });
  it("keeps the reservation on provider 404", async () => {
    const { handler, moyasar, settlement } = setup();
    moyasar.getPaymentStatus.mockRejectedValue(new NotFoundException());
    expect(
      await handler.execute({ clientId: "client", paymentId: "payment" }),
    ).toEqual({
      paymentId: "payment",
      invoiceId: "invoice",
      status: "PENDING",
      requiresReview: false,
      canCreatePayment: true,
    });
    expect(settlement.execute).not.toHaveBeenCalled();
  });
  it.each([
    { id: "other" },
    { amount: 231 },
    { currency: "USD" },
    { metadata: { invoiceId: "other" } },
  ])("rejects provider mismatch %p", async (change) => {
    const { handler, moyasar, settlement } = setup();
    moyasar.getPaymentStatus.mockResolvedValue({
      id: "payment",
      status: "paid",
      amount: 230,
      currency: "SAR",
      ...change,
    });
    await expect(
      handler.execute({ clientId: "client", paymentId: "payment" }),
    ).rejects.toThrow();
    expect(settlement.execute).not.toHaveBeenCalled();
  });
  it("propagates ambiguous provider failures", async () => {
    const { handler, moyasar } = setup();
    moyasar.getPaymentStatus.mockRejectedValue(new Error("timeout"));
    await expect(
      handler.execute({ clientId: "client", paymentId: "payment" }),
    ).rejects.toThrow("timeout");
  });
  it("binds settlement to persisted native payment", async () => {
    const { handler, settlement } = setup();
    await handler.execute({ clientId: "client", paymentId: "payment" });
    expect(settlement.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredPaymentId: "payment",
        gatewayPaymentId: "payment",
        invoiceId: "invoice",
      }),
    );
  });
  it("does not permit creating another provider request for an initiated payment", async () => {
    const { handler, moyasar } = setup();
    moyasar.getPaymentStatus.mockResolvedValue({
      id: "payment",
      status: "initiated",
      amount: 230,
      currency: "SAR",
    });
    expect(
      await handler.execute({ clientId: "client", paymentId: "payment" }),
    ).not.toHaveProperty("canCreatePayment", true);
  });
  it("preserves manual-review status when provider lookup returns 404 after settlement", async () => {
    const { handler, prisma, moyasar } = setup();
    prisma.payment.findUnique.mockResolvedValue({
      id: "payment",
      invoiceId: "invoice",
      gatewayRef: "payment",
      amount: 230,
      currency: "SAR",
      status: "COMPLETED",
    });
    prisma.refundRequest.findFirst.mockResolvedValue({ id: "review" });
    moyasar.getPaymentStatus.mockRejectedValue(new NotFoundException());
    expect(
      await handler.execute({ clientId: "client", paymentId: "payment" }),
    ).toMatchObject({ status: "COMPLETED", requiresReview: true });
  });
  it.each([
    [{ status: "EXPIRED" }, "BOOKING_EXPIRED"],
    [{ status: "CANCELLED" }, "BOOKING_CLOSED"],
    [{ status: "NO_SHOW" }, "BOOKING_CLOSED"],
    [{ status: "AWAITING_PAYMENT", expiresAt: new Date(0), programId: null }, "BOOKING_EXPIRED"],
    [{ status: "AWAITING_PAYMENT", expiresAt: new Date(0), programId: "program" }, "BOOKING_EXPIRED"],
    [null, "BOOKING_CLOSED"],
  ])("does not resume a nonpayable booking after 404: %p", async (booking, reason) => {
    const { handler, prisma, moyasar, settlement } = setup();
    prisma.booking.findFirst.mockResolvedValue(booking);
    moyasar.getPaymentStatus.mockRejectedValue(new NotFoundException());
    expect(await handler.execute({ clientId: "client", paymentId: "payment" }))
      .toMatchObject({ status: "PENDING", canCreatePayment: false, unavailableReason: reason });
    expect(settlement.execute).not.toHaveBeenCalled();
  });
  it.each(["PAID", "VOID", "PARTIALLY_REFUNDED", "REFUNDED"])("does not resume a %s invoice after 404", async (status) => {
    const { handler, prisma, moyasar } = setup();
    prisma.invoice.findFirst.mockResolvedValue({ id: "invoice", clientId: "client", status });
    moyasar.getPaymentStatus.mockRejectedValue(new NotFoundException());
    expect(await handler.execute({ clientId: "client", paymentId: "payment" }))
      .toMatchObject({ status: "PENDING", canCreatePayment: false, unavailableReason: "INVOICE_CLOSED" });
  });
  it("rechecks the target changed while the provider lookup was in flight", async () => {
    const { handler, prisma, moyasar } = setup();
    moyasar.getPaymentStatus.mockImplementation(async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: "CANCELLED" });
      throw new NotFoundException();
    });
    expect(await handler.execute({ clientId: "client", paymentId: "payment" }))
      .toMatchObject({ canCreatePayment: false, unavailableReason: "BOOKING_CLOSED" });
  });
  it.each(["COMPLETED", "FAILED", "REFUNDED"])("uses current %s state when payment changes during provider lookup", async (status) => {
    const { handler, prisma, moyasar } = setup();
    moyasar.getPaymentStatus.mockImplementation(async () => {
      prisma.payment.findUnique.mockResolvedValue({ id: "payment", invoiceId: "invoice", gatewayRef: "payment", amount: 230, currency: "SAR", status });
      throw new NotFoundException();
    });
    const result = await handler.execute({ clientId: "client", paymentId: "payment" });
    expect(result.status).toBe(status);
    expect(result.canCreatePayment).not.toBe(true);
  });
  it("rechecks ownership after the provider lookup", async () => {
    const { handler, prisma, moyasar } = setup();
    moyasar.getPaymentStatus.mockImplementation(async () => {
      prisma.invoice.findFirst.mockResolvedValue({ id: "invoice", clientId: "other", status: "ISSUED" });
      throw new NotFoundException();
    });
    await expect(handler.execute({ clientId: "client", paymentId: "payment" })).rejects.toThrow(ForbiddenException);
  });
  it.each([
    { gatewayRef: "different" }, { invoiceId: "other" },
    { nativeConfigFingerprint: "changed-account" }, { amount: 231 }, { currency: "USD" },
  ])("fails closed if the reserved identity/config changes during provider404: %p", async (patch) => {
    const { handler, prisma, moyasar } = setup();
    moyasar.getPaymentStatus.mockImplementation(async () => {
      prisma.payment.findUnique.mockResolvedValue({ id: "payment", invoiceId: "invoice", gatewayRef: "payment", amount: 230, currency: "SAR", status: "PENDING", ...patch });
      throw new NotFoundException();
    });
    await expect(handler.execute({ clientId: "client", paymentId: "payment" })).rejects.toThrow();
  });
  it.each(["CONFIRMED", "DEPOSIT_PAID", "COMPLETED"])("allows a %s remaining balance after the old hold deadline", async (status) => {
    const { handler, prisma, moyasar } = setup();
    prisma.booking.findFirst.mockResolvedValue({ status, programId: null, expiresAt: new Date(0) });
    moyasar.getPaymentStatus.mockRejectedValue(new NotFoundException());
    expect(await handler.execute({ clientId: "client", paymentId: "payment" })).toMatchObject({ paymentId: "payment", canCreatePayment: true });
  });

});
