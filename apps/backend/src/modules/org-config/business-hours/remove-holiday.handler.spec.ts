import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { RemoveHolidayHandler } from './remove-holiday.handler';

describe('RemoveHolidayHandler', () => {
  let handler: RemoveHolidayHandler;
  let prisma: { holiday: { findFirst: jest.Mock; delete: jest.Mock } };

  beforeEach(async () => {
    prisma = { holiday: { findFirst: jest.fn(), delete: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoveHolidayHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<RemoveHolidayHandler>(RemoveHolidayHandler);
  });

  it('throws NotFoundException when the holiday does not exist', async () => {
    prisma.holiday.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute({ holidayId: '00000000-0000-0000-0000-000000000001' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.holiday.delete).not.toHaveBeenCalled();
  });

  it('deletes the holiday by id and returns { deleted: true }', async () => {
    prisma.holiday.findFirst.mockResolvedValue({ id: 'h-1' });
    prisma.holiday.delete.mockResolvedValue({ id: 'h-1' });

    const result = await handler.execute({ holidayId: 'h-1' });

    expect(prisma.holiday.delete).toHaveBeenCalledWith({ where: { id: 'h-1' } });
    expect(result).toEqual({ deleted: true });
  });
});