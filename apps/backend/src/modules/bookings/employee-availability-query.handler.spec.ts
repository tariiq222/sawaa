import { EmployeeAvailabilityQueryHandler } from './employee-availability-query.handler';

describe('EmployeeAvailabilityQueryHandler', () => {
  const checkAvailability = { execute: jest.fn() };
  const getMainBranch = { execute: jest.fn() };
  const handler = new EmployeeAvailabilityQueryHandler(
    checkAvailability as never,
    getMainBranch as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('uses the main branch and formats slot times in UTC', async () => {
    getMainBranch.execute.mockResolvedValue({ id: 'main-branch' });
    checkAvailability.execute.mockResolvedValue([
      {
        startTime: new Date('2026-05-01T09:00:00Z'),
        endTime: new Date('2026-05-01T09:30:00Z'),
      },
    ]);

    await expect(handler.slots({ employeeId: 'emp-1', date: '2026-05-01' })).resolves.toEqual([
      { startTime: '09:00', endTime: '09:30' },
    ]);
    expect(checkAvailability.execute).toHaveBeenCalledWith(expect.objectContaining({
      employeeId: 'emp-1',
      branchId: 'main-branch',
      durationMins: undefined,
    }));
  });

  it('pads single-digit hours and minutes', async () => {
    checkAvailability.execute.mockResolvedValue([
      {
        startTime: new Date('2026-05-01T08:05:00Z'),
        endTime: new Date('2026-05-01T10:15:00Z'),
      },
    ]);

    await expect(handler.slots({
      employeeId: 'emp-1',
      date: '2026-05-01',
      duration: 45,
      branchId: 'branch-1',
    })).resolves.toEqual([{ startTime: '08:05', endTime: '10:15' }]);
  });

  it('keeps an explicit branch and caps the day horizon at 90', async () => {
    checkAvailability.execute.mockResolvedValue([]);

    await handler.availableDays({
      employeeId: 'emp-1',
      startDate: '2026-05-01',
      days: 120,
      branchId: 'branch-1',
    });

    expect(getMainBranch.execute).not.toHaveBeenCalled();
    expect(checkAvailability.execute).toHaveBeenCalledTimes(90);
    expect(checkAvailability.execute).toHaveBeenCalledWith(expect.objectContaining({
      branchId: 'branch-1',
      silentOnMissingConfig: true,
    }));
  });

  it('returns only dates that have at least one slot', async () => {
    checkAvailability.execute
      .mockResolvedValueOnce([{ startTime: new Date(), endTime: new Date() }])
      .mockResolvedValueOnce([]);

    await expect(handler.availableDays({
      employeeId: 'emp-1',
      startDate: '2026-05-01',
      days: 2,
      branchId: 'branch-1',
    })).resolves.toEqual(['2026-05-01']);
  });
});
