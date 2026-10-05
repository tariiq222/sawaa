import { Prisma } from "@prisma/client";
import { RecordLateSessionHandler } from "./record-late-session.handler";
import { RecordPreviousReceiptHandler } from "../../finance/record-previous-receipt/record-previous-receipt.handler";
const uuid = (n: number) =>
  `550e8400-e29b-41d4-a716-${String(n).padStart(12, "0")}`;
const actor = {
  sub: uuid(5),
  permissions: [{ action: "manage", subject: "all" }],
  roles: [],
};
const request = {
  clientId: uuid(1),
  branchId: uuid(2),
  employeeId: uuid(3),
  serviceId: uuid(4),
  deliveryType: "IN_PERSON" as const,
  scheduledAt: "2026-09-01T10:00:00Z",
  durationMins: 60,
  status: "COMPLETED" as const,
  amountHalalas: 40000,
  paymentMode: "UNPAID" as const,
  creationIdempotencyKey: "late-key",
};

describe("RecordLateSessionHandler", () => {
  let tx: any, handler: RecordLateSessionHandler, state: any, process: any;
  const now = new Date("2026-10-05T12:00:00Z");
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    state = {
      booking: null,
      invoice: null,
      payments: [],
      logs: [],
      events: [],
    };
    tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([{ id: "exists" }]),
      client: {
        findUnique: jest.fn().mockResolvedValue({
          id: uuid(1),
          name: "Client",
          isActive: true,
          deletedAt: null,
        }),
      },
      employee: {
        findUnique: jest.fn().mockResolvedValue({
          id: uuid(3),
          name: "Practitioner",
          isActive: false,
        }),
      },
      branch: {
        findUnique: jest.fn().mockResolvedValue({
          id: uuid(2),
          nameAr: "Branch",
          isActive: false,
        }),
      },
      service: {
        findUnique: jest.fn().mockResolvedValue({
          id: uuid(4),
          nameAr: "Service",
          price: 50000,
          durationMins: 60,
          currency: "SAR",
          isActive: false,
          archivedAt: new Date("2026-10-01"),
          category: {
            nameAr: "Clinic",
            department: { nameAr: "Department" },
          },
        }),
      },
      employeeBranch: {
        findUnique: jest.fn().mockResolvedValue({ id: "binding" }),
      },
      employeeService: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "binding", isActive: false }),
      },
      organizationSettings: {
        findFirst: jest.fn().mockResolvedValue({
          vatRate: new Prisma.Decimal(0),
          payMethodCashEnabled: true,
        }),
      },
      booking: {
        findUnique: jest.fn().mockImplementation(() => state.booking),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(
          ({ data }) =>
            (state.booking = {
              id: uuid(6),
              createdAt: now,
              updatedAt: now,
              ...data,
            }),
        ),
      },
      invoice: {
        findUnique: jest.fn().mockImplementation(() => state.invoice),
        create: jest.fn().mockImplementation(
          ({ data }) =>
            (state.invoice = {
              id: uuid(7),
              issuedAt: null,
              paidAt: null,
              ...data,
            }),
        ),
        update: jest
          .fn()
          .mockImplementation(
            ({ data }) => (state.invoice = { ...state.invoice, ...data }),
          ),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockImplementation(() => state.payments),
        aggregate: jest.fn().mockImplementation(() => ({
          _sum: {
            amount: state.payments.reduce(
              (n: number, p: any) => n + Number(p.amount),
              0,
            ),
          },
        })),
        create: jest.fn().mockImplementation(({ data }) => {
          const p = { id: uuid(8), createdAt: now, ...data };
          state.payments.push(p);
          return p;
        }),
      },
      bookingStatusLog: {
        create: jest.fn().mockImplementation(({ data }) => {
          state.logs.push(data);
          return data;
        }),
      },
      outboxEvent: {
        create: jest.fn().mockImplementation(({ data }) => {
          state.events.push(data);
          return data;
        }),
      },
    };
    const transactions = {
      withTransaction: async (cb: any) => {
        const before = {
          ...state,
          payments: [...state.payments],
          logs: [...state.logs],
          events: [...state.events],
        };
        try {
          return await cb(tx);
        } catch (e) {
          state = before;
          throw e;
        }
      },
    };
    process = {
      execute: jest.fn().mockRejectedValue(new Error("Payment failed")),
    };
    handler = new RecordLateSessionHandler(
      transactions as any,
      new RecordPreviousReceiptHandler(transactions as any),
      process,
    );
  });
  afterEach(() => jest.useRealTimers());
  it("records unpaid past completed service with archived bindings, actual facts, current audit and no event", async () => {
    const r = await handler.execute(request, actor);
    expect(r).toMatchObject({
      outstanding: 40000,
      payment: null,
      isLateEntry: true,
      lateEntryRecordedBy: actor.sub,
    });
    expect(state.booking).toMatchObject({
      status: "COMPLETED",
      completedAt: new Date("2026-09-01T11:00:00Z"),
      lateEntryRecordedAt: now,
      source: "RECEPTION",
      isHistoricalImport: false,
      durationMinutesSnapshot: 60,
      priceSnapshot: new Prisma.Decimal(40000),
    });
    expect(state.logs[0]).toMatchObject({
      createdAt: now,
      toStatus: "COMPLETED",
      changedBy: actor.sub,
    });
    expect(state.events).toHaveLength(0);
    expect(state.invoice).toMatchObject({ status: "DRAFT", issuedAt: null });
    expect(Number(state.invoice.total)).toBe(40000);
  });
  it("records partial prepayment atomically and leaves 25000 outstanding", async () => {
    const r = await handler.execute(
      {
        ...request,
        paymentMode: "PREVIOUSLY_RECEIVED",
        paymentMethod: "CASH",
        paymentAmountHalalas: 15000,
        receivedAt: "2026-08-25T10:00:00Z",
        receiptEvidenceRef: "paper",
        receiptEntryReason: "Ledger entry",
      },
      actor,
    );
    expect(r).toMatchObject({
      outstanding: 25000,
      invoice: { status: "PARTIALLY_PAID" },
      payment: { effectiveReceivedAt: new Date("2026-08-25T10:00:00Z") },
    });
    expect(state.booking.status).toBe("COMPLETED");
    expect(state.events).toHaveLength(1);
  });
  it("distinguishes net subtotal from total under a nonzero VAT fixture", async () => {
    tx.organizationSettings.findFirst.mockResolvedValue({
      vatRate: new Prisma.Decimal("0.05"),
    });
    const r = await handler.execute(request, actor);
    expect(r).toMatchObject({
      outstanding: 42000,
      invoice: { subtotal: 40000, total: 42000, vatAmt: 2000 },
    });
  });
  it.each(["CANCELLED", "NO_SHOW"] as const)(
    "records zero %s with no phantom invoice or payment",
    async (status) => {
      const fields =
        status === "CANCELLED"
          ? {
              cancelledAt: "2026-08-30T10:00:00Z",
              cancellationReason: "Client requested",
            }
          : { noShowAt: "2026-09-01T10:30:00Z" };
      const r = await handler.execute(
        { ...request, status, amountHalalas: 0, ...fields },
        actor,
      );
      expect(r).toMatchObject({ outstanding: 0, invoice: null, payment: null });
    },
  );
  it("retains CONFIRMED without inventing confirmedAt", async () => {
    await handler.execute({ ...request, status: "CONFIRMED" }, actor);
    expect(state.booking.confirmedAt).toBeNull();
  });
  it.each([
    { scheduledAt: "2027-01-01T10:00:00Z" },
    { scheduledAt: "2026-10-05T11:30:00Z" },
    { status: "NO_SHOW", noShowAt: "2026-08-01T00:00:00Z", amountHalalas: 0 },
    {
      status: "CANCELLED",
      cancelledAt: "2027-01-01T00:00:00Z",
      cancellationReason: "reason",
      amountHalalas: 0,
    },
  ])("rejects impossible recorded time %j", async (extra) => {
    await expect(
      handler.execute({ ...request, ...extra } as any, actor),
    ).rejects.toThrow();
    expect(state.booking).toBeNull();
  });
  it("rejects operational overlap with the conflicting booking identity", async () => {
    tx.booking.findFirst.mockResolvedValue({ id: "conflict" });
    await expect(handler.execute(request, actor)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "ALREADY_RECORDED_SESSION",
        bookingId: "conflict",
        message: expect.stringContaining("existing booking"),
      }),
    });
  });
  it("rejects deleted references and absent service bindings", async () => {
    tx.client.findUnique.mockResolvedValue({ deletedAt: now });
    await expect(handler.execute(request, actor)).rejects.toThrow();
    tx.client.findUnique.mockResolvedValue({ id: uuid(1), deletedAt: null });
    tx.employeeService.findUnique.mockResolvedValue(null);
    await expect(handler.execute(request, actor)).rejects.toThrow();
    expect(state.booking).toBeNull();
  });
  it("requires conditional invoice/payment permissions without granting them", async () => {
    const bookingOnly = {
      ...actor,
      permissions: [{ action: "create", subject: "Booking" }],
    };
    await expect(handler.execute(request, bookingOnly)).rejects.toThrow();
    expect(
      (await handler.execute({ ...request, amountHalalas: 0 }, bookingOnly))
        .invoice,
    ).toBeNull();
  });
  it("requires Payment permission even when Invoice creation is allowed", async () => {
    const invoiceOnly = {
      ...actor,
      permissions: [
        { action: "create", subject: "Booking" },
        { action: "create", subject: "Invoice" },
      ],
    };
    await expect(
      handler.execute(
        {
          ...request,
          paymentMode: "PREVIOUSLY_RECEIVED",
          paymentMethod: "CASH",
          paymentAmountHalalas: 15000,
          receivedAt: "2026-08-25T10:00:00Z",
          receiptEvidenceRef: "proof",
          receiptEntryReason: "reason",
        },
        invoiceOnly,
      ),
    ).rejects.toThrow();
    expect(state.booking).toBeNull();
  });

  it("replays before mutable references, compares receipt identity, and writes once", async () => {
    const first = await handler.execute(request, actor);
    tx.client.findUnique.mockResolvedValue(null);
    expect((await handler.execute(request, actor)).booking.id).toBe(
      first.booking.id,
    );
    await expect(
      handler.execute(
        { ...request, scheduledAt: "2026-09-02T10:00:00Z" },
        actor,
      ),
    ).rejects.toThrow();
    expect(state.logs).toHaveLength(1);
  });
  it("rolls back booking, invoice, status log and idempotency key when collection fails", async () => {
    await expect(
      handler.execute(
        {
          ...request,
          paymentMode: "COLLECT_NOW",
          paymentMethod: "CASH",
          paymentAmountHalalas: 40000,
        },
        actor,
      ),
    ).rejects.toThrow("Payment failed");
    expect(state).toEqual({
      booking: null,
      invoice: null,
      payments: [],
      logs: [],
      events: [],
    });
    expect(process.execute.mock.calls[0][0].transaction).toBe(tx);
  });
});

