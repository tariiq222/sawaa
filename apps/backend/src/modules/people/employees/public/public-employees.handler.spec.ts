import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { ListPublicEmployeesHandler } from './list-public-employees.handler';
import { GetPublicEmployeeHandler } from './get-public-employee.handler';

const BASE_EMPLOYEE = {
  id: 'e1',
  slug: 'ahmed',
  nameAr: 'أحمد',
  nameEn: 'Ahmed',
  title: null,
  specialty: null,
  specialtyAr: null,
  publicBioAr: null,
  publicBioEn: null,
  publicImageUrl: null,
  gender: 'MALE',
  employmentType: 'FULL_TIME',
};

describe('Public employees handlers', () => {
  let listHandler: ListPublicEmployeesHandler;
  let getHandler: GetPublicEmployeeHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListPublicEmployeesHandler,
        GetPublicEmployeeHandler,
        {
          provide: PrismaService,
          useValue: {
            employee: { findMany: jest.fn(), findFirst: jest.fn() },
            rating: {
              groupBy: jest.fn().mockResolvedValue([]),
              aggregate: jest.fn().mockResolvedValue({ _avg: { score: null }, _count: { _all: 0 } }),
            },
            employeeService: { findMany: jest.fn().mockResolvedValue([]) },
            employeeAvailability: { findMany: jest.fn().mockResolvedValue([]) },
            service: { findMany: jest.fn().mockResolvedValue([]) },
          },
        },
      ],
    }).compile();

    listHandler = module.get(ListPublicEmployeesHandler);
    getHandler = module.get(GetPublicEmployeeHandler);
    prisma = module.get(PrismaService);
  });

  it('lists only public + active employees', async () => {
    prisma.employee.findMany.mockResolvedValue([BASE_EMPLOYEE]);
    const result = await listHandler.execute();
    expect(result).toHaveLength(1);
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublic: true, isActive: true } }),
    );
  });

  it('returns single employee by slug', async () => {
    prisma.employee.findFirst.mockResolvedValue(BASE_EMPLOYEE);
    const result = await getHandler.execute('ahmed');
    expect(result.slug).toBe('ahmed');
  });

  it('throws NotFound when slug missing or not public', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(getHandler.execute('missing')).rejects.toThrow(NotFoundException);
  });

  // ─── Filter fields ──────────────────────────────────────────────────────────

  it('includes gender in the returned employee item', async () => {
    prisma.employee.findMany.mockResolvedValue([{ ...BASE_EMPLOYEE, gender: 'FEMALE' }]);
    const [emp] = await listHandler.execute();
    expect(emp.gender).toBe('FEMALE');
  });

  it('includes employmentType in the returned employee item', async () => {
    prisma.employee.findMany.mockResolvedValue([{ ...BASE_EMPLOYEE, employmentType: 'REMOTE' }]);
    const [emp] = await listHandler.execute();
    expect(emp.employmentType).toBe('REMOTE');
  });

  it('computes minServicePrice from linked services', async () => {
    prisma.employee.findMany.mockResolvedValue([BASE_EMPLOYEE]);
    prisma.employeeService.findMany.mockResolvedValue([
      { employeeId: 'e1', serviceId: 's1' },
      { employeeId: 'e1', serviceId: 's2' },
    ]);
    prisma.service.findMany.mockResolvedValue([
      { id: 's1', price: '350' },
      { id: 's2', price: '200' },
    ]);
    const [emp] = await listHandler.execute();
    expect(emp.minServicePrice).toBe(200);
  });

  it('sets minServicePrice to null when employee has no services', async () => {
    prisma.employee.findMany.mockResolvedValue([BASE_EMPLOYEE]);
    prisma.employeeService.findMany.mockResolvedValue([]);
    const [emp] = await listHandler.execute();
    expect(emp.minServicePrice).toBeNull();
  });

  it('marks employee as available when they have active availability today', async () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0-6
    prisma.employee.findMany.mockResolvedValue([BASE_EMPLOYEE]);
    prisma.employeeAvailability.findMany.mockResolvedValue([
      { employeeId: 'e1', dayOfWeek, isActive: true },
    ]);
    const [emp] = await listHandler.execute();
    expect(emp.isAvailableToday).toBe(true);
  });

  it('marks employee as unavailable when they have no availability today', async () => {
    prisma.employee.findMany.mockResolvedValue([BASE_EMPLOYEE]);
    prisma.employeeAvailability.findMany.mockResolvedValue([]);
    const [emp] = await listHandler.execute();
    expect(emp.isAvailableToday).toBe(false);
  });

  it('selects gender and employmentType from database', async () => {
    prisma.employee.findMany.mockResolvedValue([BASE_EMPLOYEE]);
    await listHandler.execute();
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ gender: true, employmentType: true }),
      }),
    );
  });
});
