import { ListTerminalFailedOutboxHandler } from './list-terminal-failed-outbox.handler';

describe('ListTerminalFailedOutboxHandler', () => {
  const row = {
    id: '11111111-1111-1111-1111-111111111111',
    eventType: 'bookings.booking.created',
    attemptCount: 10,
    createdAt: new Date('2026-08-01T10:00:00Z'),
    failedAt: new Date('2026-08-01T10:00:05Z'),
    failureReason: 'zoho timeout',
  };

  it('returns only metadata fields and never the payload', async () => {
    const prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            ...row,
            failureReason: 'line1\nline2\u0007bell\u001B',
            payload: { organizationId: 'org-secret', eventId: 'e1' },
            status: 'FAILED',
          },
        ]),
      },
    };

    const handler = new ListTerminalFailedOutboxHandler(prisma as never);
    const result = await handler.execute({});

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      id: row.id,
      eventType: row.eventType,
      attemptCount: 10,
      createdAt: row.createdAt,
      failedAt: row.failedAt,
      failureReason: 'line1 line2 bell',
    });
    expect(result.items[0]).not.toHaveProperty('payload');
    expect(result.items[0]).not.toHaveProperty('status');
    expect(result.items[0]).not.toHaveProperty('lockedUntil');
  });

  it('never selects the payload column from the database', async () => {
    const prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const handler = new ListTerminalFailedOutboxHandler(prisma as never);
    await handler.execute({});

    const call = (prisma.outboxEvent.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where.status).toBe('FAILED');
    expect(call.select).not.toHaveProperty('payload');
    expect(Object.keys(call.select).sort()).toEqual([
      'attemptCount',
      'createdAt',
      'eventType',
      'failedAt',
      'failureReason',
      'id',
    ]);
  });

  it('truncates failureReason to 500 characters', async () => {
    const longReason = 'x'.repeat(700);
    const prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([{ ...row, failureReason: longReason }]),
      },
    };

    const handler = new ListTerminalFailedOutboxHandler(prisma as never);
    const result = await handler.execute({});

    expect(result.items[0].failureReason).toHaveLength(500);
    expect(result.items[0].failureReason).toBe('x'.repeat(500));
  });

  it('defaults limit to 50 when not provided', async () => {
    const prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const handler = new ListTerminalFailedOutboxHandler(prisma as never);
    await handler.execute({});

    const call = (prisma.outboxEvent.findMany as jest.Mock).mock.calls[0][0];
    expect(call.take).toBe(50);
    expect(call.orderBy).toEqual({ failedAt: 'desc' });
    expect(call.where).toEqual({ status: 'FAILED' });
  });

  it('respects a provided limit and filters by eventType', async () => {
    const prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const handler = new ListTerminalFailedOutboxHandler(prisma as never);
    await handler.execute({ limit: 25, eventType: 'finance.payment.completed' });

    const call = (prisma.outboxEvent.findMany as jest.Mock).mock.calls[0][0];
    expect(call.take).toBe(25);
    expect(call.where).toEqual({ status: 'FAILED', eventType: 'finance.payment.completed' });
  });

  it('maps null failureReason to null without crashing', async () => {
    const prisma = {
      outboxEvent: {
        findMany: jest.fn().mockResolvedValue([{ ...row, failureReason: null }]),
      },
    };

    const handler = new ListTerminalFailedOutboxHandler(prisma as never);
    const result = await handler.execute({});

    expect(result.items[0].failureReason).toBeNull();
  });
});
