import { PriceResolverService } from './price-resolver.service';

const mockService = { id: 'svc-1', price: 200, durationMins: 60, currency: 'SAR' };
const mockDurationOption = { id: 'opt-1', serviceId: 'svc-1', price: 250, durationMins: 45, isDefault: true, bookingType: 'INDIVIDUAL' as const, currency: 'SAR', isActive: true };
const mockEmployeeServiceOption = { employeeServiceId: 'es-1', durationOptionId: 'opt-1', priceOverride: 300, durationOverride: 50, isActive: true };

const buildPrisma = (overrides: Partial<{
  service: unknown; durationOption: unknown; employeeServiceOption: unknown;
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
});
