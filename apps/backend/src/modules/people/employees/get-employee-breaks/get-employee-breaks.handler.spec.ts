import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GetEmployeeBreaksHandler } from './get-employee-breaks.handler';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

describe('GetEmployeeBreaksHandler', () => {
  let handler: GetEmployeeBreaksHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn() },
      employeeBreak: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetEmployeeBreaksHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(GetEmployeeBreaksHandler);
  });

  it('throws NotFoundException when employee does not exist', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ employeeId: 'emp-1' })).rejects.toThrow(NotFoundException);
  });

  it('returns empty breaks array when no breaks configured', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', organizationId: 'org-1' });
    prisma.employeeBreak.findMany.mockResolvedValue([]);

    const result = await handler.execute({ employeeId: 'emp-1' });

    expect(result).toEqual({ breaks: [] });
  });

  it('returns breaks ordered by dayOfWeek then startTime', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', organizationId: 'org-1' });
    const breaks = [
      { id: 'b1', dayOfWeek: 1, startTime: '10:00', endTime: '10:30' },
      { id: 'b2', dayOfWeek: 1, startTime: '15:00', endTime: '15:15' },
      { id: 'b3', dayOfWeek: 3, startTime: '12:00', endTime: '13:00' },
    ];
    prisma.employeeBreak.findMany.mockResolvedValue(breaks);

    const result = await handler.execute({ employeeId: 'emp-1' });

    expect(result).toEqual({ breaks });
    expect(prisma.employeeBreak.findMany).toHaveBeenCalledWith({
      where: { employeeId: 'emp-1' },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  });
});
