import { BookingZoomRescheduleHandler } from './booking-zoom-reschedule.handler';
import { BookingStatus } from '@prisma/client';

const envelope = {
  eventId: '11111111-1111-4111-8111-111111111111',
  source: 'bookings',
  version: 1,
  occurredAt: new Date(),
  payload: {
    organizationId: 'org-1',
    syncId: '11111111-1111-4111-8111-111111111111',
    bookingId: 'booking-1',
    zoomMeetingId: 'zoom-1',
    revision: 1,
  },
};

const desired = {
  id: envelope.payload.syncId,
  eventId: envelope.eventId,
  bookingId: 'booking-1',
  sourceActionId: 'operation-1',
  zoomMeetingId: 'zoom-1',
  desiredTopic: 'Booking booking-1',
  desiredStartAt: new Date('2026-08-20T10:00:00.000Z'),
  desiredDurationMins: 60,
  revision: 1,
  status: 'PENDING',
};

function setup(row = desired) {
  let bookingState = {
    id: 'booking-1', zoomMeetingId: 'zoom-1', zoomSyncRevision: row.revision,
    status: BookingStatus.CONFIRMED,
    scheduledAt: row.desiredStartAt, durationMins: row.desiredDurationMins,
    zoomSyncLeaseOwner: null as string | null, zoomSyncLeaseExpiresAt: null as Date | null,
  };
  const prisma = {
    booking: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...bookingState })),
      updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
        if (typeof data.zoomSyncLeaseOwner === 'string') {
          if (bookingState.zoomSyncLeaseOwner !== null || where.zoomSyncRevision !== bookingState.zoomSyncRevision) {
            return { count: 0 };
          }
          bookingState = { ...bookingState, ...data };
          return { count: 1 };
        }
        if (data.zoomSyncLeaseOwner === null) {
          if (where.zoomSyncLeaseOwner !== bookingState.zoomSyncLeaseOwner) return { count: 0 };
          bookingState = { ...bookingState, zoomSyncLeaseOwner: null, zoomSyncLeaseExpiresAt: null };
        }
        return { count: 1 };
      }),
    },
    bookingZoomSync: {
      findUnique: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const eventBus = { subscribe: jest.fn() };
  const zoom = {
    getMeeting: jest.fn().mockResolvedValue({
      id: 1,
      topic: 'old topic',
      startTime: '2026-08-19T10:00:00.000Z',
      durationMins: 30,
    }),
    updateMeeting: jest.fn().mockResolvedValue(undefined),
  };
  return {
    prisma,
    eventBus,
    zoom,
    handler: new BookingZoomRescheduleHandler(prisma as never, eventBus as never, zoom as never),
  };
}

