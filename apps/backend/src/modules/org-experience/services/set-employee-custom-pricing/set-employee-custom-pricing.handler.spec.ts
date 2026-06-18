import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { SetEmployeeCustomPricingHandler } from './set-employee-custom-pricing.handler';

const EMPLOYEE_ID = '00000000-0000-0000-0000-000000000001';
const SERVICE_ID  = '00000000-0000-0000-0000-000000000002';
const LINK_ID     = 'link-uuid-1';
const ANCHOR_ID   = 'anchor-uuid-1';

function makeMockTx() {
  return {
    serviceBookingConfig: { findFirst: jest.fn().mockResolvedValue(null) },
    serviceDurationOption: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: ANCHOR_ID, durationMins: 60, price: 25000 }),
    },
    employeeServiceOption: {
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('SetEmployeeCustomPricingHandler', () => {
  let handler: SetEmployeeCustomPricingHandler;
  let prisma: jest.Mocked<any>;
  let rlsTransaction: jest.Mocked<any>;
  let mockTx: ReturnType<typeof makeMockTx>;

  beforeEach(async () => {
    mockTx = makeMockTx();

    prisma = {
      employeeService: { findUnique: jest.fn() },
      employeeServiceOption: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({}),
      },
    };

    rlsTransaction = {
      withTransaction: jest.fn().mockImplementation((cb: Function) => cb(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetEmployeeCustomPricingHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: rlsTransaction },
      ],
    }).compile();

    handler = module.get<SetEmployeeCustomPricingHandler>(SetEmployeeCustomPricingHandler);
  });

  // ── Test 1 ─────────────────────────────────────────────────────────────────
  it('throws NotFoundException when the employee-service link does not exist', async () => {
    prisma.employeeService.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute({
        employeeId: EMPLOYEE_ID,
        serviceId: SERVICE_ID,
        enabled: true,
        types: [{ deliveryType: 'IN_PERSON', price: 30000, durationMins: 60 }],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Test 2 ─────────────────────────────────────────────────────────────────
  it('enabled=true with no existing anchor creates anchor and upserts option, returns hasCustomPricing=true', async () => {
    prisma.employeeService.findUnique.mockResolvedValue({ id: LINK_ID });
    // buildResult sees one active option with overrides
    prisma.employeeServiceOption.findMany.mockResolvedValue([
      {
        isActive: true,
        deliveryType: 'IN_PERSON',
        priceOverride: 30000,
        durationOverride: 60,
        employeeServiceId: LINK_ID,
        durationOption: { price: 25000, durationMins: 50 },
      },
    ]);

    const result = await handler.execute({
      employeeId: EMPLOYEE_ID,
      serviceId: SERVICE_ID,
      enabled: true,
      types: [{ deliveryType: 'IN_PERSON', price: 30000, durationMins: 60 }],
    });

    // anchor was created because findFirst returned null
    expect(mockTx.serviceDurationOption.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ serviceId: SERVICE_ID, isActive: true }) }),
    );
    // upsert was called with the new anchor
    expect(mockTx.employeeServiceOption.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ priceOverride: 30000, durationOverride: 60 }),
      }),
    );
    expect(result.hasCustomPricing).toBe(true);
    expect(result.serviceTypes).toHaveLength(1);
    expect(result.serviceTypes[0].price).toBe(30000);
    expect(result.serviceTypes[0].isCustom).toBe(true);
  });

  // ── Test 3 ─────────────────────────────────────────────────────────────────
  it('enabled=false deactivates all options and returns hasCustomPricing=false with empty serviceTypes', async () => {
    prisma.employeeService.findUnique.mockResolvedValue({ id: LINK_ID });
    // After deactivation, buildResult sees no active options
    prisma.employeeServiceOption.findMany.mockResolvedValue([
      {
        isActive: false,
        deliveryType: 'IN_PERSON',
        priceOverride: null,
        durationOverride: null,
        employeeServiceId: LINK_ID,
        durationOption: { price: 25000, durationMins: 50 },
      },
    ]);

    const result = await handler.execute({
      employeeId: EMPLOYEE_ID,
      serviceId: SERVICE_ID,
      enabled: false,
      types: [],
    });

    expect(mockTx.employeeServiceOption.updateMany).toHaveBeenCalledWith({
      where: { employeeServiceId: LINK_ID },
      data: { isActive: false },
    });
    expect(result.hasCustomPricing).toBe(false);
    expect(result.serviceTypes).toHaveLength(0);
  });

  // ── Test 4 ─────────────────────────────────────────────────────────────────
  it('sending only one deliveryType deactivates options for other types via notIn', async () => {
    prisma.employeeService.findUnique.mockResolvedValue({ id: LINK_ID });
    prisma.employeeServiceOption.findMany.mockResolvedValue([]);

    await handler.execute({
      employeeId: EMPLOYEE_ID,
      serviceId: SERVICE_ID,
      enabled: true,
      types: [{ deliveryType: 'IN_PERSON', price: 30000, durationMins: 60 }],
    });

    // The final updateMany inside the transaction should exclude IN_PERSON
    const updateManyCall = mockTx.employeeServiceOption.updateMany.mock.calls[0][0];
    expect(updateManyCall.where.deliveryType.notIn).toContain('IN_PERSON');
    expect(updateManyCall.data).toEqual({ isActive: false });
  });
});
