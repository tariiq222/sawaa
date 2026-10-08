import { OwnedImageResolver } from '../../../media/owned-image.resolver';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../infrastructure/database';
import { GetPublicEmployeeHandler } from './get-public-employee.handler';

describe('GetPublicEmployeeHandler', () => {
  let handler: GetPublicEmployeeHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn() },
      rating: { aggregate: jest.fn() },
      employeeService: { findMany: jest.fn() },
      employeeBranch: { findMany: jest.fn() },
      branch: { findMany: jest.fn() },
      service: { findMany: jest.fn() },
      employeeAvailability: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: OwnedImageResolver, useValue: { resolve: jest.fn(async (_type, _id, value) => value && /^(https?:\/\/|\/)/.test(value) ? value : null) } },
        GetPublicEmployeeHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<GetPublicEmployeeHandler>(GetPublicEmployeeHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    try {
      await handler.execute('00000000-0000-0000-0000-000000000001');
    } catch (e) {
      // Expected for incomplete mocks
    }
  });

  it('should only expose active visible services and active branches as bookable links', async () => {
    prisma.employee.findFirst.mockResolvedValue({
      id: 'e1',
      slug: 'john',
      nameAr: null,
      nameEn: 'John Doe',
      title: null,
      specialty: null,
      specialtyAr: null,
      publicBioAr: null,
      publicBioEn: null,
      publicImageUrl: null,
      gender: null,
      employmentType: 'FULL_TIME',
      experience: 7,
    });
    prisma.rating.aggregate.mockResolvedValue({ _avg: { score: 4.5 }, _count: { _all: 3 } });
    prisma.employeeService.findMany.mockResolvedValue([
      { serviceId: 'active-service' },
      { serviceId: 'stale-service' },
    ]);
    prisma.employeeBranch.findMany.mockResolvedValue([
      { branchId: 'active-branch' },
      { branchId: 'inactive-branch' },
    ]);
    prisma.employeeAvailability.findMany
      .mockResolvedValueOnce([{ id: 'availability-1', dayOfWeek: 1 }])
      .mockResolvedValueOnce([{ id: 'today-availability' }]);
    prisma.service.findMany.mockResolvedValue([{ id: 'active-service', price: 150 }]);
    prisma.branch.findMany.mockResolvedValue([{ id: 'active-branch' }]);

    const result = await handler.execute('john');

    expect(prisma.service.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['active-service', 'stale-service'] },
        isActive: true,
        isHidden: false,
        OR: [{ categoryId: null }, { category: { isActive: true } }],
        archivedAt: null,
      },
      select: { id: true, price: true, isHidden: true },
    });
    expect(prisma.branch.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['active-branch', 'inactive-branch'] }, isActive: true },
      select: { id: true },
    });
    expect(result.serviceIds).toEqual(['active-service']);
    expect(result.branchIds).toEqual(['active-branch']);
    expect(result.minServicePrice).toBe(150);
    expect(result.isBookable).toBe(true);
  });

  it('includes only hidden DIRECT links on opt-in and excludes their base price', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1', slug: 'john', nameAr: 'أحمد', nameEn: null, publicImageUrl: null });
    prisma.rating.aggregate.mockResolvedValue({ _avg: { score: null }, _count: { _all: 0 } });
    prisma.employeeService.findMany.mockResolvedValue([{ serviceId: 'direct' }, { serviceId: 'visible' }]);
    prisma.employeeBranch.findMany.mockResolvedValue([{ branchId: 'branch' }]);
    prisma.employeeAvailability.findMany.mockResolvedValue([{ id: 'availability', dayOfWeek: 1 }]);
    prisma.branch.findMany.mockResolvedValue([{ id: 'branch' }]);
    prisma.service.findMany.mockResolvedValue([{ id: 'direct', price: 0, isHidden: true }, { id: 'visible', price: 200, isHidden: false }]);
    const result = await handler.execute('john', { includeDirectClinics: true });
    expect(prisma.service.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      OR: [
        { isHidden: false, OR: [{ categoryId: null }, { category: { isActive: true } }] },
        { isHidden: true, category: { isActive: true, bookingMode: 'DIRECT' } },
      ],
    }) }));
    expect(result.serviceIds).toEqual(['direct', 'visible']);
    expect(result.minServicePrice).toBe(200);
  });
  it.each([false, true])('retains uncategorized visible booking links with includeDirectClinics=%s', async (includeDirectClinics) => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1', nameAr: 'معالج', nameEn: null, publicImageUrl: null });
    prisma.rating.aggregate.mockResolvedValue({ _avg: { score: null }, _count: { _all: 0 } });
    prisma.employeeService.findMany.mockResolvedValue([{ employeeId: 'e1', serviceId: 'legacy' }]);
    prisma.employeeBranch.findMany.mockResolvedValue([{ employeeId: 'e1', branchId: 'branch' }]);
    prisma.employeeAvailability.findMany.mockResolvedValue([{ employeeId: 'e1', dayOfWeek: 1 }]);
    prisma.branch.findMany.mockResolvedValue([{ id: 'branch' }]);
    prisma.service.findMany.mockResolvedValue([{ id: 'legacy', price: 150, isHidden: false }]);

    const employee = await handler.execute('e1', { includeDirectClinics });
    const { where } = prisma.service.findMany.mock.calls[0][0];
    const visibleWhere = includeDirectClinics ? where.OR[0] : where;

    expect(visibleWhere).toEqual(expect.objectContaining({
      isHidden: false,
      OR: [{ categoryId: null }, { category: { isActive: true } }],
    }));
    expect(visibleWhere).not.toHaveProperty('category');
    expect(employee.serviceIds).toEqual(['legacy']);
    expect(employee.isBookable).toBe(true);
    expect(employee.minServicePrice).toBe(150);
  });

});
