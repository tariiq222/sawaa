import { GroupSessionMinReachedHandler } from './group-session-min-reached.handler';
import { RlsTransactionService } from '../../../infrastructure/database';

const mockTenant = { requireOrganizationIdOrDefault: jest.fn().mockReturnValue('00000000-0000-0000-0000-000000000001') };
const mockEventBus = { publish: jest.fn().mockResolvedValue(undefined) };
const buildRlsTx = (prisma: ReturnType<typeof buildPrisma>) =>
  ({
    withTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    withBypassTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  } as unknown as RlsTransactionService);

beforeEach(() => jest.clearAllMocks());

const buildPrisma = (bookingIds: string[] = ['bk-1', 'bk-2']) => ({
  booking: {
    findMany: jest.fn().mockResolvedValue(bookingIds.map((id) => ({ id }))),
    updateMany: jest.fn().mockResolvedValue({ count: bookingIds.length }),
  },
  bookingStatusLog: {
    create: jest.fn().mockResolvedValue({ id: 'log-1' }),
  },
  $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
});

const cmd = {
  serviceId: 'svc-1',
  employeeId: 'emp-1',
  scheduledAt: new Date('2026-05-01T10:00:00Z'),
};

describe('GroupSessionMinReachedHandler', () => {
  it('transitions PENDING_GROUP_FILL bookings to AWAITING_PAYMENT', async () => {
    const prisma = buildPrisma();
    const handler = new GroupSessionMinReachedHandler(prisma as never, buildRlsTx(prisma as never) as never, mockTenant as never, mockEventBus as never);
    await handler.execute(cmd);
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['bk-1', 'bk-2'] } },
        data: expect.objectContaining({ status: 'AWAITING_PAYMENT' }),
      }),
    );
  });

  it('creates a BookingStatusLog entry per booking', async () => {
    const prisma = buildPrisma(['bk-1', 'bk-2', 'bk-3']);
    const handler = new GroupSessionMinReachedHandler(prisma as never, buildRlsTx(prisma as never) as never, mockTenant as never, mockEventBus as never);
    await handler.execute(cmd);
    // 1 updateMany + 3 log creates (one per booking)
    expect(prisma.booking.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.bookingStatusLog.create).toHaveBeenCalledTimes(3);
  });

  it('publishes GroupSessionMinReachedEvent', async () => {
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const prisma = buildPrisma();
    const handler = new GroupSessionMinReachedHandler(prisma as never, buildRlsTx(prisma as never) as never, mockTenant as never, eventBus as never);
    await handler.execute(cmd);
    expect(eventBus.publish).toHaveBeenCalledWith(
      'group_session.min_reached',
      expect.objectContaining({
        payload: expect.objectContaining({ bookingIds: ['bk-1', 'bk-2'] }),
      }),
    );
  });

  it('does nothing when no PENDING_GROUP_FILL bookings exist', async () => {
    const prisma = buildPrisma([]);
    const handler = new GroupSessionMinReachedHandler(prisma as never, buildRlsTx(prisma as never) as never, mockTenant as never, mockEventBus as never);
    await handler.execute(cmd);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('sets expiresAt to ~24h from now', async () => {
    const before = Date.now();
    const prisma = buildPrisma();
    const handler = new GroupSessionMinReachedHandler(prisma as never, buildRlsTx(prisma as never) as never, mockTenant as never, mockEventBus as never);
    await handler.execute(cmd);
    const after = Date.now();
    const callData = (prisma.booking.updateMany.mock.calls[0][0] as { data: { expiresAt: Date } }).data;
    const expiresMs = callData.expiresAt.getTime();
    const WINDOW = 24 * 60 * 60 * 1000;
    expect(expiresMs).toBeGreaterThanOrEqual(before + WINDOW - 100);
    expect(expiresMs).toBeLessThanOrEqual(after + WINDOW + 100);
  });
});
