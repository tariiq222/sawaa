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

  // ── INHERIT mode (useCustomPricing = false) ──────────────────────────────────

  describe('INHERIT mode', () => {
    it('top-level price/duration matches the default service option when price differs from config', async () => {
      prisma.employeeService.findFirst.mockResolvedValue({ id: 'link-1', useCustomPricing: false });
      prisma.serviceBookingConfig.findMany.mockResolvedValue([
        { id: 'c1', serviceId: 's1', deliveryType: 'IN_PERSON', price: 999, durationMins: 999, isActive: true },
      ]);
      // service-default options: employeeServiceId = null
      prisma.serviceDurationOption.findMany.mockResolvedValue([
        { id: 'd1', serviceId: 's1', deliveryType: 'IN_PERSON', durationMins: 30, price: 200, label: '30 min', labelAr: '٣٠ دقيقة', isDefault: true, sortOrder: 1, isActive: true, employeeServiceId: null },
        { id: 'd2', serviceId: 's1', deliveryType: 'IN_PERSON', durationMins: 60, price: 350, label: '60 min', labelAr: '٦٠ دقيقة', isDefault: false, sortOrder: 2, isActive: true, employeeServiceId: null },
      ]);
      prisma.employeeServiceOption.findMany.mockResolvedValue([]);

      const result = await handler.execute({ employeeId: 'e1', serviceId: 's1' });
      expect(result).toHaveLength(1);
      // Top-level price/duration must reflect the default option, NOT cfg.price (999)
      expect(result[0].price).toBe(200);
      expect(result[0].duration).toBe(30);
      // durationOptions list still carries both entries
      expect(result[0].durationOptions).toHaveLength(2);
    });

    it('top-level price/duration applies employee priceOverride/durationOverride on the default option', async () => {
      prisma.employeeService.findFirst.mockResolvedValue({ id: 'link-1', useCustomPricing: false });
      prisma.serviceBookingConfig.findMany.mockResolvedValue([
        { id: 'c1', serviceId: 's1', deliveryType: 'IN_PERSON', price: 999, durationMins: 999, isActive: true },
      ]);
      prisma.serviceDurationOption.findMany.mockResolvedValue([
        { id: 'd1', serviceId: 's1', deliveryType: 'IN_PERSON', durationMins: 30, price: 200, label: '30 min', labelAr: '٣٠ دقيقة', isDefault: true, sortOrder: 1, isActive: true, employeeServiceId: null },
        { id: 'd2', serviceId: 's1', deliveryType: 'IN_PERSON', durationMins: 60, price: 350, label: '60 min', labelAr: '٦٠ دقيقة', isDefault: false, sortOrder: 2, isActive: true, employeeServiceId: null },
      ]);
      // Employee override on the default option (d1)
      prisma.employeeServiceOption.findMany.mockResolvedValue([
        { durationOptionId: 'd1', priceOverride: 180, durationOverride: 35 },
      ]);

      const result = await handler.execute({ employeeId: 'e1', serviceId: 's1' });
      expect(result).toHaveLength(1);
      // Top-level price/duration must be the override values
      expect(result[0].price).toBe(180);
      expect(result[0].duration).toBe(35);
      // The individual durationOption entry also reflects the override
      expect(result[0].durationOptions[0].price).toBe(180);
      expect(result[0].durationOptions[0].durationMinutes).toBe(35);
      // Non-overridden option unchanged
      expect(result[0].durationOptions[1].price).toBe(350);
      expect(result[0].durationOptions[1].durationMinutes).toBe(60);
    });

    it('falls back to cfg.price/durationMins when no service-default option exists', async () => {
      prisma.employeeService.findFirst.mockResolvedValue({ id: 'link-1', useCustomPricing: false });
      prisma.serviceBookingConfig.findMany.mockResolvedValue([
        { id: 'c1', serviceId: 's1', deliveryType: 'IN_PERSON', price: 100, durationMins: 30, isActive: true },
      ]);
      // No duration options at all
      prisma.serviceDurationOption.findMany.mockResolvedValue([]);
      prisma.employeeServiceOption.findMany.mockResolvedValue([]);

      const result = await handler.execute({ employeeId: 'e1', serviceId: 's1' });
      expect(result).toHaveLength(1);
      // Must fall back to config values
      expect(result[0].price).toBe(100);
      expect(result[0].duration).toBe(30);
      expect(result[0].durationOptions).toHaveLength(0);
    });

    it('uses scoped[0] (non-default) when no option has isDefault=true', async () => {
      prisma.employeeService.findFirst.mockResolvedValue({ id: 'link-1', useCustomPricing: false });
      prisma.serviceBookingConfig.findMany.mockResolvedValue([
        { id: 'c1', serviceId: 's1', deliveryType: 'IN_PERSON', price: 999, durationMins: 999, isActive: true },
      ]);
      prisma.serviceDurationOption.findMany.mockResolvedValue([
        { id: 'd1', serviceId: 's1', deliveryType: 'IN_PERSON', durationMins: 45, price: 250, label: '45 min', labelAr: '٤٥ دقيقة', isDefault: false, sortOrder: 1, isActive: true, employeeServiceId: null },
      ]);
      prisma.employeeServiceOption.findMany.mockResolvedValue([]);

      const result = await handler.execute({ employeeId: 'e1', serviceId: 's1' });
      // No isDefault → scoped[0] is used
      expect(result[0].price).toBe(250);
      expect(result[0].duration).toBe(45);
    });
  });

  // ── CUSTOM mode (useCustomPricing = true) ────────────────────────────────────

  describe('CUSTOM mode', () => {
    it('top-level price/duration uses owned default option, no overrides applied', async () => {
      prisma.employeeService.findFirst.mockResolvedValue({ id: 'link-1', useCustomPricing: true });
      prisma.serviceBookingConfig.findMany.mockResolvedValue([
        { id: 'c1', serviceId: 's1', deliveryType: 'IN_PERSON', price: 999, durationMins: 999, isActive: true },
      ]);
      // Owned options: employeeServiceId = link-1
      prisma.serviceDurationOption.findMany.mockResolvedValue([
        { id: 'od1', serviceId: 's1', deliveryType: 'IN_PERSON', durationMins: 40, price: 300, label: '40 min', labelAr: '٤٠ دقيقة', isDefault: true, sortOrder: 1, isActive: true, employeeServiceId: 'link-1' },
      ]);
      // Override present — should be IGNORED in custom mode
      prisma.employeeServiceOption.findMany.mockResolvedValue([
        { durationOptionId: 'od1', priceOverride: 9999, durationOverride: 9999 },
      ]);

      const result = await handler.execute({ employeeId: 'e1', serviceId: 's1' });
      expect(result).toHaveLength(1);
      // Custom mode: owned option price, overrides NOT applied
      expect(result[0].price).toBe(300);
      expect(result[0].duration).toBe(40);
    });

    it('falls back to cfg.price/durationMins when no owned option exists in custom mode', async () => {
      prisma.employeeService.findFirst.mockResolvedValue({ id: 'link-1', useCustomPricing: true });
      prisma.serviceBookingConfig.findMany.mockResolvedValue([
        { id: 'c1', serviceId: 's1', deliveryType: 'IN_PERSON', price: 150, durationMins: 60, isActive: true },
      ]);
      // No owned options
      prisma.serviceDurationOption.findMany.mockResolvedValue([]);
      prisma.employeeServiceOption.findMany.mockResolvedValue([]);

      const result = await handler.execute({ employeeId: 'e1', serviceId: 's1' });
      expect(result[0].price).toBe(150);
      expect(result[0].duration).toBe(60);
    });
  });

  // ── Existing behaviour tests (preserved) ────────────────────────────────────

  it('returns mapped configs with duration options and applies overrides on durationOptions list', async () => {
    prisma.employeeService.findFirst.mockResolvedValue({ id: 'link-1', useCustomPricing: false });
    prisma.serviceBookingConfig.findMany.mockResolvedValue([
      { id: 'c1', serviceId: 's1', deliveryType: 'IN_PERSON', price: 100, durationMins: 30, isActive: true },
    ]);
    prisma.serviceDurationOption.findMany.mockResolvedValue([
      { id: 'd1', serviceId: 's1', deliveryType: 'IN_PERSON', durationMins: 30, price: 100, label: '30 min', labelAr: '٣٠ دقيقة', isDefault: true, sortOrder: 1, isActive: true, employeeServiceId: null },
      { id: 'd2', serviceId: 's1', deliveryType: 'IN_PERSON', durationMins: 60, price: 150, label: '60 min', labelAr: '٦٠ دقيقة', isDefault: false, sortOrder: 2, isActive: true, employeeServiceId: null },
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
    prisma.employeeService.findFirst.mockResolvedValue({ id: 'link-1', useCustomPricing: false });
    prisma.serviceBookingConfig.findMany.mockResolvedValue([
      { id: 'c1', serviceId: 's1', deliveryType: 'IN_PERSON', price: 100, durationMins: 30, isActive: true },
      { id: 'c2', serviceId: 's1', deliveryType: 'ONLINE', price: 50, durationMins: 15, isActive: true },
    ]);
    prisma.serviceDurationOption.findMany.mockResolvedValue([
      { id: 'd1', serviceId: 's1', deliveryType: 'IN_PERSON', durationMins: 30, price: 100, label: '30 min', labelAr: null, isDefault: true, sortOrder: 1, isActive: true, employeeServiceId: null },
    ]);
    prisma.employeeServiceOption.findMany.mockResolvedValue([]);

    const result = await handler.execute({ employeeId: 'e1', serviceId: 's1' });
    expect(result).toHaveLength(2);
    expect(result[0].durationOptions).toHaveLength(1);
    expect(result[1].durationOptions).toHaveLength(0); // ONLINE has no matching duration option
  });
});
