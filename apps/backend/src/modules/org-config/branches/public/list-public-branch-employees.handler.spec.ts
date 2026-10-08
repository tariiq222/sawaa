import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ListPublicBranchEmployeesHandler } from './list-public-branch-employees.handler';
import { PrismaService } from '../../../../infrastructure/database';
import { OwnedImageResolver } from '../../../media/owned-image.resolver';

describe('ListPublicBranchEmployeesHandler', () => {
  let handler: ListPublicBranchEmployeesHandler;
  let prisma: any;
  let images: { resolve: jest.Mock };

  beforeEach(async () => {
    prisma = {
      branch: { findFirst: jest.fn() },
      employeeBranch: { findMany: jest.fn() },
    };

    images = { resolve: jest.fn(async (_type: string, _id: string, value: string | null) => value) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListPublicBranchEmployeesHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: OwnedImageResolver, useValue: images },
      ],
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

  it('resolves public images through the owned employee image resolver', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'branch-1' });
    prisma.employeeBranch.findMany.mockResolvedValue([
      { employee: { id: 'e1', slug: null, nameAr: null, nameEn: 'A', title: null, specialty: null, specialtyAr: null, publicBioAr: null, publicBioEn: null, publicImageUrl: 'org/key.webp', isPublic: true, isActive: true } },
    ]);
    images.resolve.mockResolvedValueOnce('https://signed.example/key.webp');

    const result = await handler.execute('branch-1');
    expect(images.resolve).toHaveBeenCalledWith('employee', 'e1', 'org/key.webp');
    expect(result[0].publicImageUrl).toBe('https://signed.example/key.webp');
  });
});
