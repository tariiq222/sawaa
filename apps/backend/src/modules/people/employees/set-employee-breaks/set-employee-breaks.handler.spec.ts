import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SetEmployeeBreaksHandler } from './set-employee-breaks.handler';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { RlsTransactionService } from '../../../../infrastructure/database';

const EMPLOYEE = { id: 'emp-1', organizationId: 'org-1' };

const SHIFT_MON = { employeeId: 'emp-1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true };

const makeCmd = (overrides = {}) => ({
  employeeId: 'emp-1',
  breaks: [{ dayOfWeek: 1, startTime: '12:00', endTime: '13:00' }],
  ...overrides,
});

describe('SetEmployeeBreaksHandler', () => {
  let handler: SetEmployeeBreaksHandler;
   
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn() },
      employeeAvailability: { findMany: jest.fn() },
      employeeBreak: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetEmployeeBreaksHandler,
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

    handler = module.get(SetEmployeeBreaksHandler);
  });

  it('throws NotFoundException when employee does not exist', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(handler.execute(makeCmd())).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when startTime >= endTime', async () => {
    prisma.employee.findFirst.mockResolvedValue(EMPLOYEE);
    await expect(
      handler.execute(makeCmd({ breaks: [{ dayOfWeek: 1, startTime: '13:00', endTime: '12:00' }] })),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when no shift exists for the break day', async () => {
    prisma.employee.findFirst.mockResolvedValue(EMPLOYEE);
    prisma.employeeAvailability.findMany.mockResolvedValue([]);
    await expect(handler.execute(makeCmd())).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when break falls outside every shift for that day', async () => {
    prisma.employee.findFirst.mockResolvedValue(EMPLOYEE);
    prisma.employeeAvailability.findMany.mockResolvedValue([
      { ...SHIFT_MON, startTime: '09:00', endTime: '12:00' },
    ]);
    await expect(
      handler.execute(makeCmd({ breaks: [{ dayOfWeek: 1, startTime: '11:30', endTime: '13:00' }] })),
    ).rejects.toThrow(BadRequestException);
  });

  it('replaces all breaks and returns newly created rows', async () => {
    prisma.employee.findFirst.mockResolvedValue(EMPLOYEE);
    prisma.employeeAvailability.findMany.mockResolvedValue([SHIFT_MON]);
    prisma.employeeBreak.deleteMany.mockResolvedValue({ count: 2 });
    prisma.employeeBreak.createMany.mockResolvedValue({ count: 1 });
    const created = [{ id: 'br-1', dayOfWeek: 1, startTime: '12:00', endTime: '13:00', employeeId: 'emp-1' }];
    prisma.employeeBreak.findMany.mockResolvedValue(created);

    const result = await handler.execute(makeCmd());

    expect(prisma.employeeBreak.deleteMany).toHaveBeenCalledWith({ where: { employeeId: 'emp-1' } });
    expect(prisma.employeeBreak.createMany).toHaveBeenCalledWith({
      data: [{ employeeId: 'emp-1', dayOfWeek: 1, startTime: '12:00', endTime: '13:00' }],
    });
    expect(result).toEqual({ breaks: created });
  });

  it('accepts a break that fits inside a split shift', async () => {
    prisma.employee.findFirst.mockResolvedValue(EMPLOYEE);
    prisma.employeeAvailability.findMany.mockResolvedValue([
      { ...SHIFT_MON, startTime: '09:00', endTime: '12:00' },
      { ...SHIFT_MON, startTime: '14:00', endTime: '18:00' },
    ]);
    prisma.employeeBreak.deleteMany.mockResolvedValue({ count: 0 });
    prisma.employeeBreak.createMany.mockResolvedValue({ count: 1 });
    const created = [{ id: 'br-2', dayOfWeek: 1, startTime: '10:00', endTime: '10:30' }];
    prisma.employeeBreak.findMany.mockResolvedValue(created);

    const result = await handler.execute(
      makeCmd({ breaks: [{ dayOfWeek: 1, startTime: '10:00', endTime: '10:30' }] }),
    );

    expect(result).toEqual({ breaks: created });
  });

  it('clears all breaks when empty array is provided', async () => {
    prisma.employee.findFirst.mockResolvedValue(EMPLOYEE);
    prisma.employeeBreak.deleteMany.mockResolvedValue({ count: 3 });
    prisma.employeeBreak.createMany.mockResolvedValue({ count: 0 });
    prisma.employeeBreak.findMany.mockResolvedValue([]);

    const result = await handler.execute(makeCmd({ breaks: [] }));

    expect(prisma.employeeBreak.deleteMany).toHaveBeenCalledWith({ where: { employeeId: 'emp-1' } });
    expect(prisma.employeeBreak.createMany).not.toHaveBeenCalled();
    expect(result).toEqual({ breaks: [] });
  });
});
