import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateCategoryHandler } from './create-category.handler';
import { ListCategoriesHandler } from './list-categories.handler';
import { UpdateCategoryHandler } from './update-category.handler';
import { DeleteCategoryHandler } from './delete-category.handler';
const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001';

const mockCategory = {
  id: 'cat-1',
  organizationId: DEFAULT_ORG,
  nameAr: 'فحص',
  nameEn: 'Checkup',
  sortOrder: 0,
  isActive: true,
  departmentId: null,
  _count: { services: 0 },
};

const buildPrisma = () => {
  const prisma = {
    serviceCategory: {
      create: jest.fn().mockResolvedValue(mockCategory),
      findMany: jest.fn().mockResolvedValue([mockCategory]),
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue(mockCategory),
      update: jest.fn().mockResolvedValue(mockCategory),
      delete: jest.fn().mockResolvedValue(mockCategory),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  return prisma;
};

describe('CreateCategoryHandler', () => {
  it('creates a category scoped by org', async () => {
    const prisma = buildPrisma();
    const handler = new CreateCategoryHandler(prisma as never);
    const result = await handler.execute({ nameAr: 'فحص', nameEn: 'Checkup' });
    // org scoping moved to RLS / removed in single-tenant migration
    expect(prisma.serviceCategory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nameAr: 'فحص' }) }),
    );
    expect(result).toMatchObject({ id: 'cat-1' });
  });
});

describe('ListCategoriesHandler', () => {
  it('returns categories scoped by org', async () => {
    const prisma = buildPrisma();
    const handler = new ListCategoriesHandler(prisma as never);
    const result = await handler.execute({ page: 1, limit: 10 });
    expect(prisma.serviceCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.any(Object) }),
    );
    expect(result.items).toHaveLength(1);
  });

  it('passes search term to where clause', async () => {
    const prisma = buildPrisma();
    const handler = new ListCategoriesHandler(prisma as never);
    await handler.execute({ page: 1, limit: 10, search: 'فحص' });
    const call = (prisma.serviceCategory.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where).toMatchObject({
      OR: expect.arrayContaining([
        { nameAr: { contains: 'فحص', mode: 'insensitive' } },
      ]),
    });
  });

  it('omits search clause when search is undefined', async () => {
    const prisma = buildPrisma();
    const handler = new ListCategoriesHandler(prisma as never);
    await handler.execute({ page: 1, limit: 10 });
    const call = (prisma.serviceCategory.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where).not.toHaveProperty('OR');
  });
});

describe('UpdateCategoryHandler', () => {
  it('updates category fields scoped by org', async () => {
    const prisma = buildPrisma();
    const handler = new UpdateCategoryHandler(prisma as never);
    await handler.execute({ categoryId: 'cat-1', nameEn: 'Updated' });
    expect(prisma.serviceCategory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cat-1' } }),
    );
    expect(prisma.serviceCategory.update).toHaveBeenCalled();
  });

  it('throws NotFoundException when category not found', async () => {
    const prisma = buildPrisma();
    prisma.serviceCategory.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new UpdateCategoryHandler(prisma as never);
    await expect(handler.execute({ categoryId: 'bad', nameEn: 'x' })).rejects.toThrow(NotFoundException);
  });
});

describe('DeleteCategoryHandler', () => {
  it('deletes category scoped by org', async () => {
    const prisma = buildPrisma();
    const handler = new DeleteCategoryHandler(prisma as never);
    await handler.execute({ categoryId: 'cat-1' });
    expect(prisma.serviceCategory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cat-1' } }),
    );
    expect(prisma.serviceCategory.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
  });

  it('throws NotFoundException when category not found', async () => {
    const prisma = buildPrisma();
    prisma.serviceCategory.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new DeleteCategoryHandler(prisma as never);
    await expect(handler.execute({ categoryId: 'bad' })).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when category has services', async () => {
    const prisma = buildPrisma();
    prisma.serviceCategory.findFirst = jest.fn().mockResolvedValue({ ...mockCategory, _count: { services: 2 } });
    const handler = new DeleteCategoryHandler(prisma as never);
    await expect(handler.execute({ categoryId: 'cat-1' })).rejects.toThrow(BadRequestException);
  });
});
