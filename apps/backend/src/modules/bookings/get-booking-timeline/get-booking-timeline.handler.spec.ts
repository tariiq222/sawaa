import { NotFoundException } from '@nestjs/common';
import { GetBookingTimelineHandler } from './get-booking-timeline.handler';

describe('GetBookingTimelineHandler', () => {
  const bookingId = 'b1';

  function makePrisma(overrides: Record<string, unknown> = {}) {
    return {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: bookingId,
          createdAt: new Date('2026-01-01T10:00:00Z'),
        }),
      },
      bookingStatusLog: { findMany: jest.fn().mockResolvedValue([]) },
      invoice: { findMany: jest.fn().mockResolvedValue([]) },
      activityLog: { findMany: jest.fn().mockResolvedValue([]) },
      ...overrides,
    } as never;
  }

  it('throws when the booking does not exist', async () => {
    const prisma = makePrisma({
      booking: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const handler = new GetBookingTimelineHandler(prisma);
    await expect(handler.execute({ bookingId })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('always emits a CREATED entry from booking.createdAt', async () => {
    const handler = new GetBookingTimelineHandler(makePrisma());
    const out = await handler.execute({ bookingId });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: 'CREATED', at: '2026-01-01T10:00:00.000Z' });
  });

  it('merges status, payment and refund entries sorted chronologically', async () => {
    const prisma = makePrisma({
      bookingStatusLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 's1',
            fromStatus: 'PENDING',
            toStatus: 'CONFIRMED',
            changedBy: 'u1',
            reason: null,
            createdAt: new Date('2026-01-01T11:00:00Z'),
          },
        ]),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'inv1',
            payments: [
              {
                id: 'p1',
                amount: '30000',
                method: 'CASH',
                status: 'COMPLETED',
                createdAt: new Date('2026-01-01T10:30:00Z'),
                processedAt: new Date('2026-01-01T10:31:00Z'),
              },
            ],
            refundRequests: [
              {
                id: 'r1',
                amount: '30000',
                status: 'COMPLETED',
                reason: 'cancelled',
                processedBy: 'u2',
                denialReason: null,
                createdAt: new Date('2026-01-01T12:00:00Z'),
                processedAt: new Date('2026-01-01T12:05:00Z'),
              },
            ],
          },
        ]),
      },
    });
    const handler = new GetBookingTimelineHandler(prisma);
    const out = await handler.execute({ bookingId });

    expect(out.map((e) => e.kind)).toEqual([
      'CREATED',
      'PAYMENT',
      'STATUS_CHANGE',
      'REFUND',
    ]);
    const payment = out.find((e) => e.kind === 'PAYMENT')!;
    expect(payment).toMatchObject({ amount: 30000, method: 'CASH', paymentStatus: 'COMPLETED' });
    const refund = out.find((e) => e.kind === 'REFUND')!;
    expect(refund).toMatchObject({ amount: 30000, refundStatus: 'COMPLETED', actor: 'u2' });
  });

  it('renders a reschedule as a single RESCHEDULE entry carrying old/new times', async () => {
    const at = new Date('2026-01-02T09:00:00Z');
    const prisma = makePrisma({
      bookingStatusLog: {
        // The metadata-less status-log row written alongside the reschedule.
        findMany: jest.fn().mockResolvedValue([
          {
            id: 's1',
            fromStatus: 'CONFIRMED',
            toStatus: 'CONFIRMED',
            changedBy: 'u1',
            reason: 'rescheduled',
            createdAt: at,
          },
        ]),
      },
      activityLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'a1',
            userId: 'u1',
            userEmail: null,
            description: 'Booking rescheduled',
            occurredAt: new Date(at.getTime() + 50),
            metadata: {
              fromScheduledAt: '2026-02-01T10:00:00.000Z',
              toScheduledAt: '2026-02-05T14:00:00.000Z',
            },
          },
        ]),
      },
    });
    const handler = new GetBookingTimelineHandler(prisma);
    const out = await handler.execute({ bookingId });

    const reschedules = out.filter((e) => e.kind === 'RESCHEDULE');
    expect(reschedules).toHaveLength(1); // status-log row deduped against activity
    expect(reschedules[0].meta).toMatchObject({
      fromScheduledAt: '2026-02-01T10:00:00.000Z',
      toScheduledAt: '2026-02-05T14:00:00.000Z',
    });
    // No confusing same-status transition leaks through.
    expect(out.some((e) => e.kind === 'STATUS_CHANGE')).toBe(false);
  });
});