describe("late session exclusion conflict recovery", () => {
  it.each([
    new Prisma.PrismaClientKnownRequestError("exclusion violation", {
      code: "P2010",
      clientVersion: "7.8.0",
      meta: { code: "23P01" },
    }),
    new Prisma.PrismaClientKnownRequestError("exclusion violation", {
      code: "P2004",
      clientVersion: "7.8.0",
      meta: { driverAdapterError: { cause: { originalCode: "23P01" } } },
    }),
    new Prisma.PrismaClientUnknownRequestError(
      'PostgresError { code: "23P01", constraint: "booking_staff_active_time_no_overlap" }',
      { clientVersion: "7.8.0" },
    ),
  ])(
    "reads conflicting identity only in a new transaction after rollback",
    async (error) => {
      const recovery = {
        booking: {
          findFirst: jest.fn().mockResolvedValue({ id: "imported-blocker" }),
        },
      };
      const transactions = {
        withTransaction: jest
          .fn()
          .mockRejectedValueOnce(error)
          .mockImplementationOnce((cb) => cb(recovery)),
      };
      const handler = new RecordLateSessionHandler(
        transactions as any,
        {} as any,
        {} as any,
      );
      await expect(handler.execute(request, actor)).rejects.toMatchObject({
        response: {
          code: "ALREADY_RECORDED_SESSION",
          bookingId: "imported-blocker",
          message: expect.stringContaining("existing booking"),
        },
      });
      expect(transactions.withTransaction).toHaveBeenCalledTimes(2);
      expect(
        recovery.booking.findFirst.mock.calls[0][0].where,
      ).not.toHaveProperty("isHistoricalImport");
    },
  );
});
