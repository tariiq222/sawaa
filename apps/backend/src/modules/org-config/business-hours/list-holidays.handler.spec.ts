import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListHolidaysHandler } from './list-holidays.handler';

describe('ListHolidaysHandler', () => {
  let handler: ListHolidaysHandler;
  let prisma: { branch: { findFirst: jest.Mock }; holiday: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      branch: { findFirst: jest.fn() },
      holiday: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListHolidaysHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<ListHolidaysHandler>(ListHolidaysHandler);
  });

  it('throws NotFoundException when the branch does not exist', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ branchId: 'b-1' })).rejects.toThrow(NotFoundException);
    expect(prisma.holiday.findMany).not.toHaveBeenCalled();
  });

  it('queries the full year range when year is provided', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b-1' });
    prisma.holiday.findMany.mockResolvedValue([]);

    await handler.execute({ branchId: 'b-1', year: 2026 });

    expect(prisma.holiday.findMany).toHaveBeenCalledWith({
      where: {
        branchId: 'b-1',
        date: {
          gte: new Date('2026-01-01'),
          lte: new Date('2026-12-31'),
        },
      },
      orderBy: { date: 'asc' },
    });
  });

  it('omits the date filter when year is undefined', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b-1' });
    prisma.holiday.findMany.mockResolvedValue([]);

    await handler.execute({ branchId: 'b-1' });

    expect(prisma.holiday.findMany).toHaveBeenCalledWith({
      where: { branchId: 'b-1' },
      orderBy: { date: 'asc' },
    });
  });
});