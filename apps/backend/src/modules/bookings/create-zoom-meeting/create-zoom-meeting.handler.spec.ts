import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus, DeliveryType, ZoomMeetingStatus } from '@prisma/client';
import { CreateZoomMeetingHandler } from './create-zoom-meeting.handler';

const NOW = new Date('2026-08-13T12:00:00.000Z');

function buildHarness(overrides: Record<string, unknown> = {}) {
  let booking = {
    id: 'booking-1',
    deliveryType: DeliveryType.ONLINE,
    status: BookingStatus.CONFIRMED,
    scheduledAt: new Date('2026-08-14T10:00:00.000Z'),
    durationMins: 60,
    zoomMeetingId: null as string | null,
    zoomMeetingStatus: null as ZoomMeetingStatus | null,
    zoomMeetingError: null as string | null,
    zoomCreatePhase: 'BEFORE_CALL',
    zoomCreateLeaseOwner: null as string | null,
    zoomCreateLeaseExpiresAt: null as Date | null,
    zoomCreateAttemptCount: 0,
    ...overrides,
  };
  const bookingDelegate = {
    findFirst: jest.fn(async () => booking),
    findUnique: jest.fn(async () => booking),
    updateMany: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const next = { ...data } as Record<string, unknown>;
      if (typeof next.zoomCreateAttemptCount === 'object') {
        booking.zoomCreateAttemptCount += 1;
        delete next.zoomCreateAttemptCount;
      }
      booking = { ...booking, ...next } as typeof booking;
      return { count: 1 };
    }),
  };
  const prisma = {
    booking: bookingDelegate,
    integration: {
      findFirst: jest.fn().mockResolvedValue({
        provider: 'zoom', isActive: true, config: { ciphertext: 'encrypted' },
      }),
    },
    organizationSettings: {
      findFirst: jest.fn().mockResolvedValue({ timezone: 'Asia/Riyadh' }),
    },
  };
  const zoomApi = {
    getAccessToken: jest.fn().mockResolvedValue('token'),
    createMeeting: jest.fn().mockResolvedValue({
      id: 12345,
      join_url: 'https://zoom.us/j/12345',
      start_url: 'https://zoom.us/s/12345',
    }),
    findMeetingByTopic: jest.fn().mockResolvedValue(null),
  };
  const credentials = {
    decrypt: jest.fn().mockReturnValue({
      zoomClientId: 'client-id',
      zoomClientSecret: 'client-secret',
      zoomAccountId: 'account-id',
    }),
  };
  const handler = new CreateZoomMeetingHandler(
    prisma as never,
    zoomApi as never,
    credentials as never,
  );
  return {
    handler,
    prisma,
    zoomApi,
    credentials,
    booking: () => booking,
    setBooking: (next: typeof booking) => { booking = next; },
  };
}

