import { Test, TestingModule } from '@nestjs/testing';
import { ClsService } from 'nestjs-cls';
import { BookingStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { ZoomMeetingService } from '../zoom-meeting.service';
import { RefundCompletedEventHandler } from './refund-completed.handler';

/**
 * SECURITY (P0-15): A refund that doesn't tear down the booking leaves the
 * client with a live Zoom join URL after their money is back — straight
 * refund fraud. These tests pin the cascade contract:
 *
 *   1. Booking → CANCELLED
 *   2. Zoom meeting deleted
 *   3. zoomJoinUrl / zoomHostUrl / zoomStartUrl nulled
 *
 * The handler is event-driven (subscribes via `register()`), so the tests
 * capture the callback from `eventBus.subscribe` and invoke it directly to
 * keep the suite pure-unit (no BullMQ worker).
 */
describe('RefundCompletedEventHandler', () => {
  let handler: RefundCompletedEventHandler;
  let prisma: {
    booking: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  let rls: { withTransaction: jest.Mock };
  let eventBus: { subscribe: jest.Mock; publish: jest.Mock };
  let zoomMeeting: { deleteMeeting: jest.Mock };
  let cls: { run: jest.Mock; set: jest.Mock };
  let registeredHandler: (envelope: { payload: Record<string, unknown> }) => Promise<void>;

  const baseEnvelope = (bookingId: string | null) => ({
    payload: {
      refundRequestId: 'rr-1',
      organizationId: '00000000-0000-0000-0000-000000000001',
      invoiceId: 'inv-1',
      paymentId: 'pay-1',
      bookingId,
      amount: 100,
      currency: 'SAR',
    },
  });

  beforeEach(async () => {
    prisma = {
      booking: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'book-1' }),
      },
    };
    rls = { withTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)) };
    eventBus = {
      subscribe: jest.fn((_name: string, cb: (e: { payload: Record<string, unknown> }) => Promise<void>) => {
        registeredHandler = cb;
      }),
      publish: jest.fn(),
    };
    zoomMeeting = { deleteMeeting: jest.fn().mockResolvedValue(undefined) };
    // cls.run invokes the callback synchronously so the handler's cls.run blocks
    // execute and any cls.set side-effects happen.
    cls = {
      run: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundCompletedEventHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: rls },
        { provide: EventBusService, useValue: eventBus },
        { provide: ZoomMeetingService, useValue: zoomMeeting },
        { provide: ClsService, useValue: cls },
      ],
    }).compile();

    handler = module.get<RefundCompletedEventHandler>(RefundCompletedEventHandler);
    handler.register();
  });

  it('subscribes to finance.refund.completed on register()', () => {
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'finance.refund.completed',
      expect.any(Function),
    );
  });

  it('skips the cascade when bookingId is null (bundle-purchase refund path)', async () => {
    await registeredHandler(baseEnvelope(null));

    expect(prisma.booking.findFirst).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(zoomMeeting.deleteMeeting).not.toHaveBeenCalled();
  });

  it('skips silently when the booking row does not exist', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);

    await registeredHandler(baseEnvelope('book-missing'));

    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(zoomMeeting.deleteMeeting).not.toHaveBeenCalled();
  });

  it('cascades a CONFIRMED booking to CANCELLED in a transaction with a status log', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'book-1',
      status: BookingStatus.CONFIRMED,
      zoomMeetingId: null,
    });

    await registeredHandler(baseEnvelope('book-1'));

    expect(rls.withTransaction).toHaveBeenCalledTimes(1);
    // The transaction callback runs tx.booking.update + tx.bookingStatusLog.create
    // in parallel (Promise.all); both must happen.
    const txArg = rls.withTransaction.mock.calls[0][0] as (
      tx: { booking: { update: jest.Mock }; bookingStatusLog: { create: jest.Mock } },
    ) => Promise<unknown>;
    const txMock = {
      booking: { update: jest.fn() },
      bookingStatusLog: { create: jest.fn() },
    };
    await txArg(txMock);
    expect(txMock.booking.update).toHaveBeenCalledWith({
      where: { id: 'book-1' },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: expect.any(Date),
        cancelReason: 'OTHER',
      },
    });
    expect(txMock.bookingStatusLog.create).toHaveBeenCalledWith({
      data: {
        bookingId: 'book-1',
        fromStatus: BookingStatus.CONFIRMED,
        toStatus: BookingStatus.CANCELLED,
        changedBy: 'system',
        reason: 'refund:rr-1',
      },
    });
  });

  it('deletes the Zoom meeting and nulls all four zoom URL/id fields', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'book-1',
      status: BookingStatus.CONFIRMED,
      zoomMeetingId: 'zm-1',
    });

    await registeredHandler(baseEnvelope('book-1'));

    expect(zoomMeeting.deleteMeeting).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      'zm-1',
    );
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'book-1' },
      data: {
        zoomMeetingId: null,
        zoomJoinUrl: null,
        zoomHostUrl: null,
        zoomStartUrl: null,
      },
    });
  });

  it('still nulls the zoom fields when deleteMeeting throws (best-effort teardown)', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'book-1',
      status: BookingStatus.CONFIRMED,
      zoomMeetingId: 'zm-1',
    });
    zoomMeeting.deleteMeeting.mockRejectedValue(new Error('zoom API down'));

    // The handler swallows the zoom error and continues to the null-URL update.
    await expect(registeredHandler(baseEnvelope('book-1'))).resolves.toBeUndefined();

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'book-1' },
      data: {
        zoomMeetingId: null,
        zoomJoinUrl: null,
        zoomHostUrl: null,
        zoomStartUrl: null,
      },
    });
  });

  it('does not re-issue a status update for an already-CANCELLED booking (idempotent)', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'book-1',
      status: BookingStatus.CANCELLED,
      zoomMeetingId: 'zm-1',
    });

    await registeredHandler(baseEnvelope('book-1'));

    expect(rls.withTransaction).not.toHaveBeenCalled();
    // but still tears down zoom (receipts may outlive the cancel flow)
    expect(zoomMeeting.deleteMeeting).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      'zm-1',
    );
  });

  it('does not re-issue a status update for an already-COMPLETED booking', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'book-1',
      status: BookingStatus.COMPLETED,
      zoomMeetingId: null,
    });

    await registeredHandler(baseEnvelope('book-1'));

    expect(rls.withTransaction).not.toHaveBeenCalled();
  });

  it('leaves the status alone (and still tears down zoom) when the transition is invalid', async () => {
    // EXPIRED is terminal; assertTransition(EXPIRED, DIRECT_CANCEL) throws.
    prisma.booking.findFirst.mockResolvedValue({
      id: 'book-1',
      status: BookingStatus.EXPIRED,
      zoomMeetingId: 'zm-1',
    });

    await registeredHandler(baseEnvelope('book-1'));

    // Status update inside rls.withTransaction is skipped because the
    // assertTransition throws and is caught in the inner try/catch.
    expect(prisma.booking.update).toHaveBeenCalledTimes(1); // only the zoom null update
    expect(zoomMeeting.deleteMeeting).toHaveBeenCalled();
  });

  it('does not call zoom delete when the booking has no zoomMeetingId', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'book-1',
      status: BookingStatus.CONFIRMED,
      zoomMeetingId: null,
    });

    await registeredHandler(baseEnvelope('book-1'));

    expect(zoomMeeting.deleteMeeting).not.toHaveBeenCalled();
  });

  it('swallows unexpected errors so the refund pipeline is not blocked', async () => {
    prisma.booking.findFirst.mockRejectedValue(new Error('db down'));

    await expect(registeredHandler(baseEnvelope('book-1'))).resolves.toBeUndefined();
    expect(zoomMeeting.deleteMeeting).not.toHaveBeenCalled();
  });

  it('stamps the CLS context as system before each prisma read/write', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'book-1',
      status: BookingStatus.CONFIRMED,
      zoomMeetingId: null,
    });

    await registeredHandler(baseEnvelope('book-1'));

    // cls.run is invoked at least twice (findFirst + the status-update tx) and
    // cls.set(SYSTEM_CONTEXT_CLS_KEY, true) is set inside each.
    expect(cls.run).toHaveBeenCalled();
    expect(cls.set).toHaveBeenCalledWith('systemContext', true);
  });
});
