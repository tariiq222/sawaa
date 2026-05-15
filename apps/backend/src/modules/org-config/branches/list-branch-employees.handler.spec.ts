import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ListBranchEmployeesHandler } from './list-branch-employees.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('ListBranchEmployeesHandler', () => {
  let handler: ListBranchEmployeesHandler;
  let prisma: { branch: { findFirst: jest.Mock }; employeeBranch: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      branch: { findFirst: jest.fn() },
      employeeBranch: { findMany: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        ListBranchEmployeesHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(ListBranchEmployeesHandler);
  });

  it('throws when branch not found', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ branchId: 'b1' })).rejects.toThrow(NotFoundException);
  });

  it('returns mapped employees', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prisma.employeeBranch.findMany.mockResolvedValue([
      {
        id: 'l1',
        employeeId: 'e1',
        branchId: 'b1',
        employee: {
          id: 'e1',
          name: 'Ali',
          nameAr: 'علي',
          nameEn: 'Ali En',
          email: 'ali@test.com',
          specialty: 'Dentist',
          specialtyAr: 'طبيب أسنان',
          isActive: true,
        },
      },
      {
        id: 'l2',
        employeeId: 'e2',
        branchId: 'b1',
        employee: {
          id: 'e2',
          name: 'Sara',
          nameAr: null,
          nameEn: null,
          email: 'sara@test.com',
          specialty: null,
          specialtyAr: null,
          isActive: false,
        },
      },
    ]);
    const result = await handler.execute({ branchId: 'b1' });
    expect(result).toHaveLength(2);
    expect(result[0].employee.name).toBe('علي');
    expect(result[0].employee.nameEn).toBe('Ali En');
    expect(result[1].employee.name).toBe('Sara');
    expect(result[1].employee.nameEn).toBe('Sara');
  });
});
