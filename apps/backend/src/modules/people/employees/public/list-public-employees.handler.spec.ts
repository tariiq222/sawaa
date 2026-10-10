import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../infrastructure/database';
import { ListPublicEmployeesHandler } from './list-public-employees.handler';

describe('ListPublicEmployeesHandler', () => {
  let handler: ListPublicEmployeesHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      employee: { findMany: jest.fn() },
      rating: { groupBy: jest.fn() },
      employeeService: { findMany: jest.fn() },
      employeeAvailability: { findMany: jest.fn() },
      employeeBranch: { findMany: jest.fn().mockResolvedValue([]) },
      branch: { findMany: jest.fn().mockResolvedValue([]) },
      service: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: ConfigService, useValue: new ConfigService({ API_PUBLIC_URL: 'https://api.sawaa.test' }) },
        ListPublicEmployeesHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<ListPublicEmployeesHandler>(ListPublicEmployeesHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should return empty when no employees', async () => {
    prisma.employee.findMany.mockResolvedValue([]);
    const result = await handler.execute();
    expect(result).toEqual([]);
  });

  it('should return employees with ratings and prices', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 'e1', languages: ['العربية'], nameAr: 'جون', nameEn: 'John', gender: 'MALE', employmentType: 'FULL_TIME', slug: 'john' },
      { id: 'e2', nameAr: 'جين', nameEn: 'Jane', gender: null, employmentType: 'PART_TIME', slug: null },
    ]);
    prisma.rating.groupBy.mockResolvedValue([
      { employeeId: 'e1', _avg: { score: 4.5 }, _count: { _all: 10 } },
    ]);
    prisma.employeeService.findMany.mockResolvedValue([
      { employeeId: 'e1', serviceId: 's1' },
      { employeeId: 'e1', serviceId: 's2' },
    ]);
    prisma.service.findMany.mockResolvedValue([
      { id: 's1', price: 100 },
      { id: 's2', price: 200 },
    ]);
    prisma.employeeAvailability.findMany.mockResolvedValue([
      { employeeId: 'e1' },
    ]);

    const result = await handler.execute();
    expect(result).toHaveLength(2);
    expect(result[0].languages).toEqual(['العربية']);
    expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ languages: true }) }));
    expect(result[0].ratingAverage).toBe(4.5);
    expect(result[0].ratingCount).toBe(10);
    expect(result[0].minServicePrice).toBe(100);
    expect(result[0].isAvailableToday).toBe(true);
    expect(result[1].ratingAverage).toBeNull();
    expect(result[1].minServicePrice).toBeNull();
    expect(result[1].isAvailableToday).toBe(false);
  });

  it('should only expose active visible services and active branches as bookable links', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 'e1', nameAr: null, nameEn: 'John Doe', gender: null, employmentType: 'FULL_TIME', slug: 'john' },
    ]);
    prisma.rating.groupBy.mockResolvedValue([]);
    prisma.employeeService.findMany.mockResolvedValue([
      { employeeId: 'e1', serviceId: 'active-service' },
      { employeeId: 'e1', serviceId: 'stale-service' },
    ]);
    prisma.employeeBranch.findMany.mockResolvedValue([
      { employeeId: 'e1', branchId: 'active-branch' },
      { employeeId: 'e1', branchId: 'inactive-branch' },
    ]);
    prisma.service.findMany.mockResolvedValue([{ id: 'active-service', price: 150 }]);
    prisma.branch.findMany.mockResolvedValue([{ id: 'active-branch' }]);
    prisma.employeeAvailability.findMany.mockResolvedValue([
      { employeeId: 'e1', dayOfWeek: new Date().getDay() },
    ]);

    const result = await handler.execute();

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
    expect(result[0].serviceIds).toEqual(['active-service']);
    expect(result[0].branchIds).toEqual(['active-branch']);
    expect(result[0].minServicePrice).toBe(150);
    expect(result[0].isBookable).toBe(true);
  });

  it('exposes direct clinic booking links only when requested without using their internal price', async () => {
    prisma.employee.findMany.mockResolvedValue([{ id: 'e1', nameAr: 'معالج', employmentType: 'FULL_TIME' }]);
    prisma.rating.groupBy.mockResolvedValue([]);
    prisma.employeeService.findMany.mockResolvedValue([{ employeeId: 'e1', serviceId: 'direct-service' }]);
    prisma.employeeBranch.findMany.mockResolvedValue([{ employeeId: 'e1', branchId: 'branch' }]);
    prisma.employeeAvailability.findMany.mockResolvedValue([{ employeeId: 'e1', dayOfWeek: 1 }]);
    prisma.branch.findMany.mockResolvedValue([{ id: 'branch' }]);
    prisma.service.findMany.mockResolvedValue([{ id: 'direct-service', price: 0, isHidden: true }]);

    const [employee] = await handler.execute({ includeDirectClinics: true });

    expect(prisma.service.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: [
        { isHidden: false, OR: [{ categoryId: null }, { category: { isActive: true } }] },
        { isHidden: true, category: { isActive: true, bookingMode: 'DIRECT' } },
      ] }),
    }));
    expect(employee.serviceIds).toEqual(['direct-service']);
    expect(employee.isBookable).toBe(true);
    expect(employee.minServicePrice).toBeNull();
  });

  it('should handle no services for employees', async () => {
    prisma.employee.findMany.mockResolvedValue([{ id: 'e1', nameAr: null, nameEn: 'Bob', gender: null, employmentType: 'CONTRACTOR', slug: null }]);
    prisma.rating.groupBy.mockResolvedValue([]);
    prisma.employeeService.findMany.mockResolvedValue([]);
    prisma.employeeAvailability.findMany.mockResolvedValue([]);

    const result = await handler.execute();
    expect(result[0].minServicePrice).toBeNull();
    expect(prisma.service.findMany).not.toHaveBeenCalled();
  });

  it('should handle service with undefined price', async () => {
    prisma.employee.findMany.mockResolvedValue([{ id: 'e1', nameAr: null, nameEn: 'Bob', gender: null, employmentType: 'FULL_TIME', slug: null }]);
    prisma.rating.groupBy.mockResolvedValue([]);
    prisma.employeeService.findMany.mockResolvedValue([{ employeeId: 'e1', serviceId: 's1' }]);
    prisma.service.findMany.mockResolvedValue([{ id: 's1', price: null }]);
    prisma.employeeAvailability.findMany.mockResolvedValue([]);

    const result = await handler.execute();
    expect(result[0].minServicePrice).toBeNaN();
  });
  it.each([false, true])('retains uncategorized visible booking links with includeDirectClinics=%s', async (includeDirectClinics) => {
    prisma.employee.findMany.mockResolvedValue([{ id: 'e1', nameAr: 'معالج', nameEn: null, publicImageUrl: null }]);
    prisma.rating.groupBy.mockResolvedValue([]);
    prisma.employeeService.findMany.mockResolvedValue([{ employeeId: 'e1', serviceId: 'legacy' }]);
    prisma.employeeBranch.findMany.mockResolvedValue([{ employeeId: 'e1', branchId: 'branch' }]);
    prisma.employeeAvailability.findMany.mockResolvedValue([{ employeeId: 'e1', dayOfWeek: 1 }]);
    prisma.branch.findMany.mockResolvedValue([{ id: 'branch' }]);
    prisma.service.findMany.mockResolvedValue([{ id: 'legacy', price: 150, isHidden: false }]);

    const [employee] = await handler.execute({ includeDirectClinics });
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
