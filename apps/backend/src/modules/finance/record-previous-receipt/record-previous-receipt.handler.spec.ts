import { Prisma } from "@prisma/client";
import { RecordPreviousReceiptHandler } from "./record-previous-receipt.handler";

describe("RecordPreviousReceiptHandler", () => {
  let tx: any;
  let handler: RecordPreviousReceiptHandler;
  const now = new Date("2026-10-05T12:00:00Z");
  const cmd = {
    invoiceId: "invoice",
    amount: 15000,
    method: "CASH" as const,
    receivedAt: new Date("2026-08-20T09:00:00Z"),
    actorId: "staff",
    receiptEvidenceRef: "paper-5",
    receiptEntryReason: "Found in paper ledger",
    idempotencyKey: "receipt-key",
  };
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: "invoice" }]),
      invoice: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id: "invoice",
            bookingId: "booking",
            total: new Prisma.Decimal(40000),
            currency: "SAR",
            status: "DRAFT",
            issuedAt: null,
          }),
        update: jest.fn().mockImplementation(({ data }) => data),
      },
      booking: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            status: "COMPLETED",
            isHistoricalImport: false,
          }),
      },
      organizationSettings: { findFirst: jest.fn().mockResolvedValue(null) },
      payment: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        create: jest
          .fn()
          .mockImplementation(({ data }) => ({ id: "payment", ...data })),
      },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    handler = new RecordPreviousReceiptHandler({
      withTransaction: (cb: any) => cb(tx),
    } as any);
  });
  afterEach(() => jest.useRealTimers());
  it("records an arbitrary factual partial prepayment without applying current deposit rules", async () => {
    const result = await handler.execute(cmd);
    expect(result).toMatchObject({
      amount: 15000,
      effectiveReceivedAt: cmd.receivedAt,
      processedAt: now,
      receiptRecordedBy: "staff",
      status: "COMPLETED",
    });
    expect(tx.invoice.update).toHaveBeenCalledWith({
      where: { id: "invoice" },
      data: { status: "PARTIALLY_PAID", issuedAt: now, paidAt: undefined },
    });
    expect(tx.outboxEvent.create.mock.calls[0][0].data).toMatchObject({
      eventType: "finance.previous-receipt.recorded",
      payload: {
        payload: {
          effectiveReceivedAt: cmd.receivedAt.toISOString(),
          recordedAt: now.toISOString(),
          organizationId: expect.any(String),
        },
      },
    });
  });
  it("stamps full settlement today, never the historical receipt date", async () => {
    await handler.execute({ ...cmd, amount: 40000 });
    expect(tx.invoice.update.mock.calls[0][0].data).toMatchObject({
      status: "PAID",
      paidAt: now,
      issuedAt: now,
    });
  });
  it.each([
    ["overpayment", { amount: 40001 }],
    ["future receipt", { receivedAt: new Date("2027-01-01") }],
    ["zero", { amount: 0 }],
    ["card", { method: "ONLINE_CARD" }],
  ])("rejects %s before writing", async (_label, extra) => {
    await expect(
      handler.execute({ ...cmd, ...extra } as any),
    ).rejects.toThrow();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
  it("rejects paid facts on terminal sessions", async () => {
    tx.booking.findUnique.mockResolvedValue({ status: "CANCELLED" });
    await expect(handler.execute(cmd)).rejects.toThrow();
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
  it("replays before mutable invoice eligibility and rejects changed evidence", async () => {
    const existing = {
      id: "payment",
      invoiceId: "invoice",
      amount: 15000,
      method: "CASH",
      effectiveReceivedAt: cmd.receivedAt,
      receiptEvidenceRef: cmd.receiptEvidenceRef,
      receiptEntryReason: cmd.receiptEntryReason,
    };
    tx.payment.findUnique.mockResolvedValue(existing);
    tx.invoice.findUnique.mockResolvedValue({ status: "VOID" });
    expect(await handler.execute(cmd)).toEqual(existing);
    await expect(
      handler.execute({ ...cmd, receiptEvidenceRef: "other" }),
    ).rejects.toThrow();
  });
});
