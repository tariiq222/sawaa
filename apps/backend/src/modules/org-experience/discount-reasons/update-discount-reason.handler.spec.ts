import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UpdateDiscountReasonHandler } from './update-discount-reason.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('UpdateDiscountReasonHandler', () => {
  let handler: UpdateDiscountReasonHandler;
  let prisma: {
    discountReason: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      discountReason: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        UpdateDiscountReasonHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = module.get(UpdateDiscountReasonHandler);
  });

  const dto = { id: 'r1', labelAr: 'سبب محدّث', labelEn: 'updated' } as Parameters<typeof handler.execute>[0];

  it('throws NotFoundException when reason is missing', async () => {
    prisma.discountReason.findUnique.mockResolvedValue(null);
    await expect(handler.execute(dto)).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when another reason owns the new labelAr', async () => {
    prisma.discountReason.findUnique.mockResolvedValue({ id: 'r1' });
    prisma.discountReason.findFirst.mockResolvedValue({ id: 'other' });
    await expect(handler.execute(dto)).rejects.toThrow(ConflictException);
  });

  it('updates the reason and returns the new row', async () => {
    prisma.discountReason.findUnique.mockResolvedValue({ id: 'r1' });
    prisma.discountReason.findFirst.mockResolvedValue(null);
    prisma.discountReason.update.mockResolvedValue({ id: 'r1', labelAr: 'سبب محدّث' });
    const result = await handler.execute(dto);
    expect(result).toEqual({ id: 'r1', labelAr: 'سبب محدّث' });
  });
});