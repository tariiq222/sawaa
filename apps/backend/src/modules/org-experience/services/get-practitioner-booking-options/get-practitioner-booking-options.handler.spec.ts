import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetPractitionerBookingOptionsHandler } from './get-practitioner-booking-options.handler';
import { PrismaService } from '../../../../infrastructure/database';

const mockPrisma = {
  employeeService: { findUnique: jest.fn() },
  serviceBookingConfig: { findMany: jest.fn() },
  service: { findUnique: jest.fn() },
  employee: { findFirst: jest.fn() },
  serviceDurationOption: { findMany: jest.fn() },
  employeeServiceOption: { findFirst: jest.fn() },
};

const VISIBLE_SERVICE = { currency: 'SAR', isActive: true, archivedAt: null, isHidden: false, category: null };

describe('GetPractitionerBookingOptionsHandler', () => {
  let handler: GetPractitionerBookingOptionsHandler;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPractitionerBookingOptionsHandler,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    handler = module.get(GetPractitionerBookingOptionsHandler);
    // Default to a visible service + active employee; individual tests override.
    mockPrisma.service.findUnique.mockResolvedValue(VISIBLE_SERVICE);
    mockPrisma.employee.findFirst.mockResolvedValue({ isActive: true });
  });

  it('throws NotFoundException when link does not exist', async () => {
    mockPrisma.employeeService.findUnique.mockResolvedValue(null);
    await expect(
      handler.execute({ serviceId: 'svc-1', employeeId: 'emp-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns empty options when link is inactive', async () => {
    mockPrisma.employeeService.findUnique.mockResolvedValue({
      id: 'link-1', isActive: false, disabledDeliveryTypes: [], useCustomPricing: false, serviceId: 'svc-1',
    });
    const result = await handler.execute({ serviceId: 'svc-1', employeeId: 'emp-1' });
    expect(result.options).toEqual([]);
  });

  it('custom mode: hides delivery type when no owned options exist', async () => {
    mockPrisma.employeeService.findUnique.mockResolvedValue({
      id: 'link-1', isActive: true, disabledDeliveryTypes: [], useCustomPricing: true, serviceId: 'svc-1',
    });
    mockPrisma.serviceBookingConfig.findMany.mockResolvedValue([
      { deliveryType: 'IN_PERSON', price: 10000, durationMins: 60 },
    ]);
    mockPrisma.service.findUnique.mockResolvedValue(VISIBLE_SERVICE);
    mockPrisma.serviceDurationOption.findMany.mockResolvedValue([]); // no owned rows
    const result = await handler.execute({ serviceId: 'svc-1', employeeId: 'emp-1' });
    expect(result.options).toEqual([]);
    expect(result.useCustomPricing).toBe(true);
  });

  it('custom mode: returns owned options when present', async () => {
    mockPrisma.employeeService.findUnique.mockResolvedValue({
      id: 'link-1', isActive: true, disabledDeliveryTypes: [], useCustomPricing: true, serviceId: 'svc-1',
    });
    mockPrisma.serviceBookingConfig.findMany.mockResolvedValue([
      { deliveryType: 'IN_PERSON', price: 10000, durationMins: 60 },
    ]);
    mockPrisma.service.findUnique.mockResolvedValue(VISIBLE_SERVICE);
    mockPrisma.serviceDurationOption.findMany.mockResolvedValue([
      { id: 'opt-1', durationMins: 45, price: BigInt(8000), currency: 'SAR', labelAr: 'خيار 1', label: 'Option 1' },
    ]);
    const result = await handler.execute({ serviceId: 'svc-1', employeeId: 'emp-1' });
    expect(result.options).toHaveLength(1);
    expect(result.options[0].durationOptionId).toBe('opt-1');
    expect(result.options[0].price).toBe(8000);
  });

  it('inherit mode: falls back to bookingConfig when no service options', async () => {
    mockPrisma.employeeService.findUnique.mockResolvedValue({
      id: 'link-1', isActive: true, disabledDeliveryTypes: [], useCustomPricing: false, serviceId: 'svc-1',
    });
    mockPrisma.serviceBookingConfig.findMany.mockResolvedValue([
      { deliveryType: 'ONLINE', price: BigInt(5000), durationMins: 30 },
    ]);
    mockPrisma.service.findUnique.mockResolvedValue(VISIBLE_SERVICE);
    mockPrisma.serviceDurationOption.findMany.mockResolvedValue([]); // no service defaults
    const result = await handler.execute({ serviceId: 'svc-1', employeeId: 'emp-1' });
    expect(result.options).toHaveLength(1);
    expect(result.options[0].durationOptionId).toBe('');
    expect(result.options[0].deliveryType).toBe('ONLINE');
    expect(result.options[0].price).toBe(5000);
  });
});
