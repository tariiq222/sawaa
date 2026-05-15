import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListEmployeesHandler } from './list-employees.handler';

function createEmployee(overrides?: Partial<any>) {
  return {
    id: 'e1',
    name: 'John',
    branches: [],
    services: [],
    availability: [],
    ...overrides,
  };
}

describe('ListEmployeesHandler', () => {
  let handler: ListEmployeesHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      employee: { findMany: jest.fn(), count: jest.fn() },
      rating: { groupBy: jest.fn() },
      booking: { groupBy: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListEmployeesHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<ListEmployeesHandler>(ListEmployeesHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should list employees with defaults', async () => {
    prisma.employee.findMany.mockResolvedValue([createEmployee()]);
    prisma.employee.count.mockResolvedValue(1);
    prisma.rating.groupBy.mockResolvedValue([]);
    prisma.booking.groupBy.mockResolvedValue([]);

    const result = await handler.execute({ page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { createdAt: 'desc' },
    }));
  });

  it('should filter by search', async () => {
    prisma.employee.findMany.mockResolvedValue([]);
    prisma.employee.count.mockResolvedValue(0);

    await handler.execute({ page: 1, limit: 20, search: 'John' });
    expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: expect.arrayContaining([
          expect.objectContaining({ name: expect.objectContaining({ contains: 'John' }) }),
        ]),
      }),
    }));
  });

  it('should filter by branchId', async () => {
    prisma.employee.findMany.mockResolvedValue([]);
    prisma.employee.count.mockResolvedValue(0);

    await handler.execute({ page: 1, limit: 20, branchId: 'b1' });
    expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ branches: { some: { branchId: 'b1' } } }),
    }));
  });

  it('should sort by name asc', async () => {
    prisma.employee.findMany.mockResolvedValue([]);
    prisma.employee.count.mockResolvedValue(0);

    await handler.execute({ page: 1, limit: 20, sortBy: 'name', sortOrder: 'asc' });
    expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { name: 'asc' },
    }));
  });

  it('should sort by experience desc', async () => {
    prisma.employee.findMany.mockResolvedValue([]);
    prisma.employee.count.mockResolvedValue(0);

    await handler.execute({ page: 1, limit: 20, sortBy: 'experience', sortOrder: 'desc' });
    expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { experience: 'desc' },
    }));
  });

  it('should sort by isActive', async () => {
    prisma.employee.findMany.mockResolvedValue([]);
    prisma.employee.count.mockResolvedValue(0);

    await handler.execute({ page: 1, limit: 20, sortBy: 'isActive' });
    expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { isActive: 'asc' },
    }));
  });

  it('should default sort to createdAt desc', async () => {
    prisma.employee.findMany.mockResolvedValue([]);
    prisma.employee.count.mockResolvedValue(0);

    await handler.execute({ page: 1, limit: 20 });
    expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { createdAt: 'desc' },
    }));
  });

  it('should skip ratings/bookings queries when no items', async () => {
    prisma.employee.findMany.mockResolvedValue([]);
    prisma.employee.count.mockResolvedValue(0);

    await handler.execute({ page: 1, limit: 20 });
    expect(prisma.rating.groupBy).not.toHaveBeenCalled();
    expect(prisma.booking.groupBy).not.toHaveBeenCalled();
  });

  it('should include ratings and bookings stats', async () => {
    prisma.employee.findMany.mockResolvedValue([createEmployee({ id: 'e1' }), createEmployee({ id: 'e2' })]);
    prisma.employee.count.mockResolvedValue(2);
    prisma.rating.groupBy.mockResolvedValue([
      { employeeId: 'e1', _avg: { score: 4.5 }, _count: { _all: 10 } },
    ]);
    prisma.booking.groupBy.mockResolvedValue([
      { employeeId: 'e1', _count: { _all: 5 } },
    ]);

    const result = await handler.execute({ page: 1, limit: 20 });
    expect(result.items[0].averageRating).toBe(4.5);
    expect(result.items[0].bookingCount).toBe(5);
    expect(result.items[1].averageRating).toBeNull();
    expect(result.items[1].bookingCount).toBe(0);
  });
});
