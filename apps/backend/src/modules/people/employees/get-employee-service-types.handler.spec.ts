import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetEmployeeServiceTypesHandler } from './get-employee-service-types.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('GetEmployeeServiceTypesHandler', () => {
  let handler: GetEmployeeServiceTypesHandler;
  let prisma: {
    employeeService: { findFirst: jest.Mock };
    serviceBookingConfig: { findMany: jest.Mock };
    serviceDurationOption: { findMany: jest.Mock };
    employeeServiceOption: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      employeeService: { findFirst: jest.fn() },
      serviceBookingConfig: { findMany: jest.fn() },
      serviceDurationOption: { findMany: jest.fn() },
      employeeServiceOption: { findMany: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        GetEmployeeServiceTypesHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(GetEmployeeServiceTypesHandler);
  });

  it('throws when employee-service link not found', async () => {
    prisma.employeeService.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ employeeId: 'e1', serviceId: 's1' })).rejects.toThrow(NotFoundException);
  });

  it('returns mapped configs with duration options', async () => {
    prisma.employeeService.findFirst.mockResolvedValue({ id: 'link-1' });
    prisma.serviceBookingConfig.findMany.mockResolvedValue([
      { id: 'c1', serviceId: 's1', deliveryType: 'IN_PERSON', price: 100, durationMins: 30, isActive: true },
    ]);
    prisma.serviceDurationOption.findMany.mockResolvedValue([
      { id: 'd1', serviceId: 's1', deliveryType: 'IN_PERSON', durationMins: 30, price: 100, label: '30 min', labelAr: '٣٠ دقيقة', isDefault: true, sortOrder: 1, isActive: true },
      { id: 'd2', serviceId: 's1', deliveryType: 'IN_PERSON', durationMins: 60, price: 150, label: '60 min', labelAr: '٦٠ دقيقة', isDefault: false, sortOrder: 2, isActive: true },
    ]);
    prisma.employeeServiceOption.findMany.mockResolvedValue([
      { durationOptionId: 'd1', durationOverride: 35, priceOverride: 110 },
    ]);

    const result = await handler.execute({ employeeId: 'e1', serviceId: 's1' });
    expect(result).toHaveLength(1);
    expect(result[0].deliveryType).toBe('IN_PERSON');
    expect(result[0].durationOptions).toHaveLength(2);
    expect(result[0].durationOptions[0].durationMinutes).toBe(35); // overridden
    expect(result[0].durationOptions[0].price).toBe(110);
    expect(result[0].durationOptions[1].durationMinutes).toBe(60); // not overridden
    expect(result[0].durationOptions[1].price).toBe(150);
  });

  it('filters duration options by delivery type', async () => {
    prisma.employeeService.findFirst.mockResolvedValue({ id: 'link-1' });
    prisma.serviceBookingConfig.findMany.mockResolvedValue([
      { id: 'c1', serviceId: 's1', deliveryType: 'IN_PERSON', price: 100, durationMins: 30, isActive: true },
      { id: 'c2', serviceId: 's1', deliveryType: 'ONLINE', price: 50, durationMins: 15, isActive: true },
    ]);
    prisma.serviceDurationOption.findMany.mockResolvedValue([
      { id: 'd1', serviceId: 's1', deliveryType: 'IN_PERSON', durationMins: 30, price: 100, label: '30 min', labelAr: null, isDefault: true, sortOrder: 1, isActive: true },
    ]);
    prisma.employeeServiceOption.findMany.mockResolvedValue([]);

    const result = await handler.execute({ employeeId: 'e1', serviceId: 's1' });
    expect(result).toHaveLength(2);
    expect(result[0].durationOptions).toHaveLength(1);
    expect(result[1].durationOptions).toHaveLength(0); // ONLINE has no matching duration option
  });
});
