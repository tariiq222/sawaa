import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CreateDiscountReasonHandler } from './create-discount-reason.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('CreateDiscountReasonHandler', () => {
  let handler: CreateDiscountReasonHandler;
  let prisma: { discountReason: { findFirst: jest.Mock; create: jest.Mock } };

  beforeEach(async () => {
    prisma = { discountReason: { findFirst: jest.fn(), create: jest.fn() } };
    const module = await Test.createTestingModule({
      providers: [
        CreateDiscountReasonHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = module.get(CreateDiscountReasonHandler);
  });

  const dto = {
    labelAr: 'عميل مميز',
    labelEn: 'VIP client',
    isActive: true,
    sortOrder: 1,
  };

  it('throws ConflictException when labelAr already exists', async () => {
    prisma.discountReason.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(handler.execute(dto)).rejects.toThrow(ConflictException);
  });

  it('creates the discount reason with defaults applied', async () => {
    prisma.discountReason.findFirst.mockResolvedValue(null);
    prisma.discountReason.create.mockResolvedValue({ id: 'r1', ...dto });
    const result = await handler.execute(dto);
    expect(result.id).toBe('r1');
    expect(prisma.discountReason.create).toHaveBeenCalledWith({
      data: {
        labelAr: 'عميل مميز',
        labelEn: 'VIP client',
        isActive: true,
        sortOrder: 1,
      },
    });
  });

  it('applies default isActive=true and sortOrder=0 when omitted', async () => {
    prisma.discountReason.findFirst.mockResolvedValue(null);
    prisma.discountReason.create.mockResolvedValue({ id: 'r2' });
    await handler.execute({ labelAr: 'خصم آخر' } as Parameters<typeof handler.execute>[0]);
    expect(prisma.discountReason.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isActive: true, sortOrder: 0 }),
    });
  });
});