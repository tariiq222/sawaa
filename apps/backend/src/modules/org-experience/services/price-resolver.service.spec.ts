import { PriceResolverService } from './price-resolver.service';

const mockService = { id: 'svc-1', price: 200, durationMins: 60, currency: 'SAR' };
const mockDurationOption = { id: 'opt-1', serviceId: 'svc-1', price: 250, durationMins: 45, isDefault: true, deliveryType: 'IN_PERSON' as const, currency: 'SAR', isActive: true };
const mockEmployeeServiceOption = { employeeServiceId: 'es-1', durationOptionId: 'opt-1', priceOverride: 300, durationOverride: 50, isActive: true };

const buildPrisma = (overrides: Partial<{
  service: unknown; durationOption: unknown; employeeServiceOption: unknown; serviceBookingConfig: unknown;
}> = {}) => ({
  service: {
    findUniqueOrThrow: jest.fn().mockResolvedValue(overrides.service ?? mockService),
  },
  serviceDurationOption: {
    findFirst: jest.fn().mockResolvedValue(overrides.durationOption ?? mockDurationOption),
  },
  employeeServiceOption: {
    findFirst: jest.fn().mockResolvedValue(overrides.employeeServiceOption ?? null),
  },
  serviceBookingConfig: {
    findFirst: jest.fn().mockResolvedValue(overrides.serviceBookingConfig ?? null),
  },
});

