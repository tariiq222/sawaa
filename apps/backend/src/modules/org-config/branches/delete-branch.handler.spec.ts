import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DeleteBranchHandler } from './delete-branch.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('DeleteBranchHandler', () => {
  let handler: DeleteBranchHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      branch: { findFirst: jest.fn(), delete: jest.fn() },
      employeeBranch: { count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [DeleteBranchHandler, { provide: PrismaService, useValue: prisma }],
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

  it('should delete branch when no employees assigned', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prisma.employeeBranch.count.mockResolvedValue(0);
    prisma.branch.delete.mockResolvedValue({ id: 'b1' });

    const result = await handler.execute({ branchId: 'b1' });
    expect(prisma.branch.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
    expect(result.id).toBe('b1');
  });
});