describe('BookingZoomRescheduleHandler', () => {
  it('registers a stable isolated event consumer', () => {
    const { handler, eventBus } = setup();
    handler.register();
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'bookings.zoom.reschedule_requested',
      'bookings.zoom-reschedule',
      expect.any(Function),
    );
  });

  it('normalizes a pre-upgrade PENDING event with no revision to durable revision zero', async () => {
    const legacy = {
      ...envelope,
      payload: { ...envelope.payload, revision: undefined },
    };
    const { handler, zoom, prisma } = setup({ ...desired, revision: 0 });
    await handler.handle(legacy);
    expect(zoom.updateMeeting).toHaveBeenCalledTimes(1);
    expect(prisma.bookingZoomSync.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ revision: 0 }),
    }));
  });

  it('supersedes a queued reschedule event after cancellation without calling Zoom', async () => {
    const { handler, zoom, prisma } = setup();
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1', zoomMeetingId: 'zoom-1', zoomSyncRevision: 1,
      scheduledAt: desired.desiredStartAt, durationMins: desired.desiredDurationMins,
      status: BookingStatus.CANCELLED,
    });
    await handler.handle(envelope);
    expect(zoom.getMeeting).not.toHaveBeenCalled();
    expect(zoom.updateMeeting).not.toHaveBeenCalled();
    expect(prisma.bookingZoomSync.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: desired.id }),
      data: expect.objectContaining({ status: 'SUPERSEDED' }),
    }));
  });

  it('finishes the queued desired sync while cancellation is only requested, so a later rejection needs no replacement event', async () => {
    const { handler, zoom, prisma } = setup();
    // Sequence: reschedule emits this outbox row → client requests cancel →
    // staff may reject back to active. CANCEL_REQUESTED is non-terminal, so
    // the original durable event must remain able to converge Zoom.
    let leaseOwner: string | null = null;
    prisma.booking.findUnique.mockImplementation(async () => ({
      id: 'booking-1', zoomMeetingId: 'zoom-1', zoomSyncRevision: 1,
      scheduledAt: desired.desiredStartAt, durationMins: desired.desiredDurationMins,
      status: BookingStatus.CANCEL_REQUESTED,
      zoomSyncLeaseOwner: leaseOwner, zoomSyncLeaseExpiresAt: null,
    }));
    prisma.booking.updateMany.mockImplementation(async ({ data }: any) => {
      if (typeof data.zoomSyncLeaseOwner === 'string') leaseOwner = data.zoomSyncLeaseOwner;
      if (data.zoomSyncLeaseOwner === null) leaseOwner = null;
      return { count: 1 };
    });
    await handler.handle(envelope);
    expect(zoom.updateMeeting).toHaveBeenCalledTimes(1);
    expect(prisma.bookingZoomSync.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETED' }),
    }));
  });

  it('supersedes a stale revisionless event with a tied creation time instead of using UUID order', async () => {
    const legacy = { ...envelope, payload: { ...envelope.payload, revision: undefined } };
    const { handler, zoom, prisma } = setup({ ...desired, revision: 0 });
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1', zoomMeetingId: 'zoom-1', zoomSyncRevision: 0,
      scheduledAt: new Date('2026-08-21T10:00:00.000Z'), durationMins: 60,
    });
    await handler.handle(legacy);
    expect(zoom.updateMeeting).not.toHaveBeenCalled();
    expect(prisma.bookingZoomSync.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: desired.id }),
      data: expect.objectContaining({ status: 'SUPERSEDED' }),
    }));
  });

  it('skips a completed desired-state row on replay', async () => {
    const { handler, zoom, prisma } = setup({ ...desired, status: 'COMPLETED' });
    await handler.handle(envelope);
    expect(zoom.getMeeting).not.toHaveBeenCalled();
    expect(zoom.updateMeeting).not.toHaveBeenCalled();
    expect(prisma.bookingZoomSync.updateMany).not.toHaveBeenCalled();
  });

  it('marks complete without PATCH when Zoom already reflects the desired state', async () => {
    const { handler, zoom, prisma } = setup();
    zoom.getMeeting.mockResolvedValue({
      id: 1,
      topic: desired.desiredTopic,
      startTime: desired.desiredStartAt.toISOString(),
      durationMins: desired.desiredDurationMins,
    });
    await handler.handle(envelope);
    expect(zoom.updateMeeting).not.toHaveBeenCalled();
    expect(prisma.bookingZoomSync.updateMany).toHaveBeenCalledWith({
      where: { id: desired.id, revision: 1, status: { notIn: ['COMPLETED', 'SUPERSEDED'] } },
      data: expect.objectContaining({ status: 'COMPLETED', completedAt: expect.any(Date) }),
    });
  });

  it('PATCHes a stale meeting then marks the desired state complete', async () => {
    const { handler, zoom, prisma } = setup();
    await handler.handle(envelope);
    expect(zoom.updateMeeting).toHaveBeenCalledWith('org-1', 'zoom-1', {
      topic: desired.desiredTopic,
      startTime: desired.desiredStartAt.toISOString(),
      durationMins: desired.desiredDurationMins,
    });
    expect(prisma.bookingZoomSync.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'COMPLETED' }),
    }));
  });

  it('persists a safe retry state and rethrows transient provider errors', async () => {
    const { handler, zoom, prisma } = setup();
    zoom.getMeeting.mockRejectedValue(new Error('Zoom 502 with secret data'));
    await expect(handler.handle(envelope)).rejects.toThrow('Zoom 502');
    expect(prisma.bookingZoomSync.updateMany).toHaveBeenCalledWith({
      where: { id: desired.id, revision: 1, status: 'PROCESSING' },
      data: { status: 'PENDING', lastError: 'Zoom synchronization failed; retry required' },
    });
  });

  it('recovers a crash after PATCH by read-before-write and performs one provider mutation', async () => {
    const { handler, zoom, prisma } = setup();
    let providerIsCurrent = false;
    zoom.getMeeting.mockImplementation(async () => providerIsCurrent
      ? {
          id: 1, topic: desired.desiredTopic,
          startTime: desired.desiredStartAt.toISOString(),
          durationMins: desired.desiredDurationMins,
        }
      : { id: 1, topic: 'old', startTime: '2026-08-19T10:00:00.000Z', durationMins: 30 });
    zoom.updateMeeting.mockImplementation(async () => { providerIsCurrent = true; });
    let failFinalize = true;
    prisma.bookingZoomSync.updateMany.mockImplementation(async ({ data }: any) => {
      if (data.status === 'COMPLETED' && failFinalize) {
        failFinalize = false;
        throw new Error('crash before DB finalize');
      }
      return { count: 1 };
    });

    await expect(handler.handle(envelope)).rejects.toThrow('crash before DB finalize');
    await handler.handle(envelope);

    expect(zoom.updateMeeting).toHaveBeenCalledTimes(1);
    expect(prisma.bookingZoomSync.updateMany.mock.calls.filter(
      ([arg]: any[]) => arg.data.status === 'COMPLETED',
    )).toHaveLength(2);
  });

  it('marks an older revision superseded before any provider read or mutation', async () => {
    const { handler, zoom, prisma } = setup();
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1', zoomMeetingId: 'zoom-1', zoomSyncRevision: 2,
      zoomSyncLeaseOwner: null, zoomSyncLeaseExpiresAt: null,
    });

    await handler.handle(envelope);

    expect(prisma.bookingZoomSync.updateMany).toHaveBeenCalledWith({
      where: { id: desired.id, status: { notIn: ['COMPLETED', 'SUPERSEDED'] } },
      data: expect.objectContaining({ status: 'SUPERSEDED', completedAt: expect.any(Date) }),
    });
    expect(zoom.getMeeting).not.toHaveBeenCalled();
    expect(zoom.updateMeeting).not.toHaveBeenCalled();
  });

  it('does not call Zoom when another worker owns the current booking revision lease', async () => {
    const { handler, zoom, prisma } = setup();
    prisma.booking.updateMany.mockResolvedValue({ count: 0 });

    await expect(handler.handle(envelope)).rejects.toThrow('lease');

    expect(zoom.getMeeting).not.toHaveBeenCalled();
    expect(zoom.updateMeeting).not.toHaveBeenCalled();
  });

  it('aborts before PATCH when a delayed renewal rejects and surfaces the lost lease', async () => {
    jest.useFakeTimers();
    try {
      const { handler, zoom, prisma } = setup();
      const baseUpdate = prisma.booking.updateMany.getMockImplementation()!;
      prisma.booking.updateMany.mockImplementation(async (input: any) => {
        if (input.data.zoomSyncLeaseExpiresAt instanceof Date && input.data.zoomSyncLeaseOwner === undefined) {
          throw new Error('renewal database unavailable');
        }
        return baseUpdate(input);
      });
      let releaseGet!: () => void;
      zoom.getMeeting.mockImplementationOnce(() => new Promise<void>((resolve) => { releaseGet = resolve; }));
      const delivery = handler.handle(envelope);
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(15_000);
      releaseGet();
      await expect(delivery).rejects.toThrow('lease was lost');
      expect(zoom.updateMeeting).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('cannot let a failed older revision revert a newer successful desired state on replay', async () => {
    const revisionA = { ...desired, revision: 1, status: 'PENDING' };
    const revisionB = {
      ...desired,
      id: '22222222-2222-4222-8222-222222222222',
      eventId: '22222222-2222-4222-8222-222222222222',
      sourceActionId: 'operation-2',
      desiredStartAt: new Date('2026-08-21T10:00:00.000Z'),
      revision: 2,
      status: 'PENDING',
    };
    const eventB = {
      ...envelope,
      eventId: revisionB.eventId,
      payload: { ...envelope.payload, syncId: revisionB.id, revision: 2 },
    };
    const { handler, zoom, prisma } = setup(revisionA);
    let currentRevision = 1;
    let leaseOwner: string | null = null;
    prisma.booking.findUnique.mockImplementation(async () => ({
      id: 'booking-1', zoomMeetingId: 'zoom-1', zoomSyncRevision: currentRevision,
      zoomSyncLeaseOwner: leaseOwner, zoomSyncLeaseExpiresAt: null,
      status: BookingStatus.CONFIRMED,
    }));
    prisma.booking.updateMany.mockImplementation(async ({ where, data }: any) => {
      if (typeof data.zoomSyncLeaseOwner === 'string') {
        if (where.zoomSyncRevision !== currentRevision || leaseOwner !== null) return { count: 0 };
        leaseOwner = data.zoomSyncLeaseOwner;
      } else if (data.zoomSyncLeaseOwner === null && where.zoomSyncLeaseOwner === leaseOwner) {
        leaseOwner = null;
      }
      return { count: 1 };
    });
    prisma.bookingZoomSync.findUnique.mockImplementation(async ({ where }: any) =>
      where.eventId === revisionB.eventId ? revisionB : revisionA);
    zoom.getMeeting
      .mockRejectedValueOnce(new Error('transient Zoom failure for revision A'))
      .mockResolvedValue({ id: 1, topic: 'old', startTime: '2026-08-19T10:00:00.000Z', durationMins: 30 });

    await expect(handler.handle(envelope)).rejects.toThrow('revision A');
    currentRevision = 2;
    await handler.handle(eventB);
    await handler.handle(envelope);

    expect(zoom.updateMeeting).toHaveBeenCalledTimes(1);
    expect(zoom.updateMeeting).toHaveBeenCalledWith('org-1', 'zoom-1', expect.objectContaining({
      startTime: revisionB.desiredStartAt.toISOString(),
    }));
  });
});
