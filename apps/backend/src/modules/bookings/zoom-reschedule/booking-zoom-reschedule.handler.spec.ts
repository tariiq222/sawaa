import { BookingZoomRescheduleHandler } from './booking-zoom-reschedule.handler';

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
  status: 'PENDING',
};

function setup(row = desired) {
  const prisma = {
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
      where: { id: desired.id, status: { not: 'COMPLETED' } },
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
    expect(prisma.bookingZoomSync.update).toHaveBeenCalledWith({
      where: { id: desired.id },
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
    prisma.bookingZoomSync.updateMany
      .mockRejectedValueOnce(new Error('crash before DB finalize'))
      .mockResolvedValueOnce({ count: 1 });

    await expect(handler.handle(envelope)).rejects.toThrow('crash before DB finalize');
    await handler.handle(envelope);

    expect(zoom.updateMeeting).toHaveBeenCalledTimes(1);
    expect(prisma.bookingZoomSync.updateMany).toHaveBeenCalledTimes(2);
  });
});
