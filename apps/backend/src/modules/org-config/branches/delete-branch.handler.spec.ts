import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DeleteBranchHandler } from './delete-branch.handler';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';

describe('DeleteBranchHandler', () => {
  let handler: DeleteBranchHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      branch: { findFirst: jest.fn(), delete: jest.fn() },
      employeeBranch: { count: jest.fn() },
      booking: { count: jest.fn().mockResolvedValue(0) },
      waitlistEntry: { count: jest.fn().mockResolvedValue(0) },
      groupSession: { count: jest.fn().mockResolvedValue(0) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteBranchHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: { getOrSet: (_k: string, l: () => Promise<unknown>) => l(), invalidatePrefix: jest.fn() } },
      ],
    }).compile();

    handler = module.get<DeleteBranchHandler>(DeleteBranchHandler);
  });

  it('should throw NotFoundException when branch not found', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ branchId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('should throw ConflictException when employees assigned', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prisma.employeeBranch.count.mockResolvedValue(2);
    await expect(handler.execute({ branchId: 'b1' })).rejects.toThrow(ConflictException);
  });

  it('should throw ConflictException when bookings reference the branch', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prisma.employeeBranch.count.mockResolvedValue(0);
    prisma.booking.count.mockResolvedValue(3);
    await expect(handler.execute({ branchId: 'b1' })).rejects.toThrow(ConflictException);
    expect(prisma.branch.delete).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when a waitlist entry or group session references the branch', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prisma.employeeBranch.count.mockResolvedValue(0);
    prisma.waitlistEntry.count.mockResolvedValue(1);
    await expect(handler.execute({ branchId: 'b1' })).rejects.toThrow(ConflictException);
    expect(prisma.branch.delete).not.toHaveBeenCalled();
  });

  it('should delete branch when nothing references it', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prisma.employeeBranch.count.mockResolvedValue(0);
    prisma.branch.delete.mockResolvedValue({ id: 'b1' });

    const result = await handler.execute({ branchId: 'b1' });
    expect(prisma.branch.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
    expect(result.id).toBe('b1');
  });
});
