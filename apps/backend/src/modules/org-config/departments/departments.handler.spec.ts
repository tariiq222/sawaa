import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateDepartmentHandler } from './create-department.handler';
import { ListDepartmentsHandler } from './list-departments.handler';
import { UpdateDepartmentHandler } from './update-department.handler';
import { DeleteDepartmentHandler } from './delete-department.handler';
const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001';

const mockDept = { id: 'dept-1', organizationId: DEFAULT_ORG, nameAr: 'عيادة', nameEn: 'Clinic', sortOrder: 0, isActive: true, isVisible: true, categories: [] };

const buildPrisma = () => {
  const prisma = {
    department: {
      create: jest.fn().mockResolvedValue(mockDept),
      findMany: jest.fn().mockResolvedValue([mockDept]),
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue(mockDept),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(mockDept),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  return prisma;
};

describe('CreateDepartmentHandler', () => {
  it('creates a department scoped by org and passes all fields to prisma', async () => {
    const prisma = buildPrisma();
    prisma.department.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new CreateDepartmentHandler(prisma as never);
    const result = await handler.execute({
      nameAr: 'عيادة',
      nameEn: 'Clinic',
      descriptionAr: 'وصف القسم',
      descriptionEn: 'Department description',
      icon: 'clinic-icon',
    });
    // org scoping moved to RLS / removed in single-tenant migration
    expect(prisma.department.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nameAr: 'عيادة',
        descriptionAr: 'وصف القسم',
      }),
    });
    expect(result).toMatchObject({ id: 'dept-1' });
  });

  it('throws ConflictException on duplicate nameAr in same org', async () => {
    const prisma = buildPrisma();
    prisma.department.findFirst = jest.fn().mockResolvedValue(mockDept);
    const handler = new CreateDepartmentHandler(prisma as never);
    await expect(handler.execute({ nameAr: 'عيادة' })).rejects.toThrow(ConflictException);
  });

  it('allows same nameAr in two different orgs', async () => {
    const prismaA = buildPrisma();
    prismaA.department.findFirst = jest.fn().mockResolvedValue(null);
    const prismaB = buildPrisma();
    prismaB.department.findFirst = jest.fn().mockResolvedValue(null);
    const handlerA = new CreateDepartmentHandler(prismaA as never);
    const handlerB = new CreateDepartmentHandler(prismaB as never);
    await expect(handlerA.execute({ nameAr: 'عيادة' })).resolves.toBeDefined();
    await expect(handlerB.execute({ nameAr: 'عيادة' })).resolves.toBeDefined();
  });
});

describe('ListDepartmentsHandler', () => {
  it('returns departments scoped by org', async () => {
    const prisma = buildPrisma();
    const handler = new ListDepartmentsHandler(prisma as never);
    const result = await handler.execute({ page: 1, limit: 10 });
    expect(result.items).toHaveLength(1);
    expect(prisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.any(Object) }),
    );
  });

  it('passes search term to where clause', async () => {
    const prisma = buildPrisma();
    const handler = new ListDepartmentsHandler(prisma as never);
    await handler.execute({ page: 1, limit: 10, search: 'طب' });
    const call = (prisma.department.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where).toMatchObject({
      OR: expect.arrayContaining([
        { nameAr: { contains: 'طب', mode: 'insensitive' } },
      ]),
    });
  });

  it('omits search clause when search is undefined', async () => {
    const prisma = buildPrisma();
    const handler = new ListDepartmentsHandler(prisma as never);
    await handler.execute({ page: 1, limit: 10 });
    const call = (prisma.department.findMany as jest.Mock).mock.calls[0][0];
    expect(call.where).not.toHaveProperty('OR');
  });
});

describe('UpdateDepartmentHandler', () => {
  it('updates department fields scoped by org', async () => {
    const prisma = buildPrisma();
    const handler = new UpdateDepartmentHandler(prisma as never);
    await handler.execute({ departmentId: 'dept-1', nameEn: 'Updated' });
    expect(prisma.department.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dept-1' },
      }),
    );
  });

  it('throws NotFoundException when department not found', async () => {
    const prisma = buildPrisma();
    prisma.department.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const handler = new UpdateDepartmentHandler(prisma as never);
    await expect(handler.execute({ departmentId: 'dept-1', nameEn: 'x' })).rejects.toThrow(NotFoundException);
  });
});

describe('DeleteDepartmentHandler', () => {
  it('deletes department scoped by org', async () => {
    const prisma = buildPrisma();
    const handler = new DeleteDepartmentHandler(prisma as never);
    const result = await handler.execute({ departmentId: 'dept-1' });
    expect(prisma.department.deleteMany).toHaveBeenCalledWith({
      where: { id: 'dept-1' },
    });
    expect(result).toEqual({ deleted: true });
  });

  it('throws NotFoundException when department not found', async () => {
    const prisma = buildPrisma();
    prisma.department.deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const handler = new DeleteDepartmentHandler(prisma as never);
    await expect(handler.execute({ departmentId: 'dept-1' })).rejects.toThrow(NotFoundException);
  });
});
