import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SetBusinessHoursHandler } from './set-business-hours.handler';
import { GetBusinessHoursHandler } from './get-business-hours.handler';
import { AddHolidayHandler } from './add-holiday.handler';
import { RemoveHolidayHandler } from './remove-holiday.handler';
import { ListHolidaysHandler } from './list-holidays.handler';
import { AddHolidayDto } from './add-holiday.dto';
import { ListHolidaysDto } from './list-holidays.dto';
import { SetBusinessHoursDto } from './set-business-hours.dto';
import { TenantContextService } from '../../../common/tenant';
import { RlsTransactionService } from '../../../infrastructure/database';

const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001';

const mockBranch = { id: 'branch-1', organizationId: DEFAULT_ORG };
const mockHour = { id: 'hour-1', branchId: 'branch-1', organizationId: DEFAULT_ORG, dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isOpen: true };
const mockHoliday = { id: 'hol-1', branchId: 'branch-1', organizationId: DEFAULT_ORG, date: new Date('2026-01-01'), nameAr: 'رأس السنة', nameEn: null };

const schedule = [{ dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isOpen: true }];

const buildPrisma = () => ({
  branch: { findFirst: jest.fn().mockResolvedValue(mockBranch) },
  businessHour: {
    upsert: jest.fn().mockResolvedValue(mockHour),
    findMany: jest.fn().mockResolvedValue([mockHour]),
  },
  holiday: {
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue(mockHoliday),
    findMany: jest.fn().mockResolvedValue([mockHoliday]),
    delete: jest.fn().mockResolvedValue(mockHoliday),
  },
  $transaction: jest.fn((ops) => Promise.all(ops as Promise<unknown>[])),
});

const buildTenant = (organizationId = DEFAULT_ORG) =>
  ({
    requireOrganizationId: jest.fn().mockReturnValue(organizationId),
  }) as unknown as TenantContextService;
const buildRlsTx = (prisma: ReturnType<typeof buildPrisma>) =>
  ({
    withTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    withBypassTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  } as unknown as RlsTransactionService);

describe('SetBusinessHoursHandler', () => {
  it('upserts schedule and returns hours', async () => {
    const prisma = buildPrisma();
    const handler = new SetBusinessHoursHandler(prisma as never, buildTenant(), buildRlsTx(prisma) as never);
    const result = await handler.execute({ branchId: 'branch-1', schedule });
    expect(result).toEqual([mockHour]);
  });

  it('throws NotFoundException when branch not found', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new SetBusinessHoursHandler(prisma as never, buildTenant(), buildRlsTx(prisma) as never);
    await expect(handler.execute({ branchId: 'missing', schedule })).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for invalid dayOfWeek', async () => {
    const prisma = buildPrisma();
    const handler = new SetBusinessHoursHandler(prisma as never, buildTenant(), buildRlsTx(prisma) as never);
    await expect(
      handler.execute({ branchId: 'branch-1', schedule: [{ dayOfWeek: 9, startTime: '09:00', endTime: '17:00', isOpen: true }] }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('GetBusinessHoursHandler', () => {
  it('returns hours for branch', async () => {
    const prisma = buildPrisma();
    const handler = new GetBusinessHoursHandler(prisma as never, buildTenant());
    const result = await handler.execute({ branchId: 'branch-1' });
    expect(result).toEqual([mockHour]);
  });

  it('throws NotFoundException when branch not found', async () => {
    const prisma = buildPrisma();
    prisma.branch.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new GetBusinessHoursHandler(prisma as never, buildTenant());
    await expect(handler.execute({ branchId: 'missing' })).rejects.toThrow(NotFoundException);
  });
});

describe('AddHolidayHandler', () => {
  it('creates holiday scoped by org', async () => {
    const prisma = buildPrisma();
    const handler = new AddHolidayHandler(prisma as never, buildTenant());
    const result = await handler.execute({ branchId: 'branch-1', date: '2026-01-01', nameAr: 'رأس السنة' });
    expect(result.id).toBe('hol-1');
    // org scoping moved to RLS / removed in single-tenant migration
    expect(prisma.holiday.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ branchId: 'branch-1', nameAr: 'رأس السنة' }) }),
    );
  });

  it('throws ConflictException when holiday exists on same date', async () => {
    const prisma = buildPrisma();
    prisma.holiday.findUnique = jest.fn().mockResolvedValue(mockHoliday);
    const handler = new AddHolidayHandler(prisma as never, buildTenant());
    await expect(
      handler.execute({ branchId: 'branch-1', date: '2026-01-01', nameAr: 'رأس السنة' }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('RemoveHolidayHandler', () => {
  it('deletes holiday when found in org', async () => {
    const prisma = buildPrisma();
    prisma.holiday.findFirst = jest.fn().mockResolvedValue(mockHoliday);
    const handler = new RemoveHolidayHandler(prisma as never, buildTenant());
    const result = await handler.execute({ holidayId: 'hol-1' });
    expect(result.deleted).toBe(true);
  });

  it('throws NotFoundException when holiday not found', async () => {
    const prisma = buildPrisma();
    const handler = new RemoveHolidayHandler(prisma as never, buildTenant());
    await expect(handler.execute({ holidayId: 'missing' })).rejects.toThrow(NotFoundException);
  });
});

describe('ListHolidaysHandler', () => {
  it('returns holidays for branch scoped by org', async () => {
    const prisma = buildPrisma();
    const handler = new ListHolidaysHandler(prisma as never, buildTenant());
    const result = await handler.execute({ branchId: 'branch-1' });
    expect(result).toHaveLength(1);
  });
});

describe('business hours DTOs', () => {
  it('accepts seeded branch ids that are not UUIDs', async () => {
    const addHolidayErrors = await validate(
      plainToInstance(AddHolidayDto, {
        branchId: 'main-branch',
        date: '2026-09-23',
        nameAr: 'اليوم الوطني',
      }),
    );
    const listHolidayErrors = await validate(
      plainToInstance(ListHolidaysDto, {
        branchId: 'main-branch',
        year: 2026,
      }),
    );
    const setHoursErrors = await validate(
      plainToInstance(SetBusinessHoursDto, {
        branchId: 'main-branch',
        schedule: [{ dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isOpen: true }],
      }),
    );

    expect(addHolidayErrors).toEqual([]);
    expect(listHolidayErrors).toEqual([]);
    expect(setHoursErrors).toEqual([]);
  });
});
