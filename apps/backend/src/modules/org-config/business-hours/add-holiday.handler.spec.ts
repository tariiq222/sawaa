import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { AddHolidayHandler } from './add-holiday.handler';

describe('AddHolidayHandler', () => {
  let handler: AddHolidayHandler;
  let prisma: { branch: { findFirst: jest.Mock }; holiday: { findUnique: jest.Mock; create: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      branch: { findFirst: jest.fn() },
      holiday: { findUnique: jest.fn(), create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddHolidayHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<AddHolidayHandler>(AddHolidayHandler);
  });

  it('throws NotFoundException when the branch does not exist', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute({
        branchId: '00000000-0000-0000-0000-000000000001',
        date: '2026-05-14T00:00:00Z',
        nameAr: 'يوم',
        nameEn: 'Day',
      } as never),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.holiday.create).not.toHaveBeenCalled();
  });

  it('rejects when a holiday already exists for the same (branchId, date)', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b-1' });
    prisma.holiday.findUnique.mockResolvedValue({ id: 'h-existing' });

    const date = '2026-05-14T00:00:00Z';
    await expect(
      handler.execute({ branchId: 'b-1', date, nameAr: 'x', nameEn: 'y' } as never),
    ).rejects.toThrow(ConflictException);
    expect(prisma.holiday.create).not.toHaveBeenCalled();
  });

  it('uses the (branchId, date) compound key for the unique check', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b-1' });
    prisma.holiday.findUnique.mockResolvedValue({ id: 'h-existing' });

    const date = '2026-05-14T00:00:00Z';
    await expect(
      handler.execute({ branchId: 'b-1', date, nameAr: 'x', nameEn: 'y' } as never),
    ).rejects.toThrow(ConflictException);
    expect(prisma.holiday.findUnique).toHaveBeenCalledWith({
      where: { branchId_date: { branchId: 'b-1', date: new Date(date) } },
    });
  });

  it('creates the holiday when no conflict exists', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b-1' });
    prisma.holiday.findUnique.mockResolvedValue(null);
    prisma.holiday.create.mockResolvedValue({ id: 'h-new' });

    const date = '2026-05-14T00:00:00Z';
    await handler.execute({ branchId: 'b-1', date, nameAr: 'يوم', nameEn: 'Day' } as never);

    expect(prisma.holiday.create).toHaveBeenCalledWith({
      data: {
        branchId: 'b-1',
        date: new Date(date),
        nameAr: 'يوم',
        nameEn: 'Day',
      },
    });
  });
});