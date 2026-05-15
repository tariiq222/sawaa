import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ListPublicBranchEmployeesHandler } from './list-public-branch-employees.handler';
import { PrismaService } from '../../../../infrastructure/database';

describe('ListPublicBranchEmployeesHandler', () => {
  let handler: ListPublicBranchEmployeesHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      branch: { findFirst: jest.fn() },
      employeeBranch: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ListPublicBranchEmployeesHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();

    handler = module.get<ListPublicBranchEmployeesHandler>(ListPublicBranchEmployeesHandler);
  });

  it('should throw NotFoundException when branch not found', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);
    await expect(handler.execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('should return only public active employees', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
    prisma.employeeBranch.findMany.mockResolvedValue([
      { employee: { id: 'e1', slug: 'dr-ahmed', nameAr: 'أحمد', nameEn: 'Ahmed', title: 'Dr', specialty: 'Cardio', specialtyAr: 'قلب', publicBioAr: 'bio', publicBioEn: 'bio en', publicImageUrl: 'url', isPublic: true, isActive: true } },
      { employee: { id: 'e2', slug: null, nameAr: null, nameEn: 'Hidden', title: null, specialty: null, specialtyAr: null, publicBioAr: null, publicBioEn: null, publicImageUrl: null, isPublic: false, isActive: true } },
      { employee: { id: 'e3', slug: null, nameAr: null, nameEn: 'Inactive', title: null, specialty: null, specialtyAr: null, publicBioAr: null, publicBioEn: null, publicImageUrl: null, isPublic: true, isActive: false } },
    ]);

    const result = await handler.execute('branch-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e1');
    expect(result[0]).not.toHaveProperty('isPublic');
    expect(result[0]).not.toHaveProperty('isActive');
  });
});