describe('PriceResolverService', () => {
  it('returns catalog option price when no employee override', async () => {
    const prisma = buildPrisma();
    const service = new PriceResolverService(prisma as never);

    const result = await service.resolve({
      serviceId: 'svc-1',
      employeeServiceId: null, durationOptionId: 'opt-1',
    });

    expect(result.price).toBe(250);
    expect(result.durationMins).toBe(45);
    expect(result.isEmployeeOverride).toBe(false);
  });

  it('returns employee override price when available', async () => {
    const prisma = buildPrisma({ employeeServiceOption: mockEmployeeServiceOption });
    const service = new PriceResolverService(prisma as never);

    const result = await service.resolve({
      serviceId: 'svc-1',
      employeeServiceId: 'es-1', durationOptionId: 'opt-1',
    });

    expect(result.price).toBe(300);
    expect(result.durationMins).toBe(50);
    expect(result.isEmployeeOverride).toBe(true);
  });

  it('falls back to service-level price when no duration option exists', async () => {
    const prisma = buildPrisma();
    prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue(null);
    const service = new PriceResolverService(prisma as never);

    const result = await service.resolve({
      serviceId: 'svc-1',
      employeeServiceId: null, durationOptionId: null,
    });

    expect(result.price).toBe(200);
    expect(result.durationMins).toBe(60);
    expect(result.isEmployeeOverride).toBe(false);
  });

  it('includes durationOptionId and currency in result', async () => {
    const prisma = buildPrisma();
    const service = new PriceResolverService(prisma as never);

    const result = await service.resolve({
      serviceId: 'svc-1',
      employeeServiceId: null, durationOptionId: 'opt-1',
    });

    expect(result.durationOptionId).toBe('opt-1');
    expect(result.currency).toBe('SAR');
  });

  // ─── DeliveryType-aware resolution (TDD — refactor-booking-delivery-type) ───

  it('filters duration options by deliveryType when provided', async () => {
    const prisma = buildPrisma();
    prisma.serviceDurationOption.findFirst = jest
      .fn()
      .mockResolvedValueOnce(null) // no exact match
      .mockResolvedValueOnce({ id: 'opt-online', price: 300, durationMins: 60, currency: 'SAR' });
    const service = new PriceResolverService(prisma as never);

    const result = await service.resolve({
      serviceId: 'svc-1',
      employeeServiceId: null,
      durationOptionId: null,
      bookingType: 'INDIVIDUAL',
      deliveryType: 'ONLINE',
    });

    expect(prisma.serviceDurationOption.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ serviceId: 'svc-1', deliveryType: 'ONLINE', isDefault: true, isActive: true }),
      }),
    );
    expect(result.price).toBe(300);
    expect(result.durationMins).toBe(60);
  });

  it('filters employee override by deliveryType when provided', async () => {
    const prisma = buildPrisma({
      durationOption: { ...mockDurationOption, deliveryType: 'ONLINE' },
      employeeServiceOption: { employeeServiceId: 'es-1', durationOptionId: 'opt-1', priceOverride: 350, durationOverride: 55, isActive: true, deliveryType: 'ONLINE' },
    });
    const service = new PriceResolverService(prisma as never);

    const result = await service.resolve({
      serviceId: 'svc-1',
      employeeServiceId: 'es-1',
      durationOptionId: 'opt-1',
      deliveryType: 'ONLINE',
    });

    expect(prisma.employeeServiceOption.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employeeServiceId: 'es-1', durationOptionId: 'opt-1', isActive: true, deliveryType: 'ONLINE' }),
      }),
    );
    expect(result.price).toBe(350);
    expect(result.isEmployeeOverride).toBe(true);
  });

  it('falls back to service base price when no duration option matches deliveryType', async () => {
    const prisma = buildPrisma();
    prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue(null);
    const service = new PriceResolverService(prisma as never);

    const result = await service.resolve({
      serviceId: 'svc-1',
      employeeServiceId: null,
      durationOptionId: null,
      deliveryType: 'ONLINE',
    });

    expect(result.price).toBe(200);
    expect(result.durationMins).toBe(60);
    expect(result.isEmployeeOverride).toBe(false);
  });

  it('rejects durationOptionId that does not match deliveryType', async () => {
    const prisma = buildPrisma();
    prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue({
      id: 'opt-1',
      serviceId: 'svc-1',
      price: 250,
      durationMins: 45,
      currency: 'SAR',
      isActive: true,
      deliveryType: 'IN_PERSON',
    });
    const service = new PriceResolverService(prisma as never);

    await expect(
      service.resolve({
        serviceId: 'svc-1',
        employeeServiceId: null,
        durationOptionId: 'opt-1',
        deliveryType: 'ONLINE',
      }),
    ).rejects.toThrow(/does not match requested delivery type/);
  });

  it('uses employee override price before duration option price for matching deliveryType', async () => {
    const prisma = buildPrisma({
      durationOption: { ...mockDurationOption, deliveryType: 'ONLINE' },
      employeeServiceOption: { employeeServiceId: 'es-1', durationOptionId: 'opt-1', priceOverride: 400, durationOverride: null, isActive: true, deliveryType: 'ONLINE' },
    });
    const service = new PriceResolverService(prisma as never);

    const result = await service.resolve({
      serviceId: 'svc-1',
      employeeServiceId: 'es-1',
      durationOptionId: 'opt-1',
      deliveryType: 'ONLINE',
    });

    expect(result.price).toBe(400);
    expect(result.durationMins).toBe(45); // from duration option
    expect(result.isEmployeeOverride).toBe(true);
  });

  it('uses duration option price before service base price when deliveryType matches', async () => {
    const prisma = buildPrisma();
    const service = new PriceResolverService(prisma as never);

    const result = await service.resolve({
      serviceId: 'svc-1',
      employeeServiceId: null,
      durationOptionId: 'opt-1',
      deliveryType: 'IN_PERSON',
    });

    expect(result.price).toBe(250);
    expect(result.durationMins).toBe(45);
    expect(result.isEmployeeOverride).toBe(false);
  });

  // ─── ServiceBookingConfig priority (P0 bug fix) ───

  it('uses ServiceBookingConfig price when no duration option exists but config is active', async () => {
    const mockBookingConfig = { price: 300, durationMins: 50 };
    const prisma = buildPrisma({ serviceBookingConfig: mockBookingConfig });
    prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue(null);
    const service = new PriceResolverService(prisma as never);

    const result = await service.resolve({
      serviceId: 'svc-1',
      employeeServiceId: null,
      durationOptionId: null,
      deliveryType: 'IN_PERSON',
    });

    expect(prisma.serviceBookingConfig.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ serviceId: 'svc-1', deliveryType: 'IN_PERSON', isActive: true }),
      }),
    );
    expect(result.price).toBe(300);
    expect(result.durationMins).toBe(50);
    expect(result.isEmployeeOverride).toBe(false);
    expect(result.durationOptionId).toBe('');
    expect(result.currency).toBe('SAR');
  });

  it('falls back to Service.price when no duration option and no booking config', async () => {
    const prisma = buildPrisma({ serviceBookingConfig: null });
    prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue(null);
    const service = new PriceResolverService(prisma as never);

    const result = await service.resolve({
      serviceId: 'svc-1',
      employeeServiceId: null,
      durationOptionId: null,
      deliveryType: 'IN_PERSON',
    });

    expect(result.price).toBe(200); // from mockService
    expect(result.durationMins).toBe(60);
    expect(result.isEmployeeOverride).toBe(false);
  });

  it('skips ServiceBookingConfig lookup when deliveryType is not provided', async () => {
    const prisma = buildPrisma({ serviceBookingConfig: { price: 999, durationMins: 99 } });
    prisma.serviceDurationOption.findFirst = jest.fn().mockResolvedValue(null);
    const service = new PriceResolverService(prisma as never);

    const result = await service.resolve({
      serviceId: 'svc-1',
      employeeServiceId: null,
      durationOptionId: null,
      // deliveryType intentionally omitted
    });

    expect(prisma.serviceBookingConfig.findFirst).not.toHaveBeenCalled();
    expect(result.price).toBe(200); // falls straight to Service.price
    expect(result.durationMins).toBe(60);
  });
});
