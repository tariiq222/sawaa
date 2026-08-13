import { ConflictException, NotFoundException } from '@nestjs/common';
import { RetryFailedOutboxEventHandler } from './retry-failed-outbox-event.handler';

const ID = '11111111-1111-1111-1111-111111111111';

describe('RetryFailedOutboxEventHandler', () => {
  it('atomically resets a FAILED row to PENDING and clears retry state', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: ID, status: 'FAILED', deliveryLane: 'PENDING' })
      .mockResolvedValueOnce({
        id: ID,
        eventType: 'bookings.booking.created',
        attemptCount: 0,
        createdAt: new Date('2026-08-01T10:00:00Z'),
        failedAt: null,
        failureReason: null,
      });

    const prisma = { outboxEvent: { findUnique, updateMany } };
    const handler = new RetryFailedOutboxEventHandler(prisma as never);

    const result = await handler.execute({ id: ID });

    // The mutation is conditional on the row still being FAILED — atomic.
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: ID, status: 'FAILED' },
      data: {
        status: 'PENDING',
        attemptCount: 0,
        failedAt: null,
        failureReason: null,
        lockedUntil: null,
        publishedAt: null,
      },
    });
    expect(result).toMatchObject({
      id: ID,
      status: 'PENDING',
      attemptCount: 0,
      failedAt: null,
      failureReason: null,
    });
    expect(result).not.toHaveProperty('payload');
  });

  it('restores a failed PENDING_V2 event to its safe lane, never legacy PENDING', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findUnique = jest.fn()
      .mockResolvedValueOnce({ id: ID, status: 'FAILED', deliveryLane: 'PENDING_V2' })
      .mockResolvedValueOnce({ id: ID, eventType: 'bookings.zoom.create_requested', attemptCount: 0, createdAt: new Date(), failedAt: null, failureReason: null });
    const handler = new RetryFailedOutboxEventHandler({ outboxEvent: { findUnique, updateMany } } as never);
    await expect(handler.execute({ id: ID })).resolves.toMatchObject({ status: 'PENDING_V2' });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PENDING_V2' }),
    }));
  });

  it('throws 404 and does not mutate when the event does not exist', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const updateMany = jest.fn();
    const prisma = { outboxEvent: { findUnique, updateMany } };
    const handler = new RetryFailedOutboxEventHandler(prisma as never);

    await expect(handler.execute({ id: ID })).rejects.toBeInstanceOf(NotFoundException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('throws 409 and does not mutate when the event exists but is not FAILED', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: ID, status: 'PUBLISHED' });
    const updateMany = jest.fn();
    const prisma = { outboxEvent: { findUnique, updateMany } };
    const handler = new RetryFailedOutboxEventHandler(prisma as never);

    await expect(handler.execute({ id: ID })).rejects.toBeInstanceOf(ConflictException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('throws 409 when the row is concurrently moved out of FAILED between read and update', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: ID, status: 'FAILED' });
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const prisma = { outboxEvent: { findUnique, updateMany } };
    const handler = new RetryFailedOutboxEventHandler(prisma as never);

    await expect(handler.execute({ id: ID })).rejects.toBeInstanceOf(ConflictException);
    // The conditional update was attempted (guarded by status = FAILED) but matched nothing.
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
