import { GroupSessionAutomationCron } from './group-session-automation.cron';

describe('GroupSessionAutomationCron', () => {
  it('closes open group sessions past their scheduled time + writes audit rows', async () => {
    const prisma = {
      groupSession: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'gs-1' },
          { id: 'gs-2' },
          { id: 'gs-3' },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      activityLog: {
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    };
    const cron = new GroupSessionAutomationCron(prisma as never);
    await expect(cron.execute()).resolves.not.toThrow();
    expect(prisma.groupSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
        take: 100,
      }),
    );
    expect(prisma.groupSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['gs-1', 'gs-2', 'gs-3'] },
          status: 'OPEN',
        }),
        data: { status: 'COMPLETED' },
      }),
    );
    expect(prisma.activityLog.createMany).toHaveBeenCalledTimes(1);
  });

  it('skips audit when no sessions to close', async () => {
    const prisma = {
      groupSession: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
      },
      activityLog: {
        createMany: jest.fn(),
      },
    };
    const cron = new GroupSessionAutomationCron(prisma as never);
    await expect(cron.execute()).resolves.not.toThrow();
    expect(prisma.groupSession.updateMany).not.toHaveBeenCalled();
    expect(prisma.activityLog.createMany).not.toHaveBeenCalled();
  });
});
