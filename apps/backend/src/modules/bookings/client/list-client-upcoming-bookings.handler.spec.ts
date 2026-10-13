import { BookingStatus, Prisma, type Booking } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { ListClientUpcomingBookingsHandler } from './list-client-upcoming-bookings.handler';

const now = new Date('2026-10-09T12:00:00Z');
const row = (id: string, scheduledAt: string, status: BookingStatus = BookingStatus.CONFIRMED, clientId = 'client-1') => ({
  id, clientId, employeeId: 'emp-1', serviceId: 'svc-1', scheduledAt: new Date(scheduledAt),
  endsAt: new Date(new Date(scheduledAt).getTime() + 3600000), status, bookingType: 'INDIVIDUAL', deliveryType: 'IN_PERSON',
  createdAt: now, updatedAt: now,
  price: new Prisma.Decimal(0), currency: 'SAR', branchId: 'branch-1',
} as Booking);

describe('ListClientUpcomingBookingsHandler', () => {
  const prisma = {
    booking: { findMany: jest.fn(), count: jest.fn() },
    employee: { findMany: jest.fn().mockResolvedValue([{ id: 'emp-1', name: 'Sara Therapist' }]) },
    service: { findMany: jest.fn().mockResolvedValue([{ id: 'svc-1', nameAr: 'جلسة', price: 15000, durationMins: 60 }]) },
  };
  const handler = new ListClientUpcomingBookingsHandler(prisma as unknown as PrismaService);
  beforeEach(() => jest.clearAllMocks());

  it('keeps display fields while excluding staff notes, identity and provider metadata', async () => {
    prisma.booking.findMany.mockResolvedValue([{ ...row('private', '2026-10-09T13:00:00Z'), notes: 'staff note', zoomMeetingError: 'provider detail', lateEntryRecordedBy: 'staff-id', source: 'RECEPTION', zoomHostUrl: 'host-secret', zoomStartUrl: 'start-secret' }]);
    prisma.booking.count.mockResolvedValue(1);
    prisma.employee.findMany.mockResolvedValueOnce([{ id: 'emp-1', name: 'Sara Therapist', userId: 'staff-user' }]);
    const result = await handler.execute({ clientId: 'client-1', now });
    expect(result.data[0]).toMatchObject({ id: 'private', status: 'confirmed', employee: { user: { firstName: 'Sara', lastName: 'Therapist' } } });
    for (const field of ['notes', 'zoomMeetingError', 'lateEntryRecordedBy', 'source']) expect(result.data[0]).not.toHaveProperty(field);
    expect(result.data[0].employee).not.toHaveProperty('userId');
    expect(result.data[0].zoomHostUrl).toBeNull();
    expect(result.data[0].zoomStartUrl).toBeNull();
  });

  it('returns canonical UTC and Riyadh display fields with therapist/service details', async () => {
    prisma.booking.findMany.mockResolvedValue([row('nearest', '2026-10-09T13:00:00Z')]);
    prisma.booking.count.mockResolvedValue(1);
    const result = await handler.execute({ clientId: 'client-1', now });
    expect(result.data[0]).toMatchObject({ id: 'nearest', scheduledAt: '2026-10-09T13:00:00.000Z', date: '2026-10-09', startTime: '16:00', employee: { user: { firstName: 'Sara', lastName: 'Therapist' } }, service: { id: 'svc-1' } });
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
  });

  it('emits a client-scoped not-yet-ended lifecycle predicate for both rows and count', async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.booking.count.mockResolvedValue(0);
    await handler.execute({ clientId: 'client-1', now });
    const where = { clientId: 'client-1', endsAt: { gt: now }, status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.DEPOSIT_PAID] } };
    expect(prisma.booking.findMany).toHaveBeenCalledWith({ where, orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }], skip: 0, take: 10 });
    expect(prisma.booking.count).toHaveBeenCalledWith({ where });
  });

  it('selects the in-progress booking first, then future ones, before pagination, rejecting ended and terminal rows', async () => {
    const rows = [
      row('ended', '2026-10-09T10:00:00Z'), row('in-progress', '2026-10-09T11:30:00Z'), row('starts-now', '2026-10-09T12:00:00Z'),
      ...[BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.CANCEL_REQUESTED, BookingStatus.EXPIRED, BookingStatus.NO_SHOW].map((status) => row(status, '2026-10-09T12:01:00Z', status)),
      row('other-client', '2026-10-09T12:02:00Z', BookingStatus.CONFIRMED, 'client-2'),
      row('later', '2026-10-09T14:00:00Z'), row('nearest', '2026-10-09T13:00:00Z', BookingStatus.DEPOSIT_PAID),
    ];
    type Query = { where: { clientId: string; endsAt?: { gt: Date }; status: { in: BookingStatus[] } }; skip: number; take: number };
    const matches = (query: Query) => rows.filter((booking) => booking.clientId === query.where.clientId && query.where.status.in.includes(booking.status)
      && (!query.where.endsAt || booking.endsAt! > query.where.endsAt.gt));
    prisma.booking.findMany.mockImplementation((query: Query) => Promise.resolve(matches(query).sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()).slice(query.skip, query.skip + query.take)));
    prisma.booking.count.mockImplementation((query: Query) => Promise.resolve(matches(query).length));
    const result = await handler.execute({ clientId: 'client-1', now, limit: 1 });
    expect(result.data.map((booking) => booking.id)).toEqual(['in-progress']);
    expect(result.meta.total).toBe(4);
    const second = await handler.execute({ clientId: 'client-1', now, limit: 2, page: 2 });
    expect(second.data.map((booking) => booking.id)).toEqual(['nearest', 'later']);
  });

  it('applies page and limit and preserves an empty result', async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.booking.count.mockResolvedValue(0);
    expect(await handler.execute({ clientId: 'client-1', page: 2, limit: 5, now })).toEqual({ data: [], meta: { total: 0, page: 2, limit: 5, totalPages: 0 } });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 5, take: 5 }));
  });
});
