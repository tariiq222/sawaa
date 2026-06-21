import { ProgramAutomationCron } from './program-automation.cron';
import { ActivityAction, ProgramStatus } from '@prisma/client';

const buildPrisma = () => ({
  program: {
    findMany: jest.fn().mockResolvedValue([]),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  activityLog: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
});

describe('ProgramAutomationCron', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let cron: ProgramAutomationCron;

  beforeEach(() => {
    prisma = buildPrisma();
    cron = new ProgramAutomationCron(prisma as never);
  });

  afterEach(() => jest.clearAllMocks());

  it('is a no-op when no SCHEDULED programs exist', async () => {
    await cron.execute();
    expect(prisma.program.updateMany).not.toHaveBeenCalled();
    expect(prisma.activityLog.createMany).not.toHaveBeenCalled();
  });

  it('closes programs whose startDate + daysCount has elapsed', async () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000);
    prisma.program.findMany.mockResolvedValue([
      { id: 'prog-1', startDate: fiveDaysAgo, daysCount: 3 },
    ]);
    prisma.program.updateMany.mockResolvedValue({ count: 1 });

    await cron.execute();

    expect(prisma.program.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['prog-1'] }, status: ProgramStatus.SCHEDULED },
      data: { status: ProgramStatus.COMPLETED },
    });
    expect(prisma.activityLog.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          entity: 'Program',
          entityId: 'prog-1',
          action: ActivityAction.SYSTEM,
          description: 'Auto-completed: end date passed',
        }),
      ],
    });
  });

  it('skips programs whose endDate has not yet been reached', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000);
    prisma.program.findMany.mockResolvedValue([
      { id: 'prog-1', startDate: threeHoursAgo, daysCount: 4 },
    ]);

    await cron.execute();

    expect(prisma.program.updateMany).not.toHaveBeenCalled();
  });

  it('ignores rows with null startDate (defensive — scheduling always sets it)', async () => {
    prisma.program.findMany.mockResolvedValue([
      { id: 'prog-1', startDate: null, daysCount: 4 },
    ]);

    await cron.execute();

    expect(prisma.program.updateMany).not.toHaveBeenCalled();
  });
});

describe('ProgramAutomationCron.hasEnded', () => {
  it('is false when startDate is null', () => {
    expect(ProgramAutomationCron.hasEnded(null, 4, new Date())).toBe(false);
  });

  it('is true when startDate + daysCount has passed', () => {
    const startDate = new Date(Date.now() - 5 * 86_400_000);
    expect(ProgramAutomationCron.hasEnded(startDate, 3, new Date())).toBe(true);
  });

  it('is false when startDate + daysCount has not yet passed', () => {
    const startDate = new Date(Date.now() - 1 * 86_400_000);
    expect(ProgramAutomationCron.hasEnded(startDate, 3, new Date())).toBe(false);
  });

  it('treats an exact-boundary endDate as ended (inclusive)', () => {
    const now = new Date('2026-06-21T12:00:00.000Z');
    const startDate = new Date(now.getTime() - 3 * 86_400_000);
    expect(ProgramAutomationCron.hasEnded(startDate, 3, now)).toBe(true);
  });
});
