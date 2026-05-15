import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { UnassignEmployeeFromBranchHandler } from './unassign-employee-from-branch.handler';

describe('UnassignEmployeeFromBranchHandler', () => {
  let handler: UnassignEmployeeFromBranchHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnassignEmployeeFromBranchHandler,
        { provide: PrismaService, useValue: {
          branch: { findFirst: jest.fn() },
          employeeBranch: { findFirst: jest.fn(), delete: jest.fn() },
        } },
      ],
    }).compile();

    handler = module.get<UnassignEmployeeFromBranchHandler>(UnassignEmployeeFromBranchHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should unassign', async () => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue({ id: 'branch' });
    (prisma.employeeBranch.findFirst as jest.Mock).mockResolvedValue({ id: 'link' });
    (prisma.employeeBranch.delete as jest.Mock).mockResolvedValue({ id: 'link' });
    await handler.execute({ branchId: 'branch', employeeId: 'emp' });
    expect(prisma.employeeBranch.delete).toHaveBeenCalled();
  });

  it('should throw when branch not found', async () => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({ branchId: 'branch', employeeId: 'emp' })).rejects.toThrow();
  });

  it('should throw when assignment not found', async () => {
    (prisma.branch.findFirst as jest.Mock).mockResolvedValue({ id: 'branch' });
    (prisma.employeeBranch.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({ branchId: 'branch', employeeId: 'emp' })).rejects.toThrow();
  });
});
