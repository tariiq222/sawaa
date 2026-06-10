import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { GetMainBranchHandler } from './get-main-branch.handler';

describe('GetMainBranchHandler', () => {
  let handler: GetMainBranchHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetMainBranchHandler,
        { provide: PrismaService, useValue: {
    branch: { findFirst: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<GetMainBranchHandler>(GetMainBranchHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('returns the main branch when one exists', async () => {
    const branch = { id: 'branch-1', isMain: true };
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue(branch);

    const result = await handler.execute();

    expect(prisma.branch.findFirst).toHaveBeenCalledWith({ where: { isMain: true } });
    expect(result).toBe(branch);
  });

  it('throws NotFoundException when no main branch is configured', async () => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(handler.execute()).rejects.toThrow(NotFoundException);
    await expect(handler.execute()).rejects.toThrow('No main branch configured');
  });
});
