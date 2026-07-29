import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DeleteDiscountReasonHandler } from './delete-discount-reason.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('DeleteDiscountReasonHandler', () => {
  let handler: DeleteDiscountReasonHandler;
  let prisma: {
    discountReason: { findUnique: jest.Mock; delete: jest.Mock };
    invoice: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      discountReason: { findUnique: jest.fn(), delete: jest.fn() },
      invoice: { findFirst: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        DeleteDiscountReasonHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = module.get(DeleteDiscountReasonHandler);
  });

  it('throws NotFoundException when reason is missing', async () => {
    prisma.discountReason.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ id: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when reason is referenced by invoices', async () => {
    prisma.discountReason.findUnique.mockResolvedValue({ id: 'r1' });
    prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1' });
    await expect(handler.execute({ id: 'r1' })).rejects.toThrow(ConflictException);
  });

  it('deletes the reason when unreferenced', async () => {
    prisma.discountReason.findUnique.mockResolvedValue({ id: 'r1' });
    prisma.invoice.findFirst.mockResolvedValue(null);
    prisma.discountReason.delete.mockResolvedValue({ id: 'r1' });
    const result = await handler.execute({ id: 'r1' });
    expect(result).toEqual({ id: 'r1' });
    expect(prisma.discountReason.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });
});