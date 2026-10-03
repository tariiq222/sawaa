import { Test } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { BookingStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { ZoomMeetingService } from '../zoom-meeting.service';
import { RefundCompletedCompatibilityHandler } from './refund-completed.handler';

// Exercise the real subscription and event bus, replacing only database and
// queue/provider IO. Reintroducing the refund cancellation cascade must fail
// for both active and terminal appointments, including duplicate deliveries.
describe('RefundCompletedCompatibilityHandler compatibility acknowledgement', () => {
  let eventBus: EventBusService;
  let prisma: ReturnType<typeof mockPrisma>;
  let zoom: { deleteMeeting: jest.Mock; deleteMeetingStrict: jest.Mock };
  let processors: Map<string, (job: unknown) => Promise<void>>;
  let queued: { name: string; data: unknown; options: unknown }[];
  let booking: Record<string, unknown>;
  const queueName = 'domain-events--bookings.refund-completed.v1';

  function mockPrisma() {
    return {
      booking: {
        findFirst: jest.fn(async () => booking),
        update: jest.fn(async ({ data }) => Object.assign(booking, data)),
        updateMany: jest.fn(async ({ data }) => {
          Object.assign(booking, data);
          return { count: 1 };
        }),
      },
      bookingStatusLog: { create: jest.fn() },
      outboxEvent: { create: jest.fn() },
      packageCreditUsage: { update: jest.fn() },
      packageCredit: { update: jest.fn() },
      programEnrollment: { deleteMany: jest.fn() },
      program: { update: jest.fn() },
    };
  }

  function envelope(amount = 10000, bookingId: string | null = 'book-1'): DomainEventEnvelope {
    return {
      eventId: 'refund-1', source: 'finance', version: 1,
      occurredAt: '2026-10-03T00:00:00.000Z',
      payload: {
        refundRequestId: 'rr-1', organizationId: '00000000-0000-0000-0000-000000000001',
        invoiceId: 'inv-1', paymentId: 'pay-1', bookingId, amount, currency: 'SAR',
      },
    };
  }

  beforeEach(async () => {
    processors = new Map();
    queued = [];
    prisma = mockPrisma();
    zoom = { deleteMeeting: jest.fn(), deleteMeetingStrict: jest.fn() };
    const cls = { run: (fn: () => unknown) => fn(), set: jest.fn() };
    eventBus = new EventBusService({
      createWorker: jest.fn((name, processor) => {
        processors.set(name, processor);
        return {};
      }),
      getQueue: jest.fn(() => ({ add: jest.fn(async (name, data, options) => {
        queued.push({ name, data, options });
      }) })),
    } as unknown as BullMqService, cls as unknown as ClsService);
    const module = await Test.createTestingModule({
      providers: [
        RefundCompletedCompatibilityHandler,
        { provide: EventBusService, useValue: eventBus },
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: { withTransaction: (fn: (tx: unknown) => unknown) => fn(prisma) } },
        { provide: ZoomMeetingService, useValue: zoom },
        { provide: ClsService, useValue: cls },
      ],
    }).compile();
    module.get(RefundCompletedCompatibilityHandler).register();
  });

  it.each(Object.values(BookingStatus).flatMap(status => [
    { status, kind: 'partial', amount: 2500 },
    { status, kind: 'full', amount: 10000 },
  ]))('acknowledges a $kind refund for $status without appointment side effects', async ({ status, amount }) => {
    booking = {
      id: 'book-1', status, zoomMeetingId: 'zoom-1',
      zoomJoinUrl: 'join-url', zoomHostUrl: 'host-url', zoomStartUrl: 'start-url',
      packageCreditId: 'credit-1', programId: 'program-1',
    };
    const original = { ...booking };
    const publish = jest.spyOn(eventBus, 'publish');
    await eventBus.publish('finance.refund.completed', envelope(amount));
    expect(queued).toHaveLength(1);
    expect(queued[0].options).toEqual(expect.objectContaining({ jobId: 'refund-1' }));
    const consume = processors.get(queueName)!;
    await consume(queued[0]);
    await consume(queued[0]);

    expect(booking).toEqual(original);
    expect(prisma.booking.findFirst).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(prisma.bookingStatusLog.create).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
    expect(prisma.packageCreditUsage.update).not.toHaveBeenCalled();
    expect(prisma.packageCredit.update).not.toHaveBeenCalled();
    expect(prisma.programEnrollment.deleteMany).not.toHaveBeenCalled();
    expect(prisma.program.update).not.toHaveBeenCalled();
    expect(zoom.deleteMeeting).not.toHaveBeenCalled();
    expect(zoom.deleteMeetingStrict).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('acknowledges already queued legacy deliveries for the stable consumer', async () => {
    booking = { id: 'book-1', status: BookingStatus.CONFIRMED, zoomMeetingId: 'zoom-1' };
    await processors.get('domain-events')!({
      name: 'finance.refund.completed',
      data: { eventName: 'finance.refund.completed', event: envelope(), consumerId: 'bookings.refund-completed.v1' },
    });
    expect(prisma.booking.findFirst).not.toHaveBeenCalled();
    expect(zoom.deleteMeetingStrict).not.toHaveBeenCalled();
  });

  it('acknowledges package refunds without a booking', async () => {
    await eventBus.publish('finance.refund.completed', envelope(10000, null));
    await processors.get(queueName)!(queued[0]);
    expect(prisma.booking.findFirst).not.toHaveBeenCalled();
  });
});
