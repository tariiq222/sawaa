import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingStatus, DeliveryType, ZoomMeetingStatus } from '@prisma/client';
import { GetEmployeeMeetingStartHandler } from './get-employee-meeting-start.handler';

describe('GetEmployeeMeetingStartHandler', () => {
  const findFirst = jest.fn();
  const handler = new GetEmployeeMeetingStartHandler({ booking: { findFirst } } as never);
  const base = {
    id: 'b-1',
    employeeId: 'emp-1',
    status: BookingStatus.CONFIRMED,
    deliveryType: DeliveryType.ONLINE,
    scheduledAt: new Date('2026-10-01T14:30:00.000Z'),
    durationMins: 50,
    zoomMeetingStatus: ZoomMeetingStatus.CREATED,
    zoomStartUrl: 'https://zoom.us/s/123?zak=token',
  };
  const query = { bookingId: 'b-1', employeeId: 'emp-1' };

  beforeEach(() => findFirst.mockReset());

  it('returns the host link and exact timing for the assigned employee', async () => {
    findFirst.mockResolvedValue(base);
    await expect(handler.execute(query)).resolves.toEqual({
      bookingId: 'b-1',
      scheduledAt: '2026-10-01T14:30:00.000Z',
      durationMins: 50,
      meetingStatus: 'CREATED',
      startUrl: 'https://zoom.us/s/123?zak=token',
    });
  });

  it('withholds the link until the meeting exists', async () => {
    findFirst.mockResolvedValue({ ...base, zoomMeetingStatus: ZoomMeetingStatus.PENDING, zoomStartUrl: null });
    const result = await handler.execute(query);
    expect(result.startUrl).toBeNull();
    expect(result.meetingStatus).toBe('PENDING');
  });

  it('withholds the link when the meeting failed even if a stale url is stored', async () => {
    findFirst.mockResolvedValue({ ...base, zoomMeetingStatus: ZoomMeetingStatus.FAILED });
    await expect(handler.execute(query)).resolves.toMatchObject({ startUrl: null, meetingStatus: 'FAILED' });
  });

  it('rejects a booking assigned to someone else', async () => {
    findFirst.mockResolvedValue({ ...base, employeeId: 'emp-2' });
    await expect(handler.execute(query)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects in-person bookings', async () => {
    findFirst.mockResolvedValue({ ...base, deliveryType: DeliveryType.IN_PERSON });
    await expect(handler.execute(query)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([BookingStatus.CANCELLED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW, BookingStatus.EXPIRED, BookingStatus.CANCEL_REQUESTED, BookingStatus.AWAITING_PAYMENT])(
    'rejects a %s booking',
    async (status) => {
      findFirst.mockResolvedValue({ ...base, status });
      await expect(handler.execute(query)).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('answers 404 for an unknown booking', async () => {
    findFirst.mockResolvedValue(null);
    await expect(handler.execute(query)).rejects.toBeInstanceOf(NotFoundException);
  });
});
