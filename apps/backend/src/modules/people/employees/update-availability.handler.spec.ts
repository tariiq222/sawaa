import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UpdateAvailabilityHandler } from './update-availability.handler';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RlsTransactionService } from '../../../infrastructure/database';

const makeCmd = (overrides = {}) => ({
  employeeId: 'emp-1',
  windows: [
    { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
    { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
  ],
  exceptions: [],
  ...overrides,
});

describe('UpdateAvailabilityHandler', () => {
  let handler: UpdateAvailabilityHandler;
   
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn() },
      employeeAvailability: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
      employeeAvailabilityException: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateAvailabilityHandler,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RlsTransactionService,
          useValue: {
            withTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
            withBypassTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
          },
        },
      ],
    }).compile();

    handler = module.get(UpdateAvailabilityHandler);
  });

  it('throws NotFoundException when employee does not exist', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(handler.execute(makeCmd())).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for invalid dayOfWeek', async () => {
    await expect(handler.execute(makeCmd({ windows: [{ dayOfWeek: 7, startTime: '09:00', endTime: '17:00' }] }))).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when startTime is not before endTime', async () => {
    await expect(handler.execute(makeCmd({ windows: [{ dayOfWeek: 1, startTime: '17:00', endTime: '09:00' }] }))).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for duplicate dayOfWeek', async () => {
    await expect(
      handler.execute(makeCmd({ windows: [{ dayOfWeek: 1, startTime: '09:00', endTime: '12:00' }, { dayOfWeek: 1, startTime: '13:00', endTime: '17:00' }] })),
    ).rejects.toThrow(BadRequestException);
  });

  it('deletes existing windows and creates new ones', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', organizationId: 'org-test' });
    prisma.employeeAvailability.deleteMany.mockResolvedValue({ count: 3 });
    prisma.employeeAvailability.createMany.mockResolvedValue({ count: 2 });
    const windowRows = [
      { id: 'w1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      { id: 'w2', dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
    ];
    prisma.employeeAvailability.findMany.mockResolvedValue(windowRows);
    prisma.employeeAvailabilityException.deleteMany.mockResolvedValue({ count: 0 });
    prisma.employeeAvailabilityException.findMany.mockResolvedValue([]);

    const result = await handler.execute(makeCmd());

    expect(prisma.employeeAvailability.deleteMany).toHaveBeenCalledWith({
      where: { employeeId: 'emp-1' },
    });
    expect(prisma.employeeAvailability.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ dayOfWeek: 1, employeeId: 'emp-1', organizationId: 'org-test' }),
      ]),
    });
    expect(result.windows).toEqual(windowRows);
    expect(result.exceptions).toEqual([]);
  });

  it('deletes and recreates exceptions when provided', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', organizationId: 'org-test' });
    prisma.employeeAvailability.deleteMany.mockResolvedValue({ count: 0 });
    prisma.employeeAvailability.createMany.mockResolvedValue({ count: 0 });
    prisma.employeeAvailability.findMany.mockResolvedValue([]);
    prisma.employeeAvailabilityException.deleteMany.mockResolvedValue({ count: 0 });
    prisma.employeeAvailabilityException.createMany.mockResolvedValue({ count: 1 });
    const exceptionRow = { id: 'ex-1', startDate: new Date('2026-04-15'), endDate: new Date('2026-04-15'), reason: 'holiday' };
    prisma.employeeAvailabilityException.findMany.mockResolvedValue([exceptionRow]);

    const result = await handler.execute(
      makeCmd({
        windows: [],
        exceptions: [{ startDate: '2026-04-15', endDate: '2026-04-15', reason: 'holiday' }],
      }),
    );

    expect(prisma.employeeAvailabilityException.deleteMany).toHaveBeenCalledWith({ where: { employeeId: 'emp-1' } });
    expect(prisma.employeeAvailabilityException.createMany).toHaveBeenCalledTimes(1);
    expect(result.exceptions).toEqual([exceptionRow]);
  });

  it('handles empty exceptions array without calling createMany', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', organizationId: 'org-test' });
    prisma.employeeAvailability.deleteMany.mockResolvedValue({ count: 0 });
    prisma.employeeAvailability.createMany.mockResolvedValue({ count: 0 });
    prisma.employeeAvailability.findMany.mockResolvedValue([]);
    prisma.employeeAvailabilityException.deleteMany.mockResolvedValue({ count: 0 });
    prisma.employeeAvailabilityException.findMany.mockResolvedValue([]);

    await handler.execute(makeCmd({ windows: [], exceptions: [] }));

    expect(prisma.employeeAvailabilityException.createMany).not.toHaveBeenCalled();
  });
});
