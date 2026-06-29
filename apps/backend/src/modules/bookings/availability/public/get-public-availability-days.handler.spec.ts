import { Test, TestingModule } from '@nestjs/testing';
import { GetPublicAvailabilityDaysHandler } from './get-public-availability-days.handler';
import { PrismaService } from '../../../../infrastructure/database';
import { CheckAvailabilityHandler } from '../../check-availability/check-availability.handler';

describe('GetPublicAvailabilityDaysHandler', () => {
  let handler: GetPublicAvailabilityDaysHandler;
  let prisma: any;
  let checkAvailability: { execute: jest.Mock };

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn() },
      employeeBranch: { findFirst: jest.fn() },
      employeeService: { findFirst: jest.fn() },
    };
    checkAvailability = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPublicAvailabilityDaysHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: CheckAvailabilityHandler, useValue: checkAvailability },
      ],
    }).compile();

    handler = module.get<GetPublicAvailabilityDaysHandler>(GetPublicAvailabilityDaysHandler);
  });

  it('returns [] when employee is not public/active', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ employeeId: 'emp-1' })).resolves.toEqual([]);
    expect(checkAvailability.execute).not.toHaveBeenCalled();
  });

  it('returns [] when branch link is missing and none provided', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    prisma.employeeBranch.findFirst.mockResolvedValue(null);
    prisma.employeeService.findFirst.mockResolvedValue({ serviceId: 'svc-1' });
    await expect(handler.execute({ employeeId: 'emp-1' })).resolves.toEqual([]);
  });

  it('returns [] when service link is missing and none provided', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    prisma.employeeBranch.findFirst.mockResolvedValue({ branchId: 'branch-1' });
    prisma.employeeService.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ employeeId: 'emp-1' })).resolves.toEqual([]);
  });

  it('passes silentOnMissingConfig and resolved ids to each probe', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    checkAvailability.execute!.mockResolvedValue([]);

    await handler.execute({
      employeeId: 'emp-1',
      branchId: 'branch-1',
      serviceId: 'svc-1',
      startDate: '2026-03-10',
      days: 2,
    });

    expect(checkAvailability.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'emp-1',
        branchId: 'branch-1',
        serviceId: 'svc-1',
        silentOnMissingConfig: true,
      }),
    );
  });

  // The core perf change: the strip used to await each day sequentially; it now
  // fans the probes out with Promise.all. This test pins the contract that the
  // parallel version produces EXACTLY the same ordered output as a sequential
  // run would for a multi-day window — one entry per day, in ascending date
  // order, with hasSlots derived from that day's slot count.
  it('produces the same ordered result as a sequential run for a multi-day window', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });

    // Per-day slot fixtures keyed by the probed calendar date. Day 0 and day 2
    // have openings; day 1 and day 3 do not — an alternating pattern so a
    // mis-ordered result would be caught.
    const slotsByDate: Record<string, unknown[]> = {
      '2026-03-10': [{ startTime: new Date(), endTime: new Date() }],
      '2026-03-11': [],
      '2026-03-12': [{ startTime: new Date(), endTime: new Date() }],
      '2026-03-13': [],
    };

    checkAvailability.execute!.mockImplementation(async ({ date }: any) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return slotsByDate[`${y}-${m}-${d}`] as any;
    });

    const result = await handler.execute({
      employeeId: 'emp-1',
      branchId: 'branch-1',
      serviceId: 'svc-1',
      startDate: '2026-03-10',
      days: 4,
    });

    expect(result).toEqual([
      { date: '2026-03-10', hasSlots: true },
      { date: '2026-03-11', hasSlots: false },
      { date: '2026-03-12', hasSlots: true },
      { date: '2026-03-13', hasSlots: false },
    ]);
    expect(checkAvailability.execute).toHaveBeenCalledTimes(4);
  });

  // Resolving constants (employee/branch/service) happens once before the loop,
  // not per day — guard against a regression that re-resolves them N times.
  it('resolves branch and service links once, not per day', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    prisma.employeeBranch.findFirst.mockResolvedValue({ branchId: 'branch-1' });
    prisma.employeeService.findFirst.mockResolvedValue({ serviceId: 'svc-1' });
    checkAvailability.execute!.mockResolvedValue([]);

    await handler.execute({ employeeId: 'emp-1', startDate: '2026-03-10', days: 5 });

    expect(prisma.employee.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.employeeBranch.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.employeeService.findFirst).toHaveBeenCalledTimes(1);
    expect(checkAvailability.execute).toHaveBeenCalledTimes(5);
  });

  // The probes must run concurrently, not serialized. Track in-flight count and
  // assert the peak exceeds 1 (sequential would never overlap).
  it('runs the per-day probes concurrently', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });

    let inFlight = 0;
    let peakInFlight = 0;
    checkAvailability.execute!.mockImplementation(async () => {
      inFlight += 1;
      peakInFlight = Math.max(peakInFlight, inFlight);
      await new Promise((resolve) => setImmediate(resolve));
      inFlight -= 1;
      return [];
    });

    await handler.execute({
      employeeId: 'emp-1',
      branchId: 'branch-1',
      serviceId: 'svc-1',
      startDate: '2026-03-10',
      days: 3,
    });

    expect(peakInFlight).toBeGreaterThan(1);
  });
});
