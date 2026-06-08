import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListDiscountReasonsHandler } from './list-discount-reasons.handler';
import { CreateDiscountReasonHandler } from './create-discount-reason.handler';
import { UpdateDiscountReasonHandler } from './update-discount-reason.handler';
import { DeleteDiscountReasonHandler } from './delete-discount-reason.handler';

type PrismaMock = {
  discountReason: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  invoice: { findFirst: jest.Mock };
};

describe('DiscountReason handlers', () => {
  let list: ListDiscountReasonsHandler;
  let create: CreateDiscountReasonHandler;
  let update: UpdateDiscountReasonHandler;
  let del: DeleteDiscountReasonHandler;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = {
      discountReason: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      invoice: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListDiscountReasonsHandler,
        CreateDiscountReasonHandler,
        UpdateDiscountReasonHandler,
        DeleteDiscountReasonHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    list = module.get(ListDiscountReasonsHandler);
    create = module.get(CreateDiscountReasonHandler);
    update = module.get(UpdateDiscountReasonHandler);
    del = module.get(DeleteDiscountReasonHandler);
  });

  describe('list', () => {
    it('returns only active reasons by default', async () => {
      prisma.discountReason.findMany.mockResolvedValue([]);
      await list.execute();
      expect(prisma.discountReason.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('includes inactive reasons when requested', async () => {
      prisma.discountReason.findMany.mockResolvedValue([]);
      await list.execute({ includeInactive: true });
      expect(prisma.discountReason.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });

  describe('create', () => {
    it('creates a reason with defaults', async () => {
      prisma.discountReason.findFirst.mockResolvedValue(null);
      prisma.discountReason.create.mockResolvedValue({ id: 'r1' });
      await create.execute({ labelAr: 'خصم خاص' });
      expect(prisma.discountReason.create).toHaveBeenCalledWith({
        data: { labelAr: 'خصم خاص', labelEn: null, isActive: true, sortOrder: 0 },
      });
    });

    it('rejects duplicate Arabic label', async () => {
      prisma.discountReason.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(create.execute({ labelAr: 'خصم خاص' })).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('throws 404 when reason missing', async () => {
      prisma.discountReason.findUnique.mockResolvedValue(null);
      await expect(update.execute({ id: 'x', isActive: false })).rejects.toThrow(NotFoundException);
    });

    it('rejects renaming onto another reason label', async () => {
      prisma.discountReason.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.discountReason.findFirst.mockResolvedValue({ id: 'r2' });
      await expect(update.execute({ id: 'r1', labelAr: 'مكرر' })).rejects.toThrow(ConflictException);
    });

    it('applies partial updates', async () => {
      prisma.discountReason.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.discountReason.update.mockResolvedValue({ id: 'r1', isActive: false });
      await update.execute({ id: 'r1', isActive: false });
      expect(prisma.discountReason.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { isActive: false },
      });
    });
  });

  describe('delete', () => {
    it('throws 404 when reason missing', async () => {
      prisma.discountReason.findUnique.mockResolvedValue(null);
      await expect(del.execute({ id: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('blocks deletion when referenced by an invoice', async () => {
      prisma.discountReason.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.invoice.findFirst.mockResolvedValue({ id: 'inv1' });
      await expect(del.execute({ id: 'r1' })).rejects.toThrow(ConflictException);
      expect(prisma.discountReason.delete).not.toHaveBeenCalled();
    });

    it('deletes an unreferenced reason', async () => {
      prisma.discountReason.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.invoice.findFirst.mockResolvedValue(null);
      prisma.discountReason.delete.mockResolvedValue({ id: 'r1' });
      await expect(del.execute({ id: 'r1' })).resolves.toEqual({ id: 'r1' });
    });
  });
});
