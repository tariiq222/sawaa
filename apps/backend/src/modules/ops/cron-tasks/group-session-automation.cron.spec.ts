import { GroupSessionAutomationCron } from './group-session-automation.cron';

const buildCls = () => ({
  run: jest.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
  set: jest.fn(),
});

describe('GroupSessionAutomationCron', () => {
  it('closes open group sessions past their scheduled time', async () => {
    const prisma = {
      $allTenants: {
        groupSession: {
          updateMany: jest.fn().mockResolvedValue({ count: 3 }),
        },
      },
    };
    const cron = new GroupSessionAutomationCron(prisma as never, buildCls() as never);
    await expect(cron.execute()).resolves.not.toThrow();
    expect(prisma.$allTenants.groupSession.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'OPEN',
        scheduledAt: expect.objectContaining({ lte: expect.any(Date) }),
      },
      data: { status: 'COMPLETED' },
    });
  });

  it('logs when no sessions to close', async () => {
    const prisma = {
      $allTenants: {
        groupSession: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      },
    };
    const cron = new GroupSessionAutomationCron(prisma as never, buildCls() as never);
    await expect(cron.execute()).resolves.not.toThrow();
  });
});