describe('CreateZoomMeetingHandler — durable provider reconciliation', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('rejects a missing booking', async () => {
    const h = buildHarness();
    h.prisma.booking.findFirst.mockResolvedValueOnce(null as never);
    await expect(h.handler.execute({ bookingId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('rejects a non-online booking', async () => {
    const h = buildHarness({ deliveryType: DeliveryType.IN_PERSON });
    await expect(h.handler.execute({ bookingId: 'booking-1' })).rejects.toThrow(BadRequestException);
  });

  it('does not create Zoom when a queued delivery arrives after cancellation', async () => {
    const h = buildHarness({ status: BookingStatus.CANCELLED });
    await h.handler.execute({ bookingId: 'booking-1' });
    expect(h.prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(h.zoomApi.createMeeting).not.toHaveBeenCalled();
  });

  it('returns an existing completed meeting without acquiring a lease', async () => {
    const h = buildHarness({
      zoomMeetingId: 'existing',
      zoomMeetingStatus: ZoomMeetingStatus.CREATED,
      zoomCreatePhase: 'COMPLETED',
    });
    await expect(h.handler.execute({ bookingId: 'booking-1' })).resolves.toEqual(
      expect.objectContaining({ zoomMeetingId: 'existing' }),
    );
    expect(h.prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(h.zoomApi.createMeeting).not.toHaveBeenCalled();
  });

  it('treats a legacy CREATED meeting as complete even when its phase was backfilled incorrectly', async () => {
    const h = buildHarness({
      zoomMeetingId: 'existing', zoomMeetingStatus: ZoomMeetingStatus.CREATED, zoomCreatePhase: 'BEFORE_CALL',
    });
    await h.handler.execute({ bookingId: 'booking-1' });
    expect(h.zoomApi.createMeeting).not.toHaveBeenCalled();
    expect(h.prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it('lets a concurrent lease loser exit without any provider call', async () => {
    const h = buildHarness();
    h.prisma.booking.updateMany.mockResolvedValueOnce({ count: 0 });
    await h.handler.execute({ bookingId: 'booking-1' });
    expect(h.zoomApi.getAccessToken).not.toHaveBeenCalled();
    expect(h.zoomApi.createMeeting).not.toHaveBeenCalled();
  });

  it('marks an unavailable integration for manual review without a provider call', async () => {
    const h = buildHarness();
    h.prisma.integration.findFirst.mockResolvedValueOnce(null);
    await h.handler.execute({ bookingId: 'booking-1' });
    expect(h.booking()).toEqual(expect.objectContaining({
      zoomMeetingStatus: ZoomMeetingStatus.FAILED,
      zoomCreatePhase: 'MANUAL_REVIEW',
    }));
    expect(h.zoomApi.createMeeting).not.toHaveBeenCalled();
  });

  it('persists CALL_UNKNOWN before one POST and finalizes the confirmed response', async () => {
    const h = buildHarness();
    await h.handler.execute({ bookingId: 'booking-1' });
    const calls = h.prisma.booking.updateMany.mock.calls;
    const unknownIndex = calls.findIndex(([arg]) => arg.data.zoomCreatePhase === 'CALL_UNKNOWN');
    const completedIndex = calls.findIndex(([arg]) => arg.data.zoomCreatePhase === 'COMPLETED');
    expect(unknownIndex).toBeGreaterThan(-1);
    expect(completedIndex).toBeGreaterThan(unknownIndex);
    expect(h.zoomApi.createMeeting).toHaveBeenCalledTimes(1);
    expect(h.booking()).toEqual(expect.objectContaining({
      zoomMeetingId: '12345',
      zoomMeetingStatus: ZoomMeetingStatus.CREATED,
      zoomCreatePhase: 'COMPLETED',
    }));
  });

  it('after an unknown POST timeout, replays GET-only and finalizes a discovered meeting', async () => {
    const h = buildHarness();
    h.zoomApi.createMeeting.mockRejectedValueOnce(new Error('socket timeout'));
    await expect(h.handler.execute({ bookingId: 'booking-1' })).rejects.toThrow('socket timeout');
    expect(h.booking().zoomCreatePhase).toBe('CALL_UNKNOWN');

    h.zoomApi.findMeetingByTopic.mockResolvedValueOnce({
      id: 9876,
      join_url: 'https://zoom.us/j/9876',
      start_url: 'https://zoom.us/s/9876',
      topic: 'Booking booking-1',
      startTime: '2026-08-14T10:00:00.000Z',
      durationMins: 60,
    });
    await h.handler.execute({ bookingId: 'booking-1' });
    expect(h.zoomApi.createMeeting).toHaveBeenCalledTimes(1);
    expect(h.booking()).toEqual(expect.objectContaining({
      zoomMeetingId: '9876', zoomCreatePhase: 'COMPLETED',
    }));
  });

  it('never performs a second POST when GET cannot prove an unknown call succeeded', async () => {
    const h = buildHarness({ zoomCreatePhase: 'CALL_UNKNOWN' });
    await h.handler.execute({ bookingId: 'booking-1' });
    expect(h.zoomApi.findMeetingByTopic).toHaveBeenCalledWith('token', 'Booking booking-1');
    expect(h.zoomApi.createMeeting).not.toHaveBeenCalled();
    expect(h.booking()).toEqual(expect.objectContaining({
      zoomMeetingStatus: ZoomMeetingStatus.FAILED,
      zoomCreatePhase: 'MANUAL_REVIEW',
    }));
  });

  it('recovers a provider success after DB finalization crashes without another POST', async () => {
    const h = buildHarness();
    h.prisma.booking.updateMany
      .mockImplementationOnce(async ({ data }) => {
        h.setBooking({ ...h.booking(), ...data, zoomCreateAttemptCount: 1 });
        return { count: 1 };
      })
      .mockImplementationOnce(async ({ data }) => {
        h.setBooking({ ...h.booking(), ...data });
        return { count: 1 };
      })
      .mockRejectedValueOnce(new Error('DB unavailable after provider response'));
    await expect(h.handler.execute({ bookingId: 'booking-1' })).rejects.toThrow('DB unavailable');

    h.zoomApi.findMeetingByTopic.mockResolvedValueOnce({
      id: 12345,
      join_url: 'https://zoom.us/j/12345',
      start_url: 'https://zoom.us/s/12345',
      topic: 'Booking booking-1',
      startTime: '2026-08-14T10:00:00.000Z',
      durationMins: 60,
    });
    await h.handler.execute({ bookingId: 'booking-1' });
    expect(h.zoomApi.createMeeting).toHaveBeenCalledTimes(1);
    expect(h.booking().zoomCreatePhase).toBe('COMPLETED');
  });

  it('releases a BEFORE_CALL lease when OAuth fails so a later retry remains safe', async () => {
    const h = buildHarness();
    h.zoomApi.getAccessToken.mockRejectedValueOnce(new Error('oauth down'));
    await expect(h.handler.execute({ bookingId: 'booking-1' })).rejects.toThrow('oauth down');
    expect(h.zoomApi.createMeeting).not.toHaveBeenCalled();
    expect(h.booking()).toEqual(expect.objectContaining({
      zoomCreatePhase: 'BEFORE_CALL', zoomCreateLeaseOwner: null,
    }));
  });
});
