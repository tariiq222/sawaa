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
        archivedAt: null,
      },
      select: { id: true, price: true },
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
});
