import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { SetEmployeeServiceOptionsHandler } from './set-employee-service-options.handler';

describe('SetEmployeeServiceOptionsHandler', () => {
  let handler: SetEmployeeServiceOptionsHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetEmployeeServiceOptionsHandler,
    { provide: PrismaService, useValue: {
    employeeService: { findUnique: jest.fn() },
    serviceDurationOption: { findMany: jest.fn() },
    employeeServiceOption: { findMany: jest.fn() }
    } },
    { provide: RlsTransactionService, useValue: { withTransaction: jest.fn() } }
      ],
    }).compile();

    handler = module.get<SetEmployeeServiceOptionsHandler>(SetEmployeeServiceOptionsHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('throws NotFoundException when the employee-service assignment does not exist', async () => {
    (prisma.employeeService.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      handler.execute({
        employeeId: '00000000-0000-0000-0000-000000000001',
        serviceId: '00000000-0000-0000-0000-000000000002',
        options: [],
      } as any),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.employeeService.findUnique).toHaveBeenCalledWith({
      where: {
        employeeId_serviceId: {
          employeeId: '00000000-0000-0000-0000-000000000001',
          serviceId: '00000000-0000-0000-0000-000000000002',
        },
      },
    });
  });

  it('throws BadRequestException when the practitioner is in custom-pricing mode', async () => {
    (prisma.employeeService.findUnique as jest.Mock).mockResolvedValue({ id: 'link-1', useCustomPricing: true });

    await expect(
      handler.execute({
        employeeId: '00000000-0000-0000-0000-000000000001',
        serviceId: '00000000-0000-0000-0000-000000000002',
        options: [{ durationOptionId: 'opt-1', priceOverride: 5000 }],
      } as any),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.serviceDurationOption.findMany).not.toHaveBeenCalled();
  });

  it('rejects overrides that target a non-service-default (owned) duration option', async () => {
    (prisma.employeeService.findUnique as jest.Mock).mockResolvedValue({ id: 'link-1' });
    // query filters employeeServiceId: null → owned row id is not returned
    (prisma.serviceDurationOption.findMany as jest.Mock).mockResolvedValue([]);

    await expect(
      handler.execute({
        employeeId: '00000000-0000-0000-0000-000000000001',
        serviceId: '00000000-0000-0000-0000-000000000002',
        options: [{ durationOptionId: 'owned-opt', priceOverride: 5000 }],
      } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('resolves the link and returns the employee service options', async () => {
    (prisma.employeeService.findUnique as jest.Mock).mockResolvedValue({ id: 'link-1' });
    (prisma.serviceDurationOption.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.employeeServiceOption.findMany as jest.Mock).mockResolvedValue([{ id: 'opt-link-1' }]);

    const result = await handler.execute({
      employeeId: '00000000-0000-0000-0000-000000000001',
      serviceId: '00000000-0000-0000-0000-000000000002',
      options: [],
    } as any);

    expect(prisma.employeeServiceOption.findMany).toHaveBeenCalledWith({
      where: { employeeServiceId: 'link-1' },
      include: { durationOption: true },
    });
    expect(result).toEqual([{ id: 'opt-link-1' }]);
  });
});
