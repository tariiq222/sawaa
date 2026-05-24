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
      service: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
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
      { id: 'e1', nameAr: 'جون', nameEn: 'John', gender: 'MALE', employmentType: 'FULL_TIME', slug: 'john' },
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
    expect(result[0].ratingAverage).toBe(4.5);
    expect(result[0].ratingCount).toBe(10);
    expect(result[0].minServicePrice).toBe(100);
    expect(result[0].isAvailableToday).toBe(true);
    expect(result[1].ratingAverage).toBeNull();
    expect(result[1].minServicePrice).toBeNull();
    expect(result[1].isAvailableToday).toBe(false);
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
});
