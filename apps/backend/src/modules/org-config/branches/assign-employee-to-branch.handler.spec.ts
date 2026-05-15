import { Test } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AssignEmployeeToBranchHandler } from './assign-employee-to-branch.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('AssignEmployeeToBranchHandler', () => {
  let handler: AssignEmployeeToBranchHandler;
  let prisma: { branch: { findFirst: jest.Mock }; employee: { findFirst: jest.Mock }; employeeBranch: { create: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      branch: { findFirst: jest.fn() },
      employee: { findFirst: jest.fn() },
      employeeBranch: { create: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        AssignEmployeeToBranchHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(AssignEmployeeToBranchHandler);
  });

  const dto = { branchId: 'b1', employeeId: 'e1' };

  it('throws when branch not found', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1' });
    await expect(handler.execute(dto)).rejects.toThrow(NotFoundException);
  });

  it('throws when employee not found', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(handler.execute(dto)).rejects.toThrow(NotFoundException);
  });

  it('creates assignment successfully', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1' });
    prisma.employeeBranch.create.mockResolvedValue({ branchId: 'b1', employeeId: 'e1' });
    const result = await handler.execute(dto);
    expect(result.branchId).toBe('b1');
  });

  it('throws ConflictException on duplicate', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1' });
    const error = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '1' });
    prisma.employeeBranch.create.mockRejectedValue(error);
    await expect(handler.execute(dto)).rejects.toThrow(ConflictException);
  });

  it('re-throws non-duplicate errors', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1' });
    prisma.employeeBranch.create.mockRejectedValue(new Error('DB down'));
    await expect(handler.execute(dto)).rejects.toThrow('DB down');
  });
});
