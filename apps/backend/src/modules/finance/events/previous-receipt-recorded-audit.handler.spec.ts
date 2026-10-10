import { randomUUID } from "node:crypto";
import {
  EventBusService,
  DomainEventEnvelope,
} from "../../../infrastructure/events/event-bus.service";
import { OutboxPublisherCron } from "../../ops/cron-tasks/outbox-publisher.cron";
import { PreviousReceiptRecordedEvent } from "./previous-receipt-recorded.event";
import { PreviousReceiptRecordedAuditHandler } from "./previous-receipt-recorded-audit.handler";
import { FinanceModule } from "../finance.module";
import { DEFAULT_ORG_ID } from "../../../common/constants";

function receipt(index: number) {
  return new PreviousReceiptRecordedEvent(
    {
      invoiceId: `invoice-${index}`,
      paymentId: `payment-${index}`,
      bookingId: `booking-${index}`,
      amount: 15000,
      currency: "SAR",
      effectiveReceivedAt: "2026-09-01T10:00:00Z",
      recordedAt: "2026-10-05T10:00:00Z",
      actorId: "staff",
      organizationId: DEFAULT_ORG_ID,
    },
    `operation-${index}`,
  );
}
function transport() {
  const workers = new Map<string, (job: unknown) => Promise<void>>();
  const jobs = new Map<
    string,
    { queue: string; name: string; data: unknown }
  >();
  const bus = new EventBusService(
    {
      createWorker: (queue: string, work: (job: unknown) => Promise<void>) => {
        workers.set(queue, work);
        return {};
      },
      getQueue: (queue: string) => ({
        add: async (
          name: string,
          data: unknown,
          options: { jobId: string },
        ) => {
          jobs.set(`${queue}:${options.jobId}`, { queue, name, data });
        },
      }),
    } as never,
    {
      run: async (fn: () => Promise<void>) => fn(),
      set: () => undefined,
    } as never,
  );
  const drain = async () => {
    for (const job of jobs.values())
      await workers.get(job.queue)!({ name: job.name, data: job.data });
  };
  return { bus, jobs, workers, drain };
}
describe("PreviousReceiptRecordedAuditHandler", () => {
  it("registers through FinanceModule into a stable queue and acknowledges replay without changing the audit payload", async () => {
    const { bus, jobs, drain } = transport();
    const audit = new PreviousReceiptRecordedAuditHandler(bus);
    const other = { register: jest.fn() };
    const module = Reflect.construct(FinanceModule, [
      other,
      other,
      other,
      other,
      other,
      other,
      bus,
      audit,
    ]) as FinanceModule;
    module.onModuleInit();
    const event = receipt(1);
    const envelope = event.toEnvelope();
    const before = JSON.stringify(envelope);
    Object.freeze(envelope.payload);
    Object.freeze(envelope);
    await bus.publish(event.eventName, envelope);
    await bus.publish(event.eventName, envelope);
    expect([...jobs.values()].map((job) => job.queue)).toEqual([
      "domain-events--finance.previous-receipt-audit.v1",
    ]);
    await drain();
    await drain();
    expect(JSON.stringify(envelope)).toBe(before);
    expect(Reflect.getMetadata("providers", FinanceModule)).toContain(
      PreviousReceiptRecordedAuditHandler,
    );
  });

  it("drains over 50 previous receipts and delivers a later ordinary payment with no previous-receipt commercial effects", async () => {
    const { bus, jobs, drain } = transport();
    new PreviousReceiptRecordedAuditHandler(bus).register();
    const commercialEffects: string[] = [];
    bus.subscribe(
      "finance.payment.completed",
      "test.ordinary-payment.v1",
      (envelope) => {
        commercialEffects.push(envelope.eventId);
      },
    );
    const previous = Array.from({ length: 61 }, (_, i) => receipt(i));
    const ordinary: DomainEventEnvelope = {
      eventId: randomUUID(),
      source: "finance",
      version: 1,
      occurredAt: new Date(),
      payload: { organizationId: DEFAULT_ORG_ID },
    };
    const rows = [
      ...previous.map((event) => ({
        id: event.eventId,
        eventType: event.eventName,
        payload: event.toEnvelope(),
      })),
      {
        id: ordinary.eventId,
        eventType: "finance.payment.completed",
        payload: ordinary,
      },
    ].map((row) => ({
      ...row,
      status: "PENDING_V2",
      attemptCount: 0,
      lockedUntil: null as Date | null,
    }));
    const originalPayloads = rows.map((row) => JSON.stringify(row.payload));
    const prisma = {
      $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => {
        if (parts.join("").includes('"CronLock"'))
          return [{ name: "outbox-publisher" }];
        // Atomic claim: UPDATE ... SET "lockedUntil" WHERE id IN (SELECT ...) RETURNING.
        const lockUntil = values[0] as Date,
          now = values[1] as Date,
          limit = values[2] as number;
        const claimed = rows
          .filter(
            (row) =>
              row.status === "PENDING_V2" &&
              (!row.lockedUntil || row.lockedUntil < now),
          )
          .slice(0, limit);
        for (const row of claimed) row.lockedUntil = lockUntil;
        return claimed;
      },
      $executeRaw: async (
        parts: TemplateStringsArray,
        ...values: unknown[]
      ) => {
        if (parts.join("").includes('"OutboxEvent"'))
          for (const row of rows)
            if ((values[1] as string[]).includes(row.id))
              row.lockedUntil = values[0] as Date;
        return 1;
      },
      outboxEvent: {
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: object;
        }) => Object.assign(rows.find((row) => row.id === where.id)!, data),
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: { in: string[] } };
          data: object;
        }) => {
          const affected = rows.filter((row) => where.id.in.includes(row.id));
          for (const row of affected) Object.assign(row, data);
          return { count: affected.length };
        },
      },
    };
    const metrics = {
      outboxTerminalFailures: {
        labels: () => ({
          inc: () => {
            throw new Error("unexpected terminal failure");
          },
        }),
      },
    };
    const cron = new OutboxPublisherCron(
      prisma as never,
      bus,
      metrics as never,
    );
    await cron.execute();
    await drain();
    expect(commercialEffects).toEqual([]);
    expect(rows.filter((row) => row.status === "PUBLISHED")).toHaveLength(50);
    await cron.execute();
    await drain();
    expect(rows.every((row) => row.status === "PUBLISHED")).toBe(true);
    expect(commercialEffects).toEqual([ordinary.eventId]);
    expect(rows.map((row) => JSON.stringify(row.payload))).toEqual(
      originalPayloads,
    );
    expect(jobs.size).toBe(62);
    expect(
      [...jobs.values()].filter(
        (job) =>
          job.queue === "domain-events--finance.previous-receipt-audit.v1",
      ),
    ).toHaveLength(61);
  });
});
