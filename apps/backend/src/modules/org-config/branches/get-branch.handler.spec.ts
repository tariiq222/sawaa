import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetBranchHandler } from './get-branch.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('GetBranchHandler', () => {
  let handler: GetBranchHandler;
  let prisma: { branch: { findFirst: jest.Mock } };

  beforeEach(async () => {
    prisma = { branch: { findFirst: jest.fn() } };
    const module = await Test.createTestingModule({
      providers: [GetBranchHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();
    handler = module.get(GetBranchHandler);
  });

  it('throws NotFoundException when branch is missing', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ branchId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('returns the branch with businessHours and holidays', async () => {
    const branch = {
      id: 'b1',
      nameAr: 'فرع',
      businessHours: [{ dayOfWeek: 0, openTime: '09:00' }],
      holidays: [],
    };
    prisma.branch.findFirst.mockResolvedValue(branch);
    const result = await handler.execute({ branchId: 'b1' });
    expect(result).toBe(branch);
    expect(prisma.branch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b1' },
        include: expect.objectContaining({
          businessHours: expect.objectContaining({ orderBy: { dayOfWeek: 'asc' } }),
          holidays: expect.objectContaining({ orderBy: { date: 'asc' } }),
        }),
      }),
    );
  });
});