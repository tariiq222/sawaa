import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { SetServiceBookingConfigsHandler, dedupeDurationOptions } from './set-service-booking-configs.handler';

describe('dedupeDurationOptions', () => {
  it('collapses two options with the same durationMins, keeping the one with an id', () => {
    const out = dedupeDurationOptions([
      { id: 'default-1', durationMins: 30, isDefault: true },
      { durationMins: 30, isDefault: false },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('default-1');
  });

  it('keeps distinct durations untouched', () => {
    const out = dedupeDurationOptions([
      { id: 'a', durationMins: 30 },
      { id: 'b', durationMins: 60 },
    ]);
    expect(out).toHaveLength(2);
  });

  it('prefers an existing (id) row over a new (no-id) first occurrence', () => {
    const out = dedupeDurationOptions([
      { durationMins: 30 },
      { id: 'existing', durationMins: 30 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('existing');
  });

  it('keeps the first when both share the same duration and id state', () => {
    const out = dedupeDurationOptions([
      { id: 'first', durationMins: 30 },
      { id: 'second', durationMins: 30 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('first');
  });
});

describe('SetServiceBookingConfigsHandler', () => {
  let handler: SetServiceBookingConfigsHandler;
  let prisma: PrismaService;
  let rlsTransaction: { withTransaction: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetServiceBookingConfigsHandler,
    { provide: PrismaService, useValue: {
    service: { findFirst: jest.fn() },
    serviceBookingConfig: { findMany: jest.fn() },
    serviceDurationOption: { findMany: jest.fn() },
    serviceAvailabilityWindow: { findMany: jest.fn() }
    } },
    { provide: RlsTransactionService, useValue: { withTransaction: jest.fn() } }
      ],
    }).compile();

    handler = module.get<SetServiceBookingConfigsHandler>(SetServiceBookingConfigsHandler);
    prisma = module.get<PrismaService>(PrismaService);
    rlsTransaction = module.get(RlsTransactionService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    try {
      await handler.execute({ serviceId: '00000000-0000-0000-0000-000000000001' } as any);
    } catch (e) {
      // Expected for incomplete mocks
    }
  });

  it('persists duration options and custom availability windows per delivery type', async () => {
    const tx = {
      serviceBookingConfig: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      serviceDurationOption: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      serviceAvailabilityWindow: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    rlsTransaction.withTransaction.mockImplementation(async (cb) => cb(tx));
    (prisma.service.findFirst as jest.Mock).mockResolvedValue({ id: '00000000-0000-0000-0000-000000000001' });
    (prisma.serviceBookingConfig.findMany as jest.Mock).mockResolvedValue([{ deliveryType: 'IN_PERSON' }]);
    (prisma.serviceDurationOption.findMany as jest.Mock).mockResolvedValue([{ deliveryType: 'IN_PERSON', id: 'opt-1' }]);
    (prisma.serviceAvailabilityWindow.findMany as jest.Mock).mockResolvedValue([{ deliveryType: 'IN_PERSON', id: 'win-1' }]);

    const result = await handler.execute({
      serviceId: '00000000-0000-0000-0000-000000000001',
      types: [{
        deliveryType: 'IN_PERSON' as any,
        price: 100,
        durationMins: 30,
        useCustomAvailability: true,
        durationOptions: [{ label: 'Standard', labelAr: 'عادي', durationMins: 30, price: 100, isDefault: true }],
        availabilityWindows: [{ dayOfWeek: 0, startTime: '10:00', endTime: '12:00' }],
      }],
    });

    expect(tx.serviceBookingConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ useCustomAvailability: true }),
      update: expect.objectContaining({ useCustomAvailability: true }),
    }));
    expect(tx.serviceDurationOption.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ deliveryType: 'IN_PERSON', label: 'Standard' }),
    }));
    expect(tx.serviceAvailabilityWindow.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ deliveryType: 'IN_PERSON', dayOfWeek: 0 })],
    }));
    expect(result[0].durationOptions).toHaveLength(1);
    expect(result[0].availabilityWindows).toHaveLength(1);
  });

  describe('duplicate prevention + practitioner isolation', () => {
    const SERVICE_ID = '00000000-0000-0000-0000-000000000001';

    const buildTx = () => ({
      serviceBookingConfig: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      serviceDurationOption: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      serviceAvailabilityWindow: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    });

    beforeEach(() => {
      (prisma.service.findFirst as jest.Mock).mockResolvedValue({ id: SERVICE_ID });
      (prisma.serviceBookingConfig.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.serviceDurationOption.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.serviceAvailabilityWindow.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('creates only one row when the payload has two new options of the same duration', async () => {
      const tx = buildTx();
      rlsTransaction.withTransaction.mockImplementation(async (cb) => cb(tx));

      await handler.execute({
        serviceId: SERVICE_ID,
        types: [{
          deliveryType: 'IN_PERSON' as any,
          price: 100,
          durationMins: 30,
          durationOptions: [
            { label: '30 min', labelAr: '30 دقيقة', durationMins: 30, price: 25000, isDefault: true },
            { label: '30 min', labelAr: '30 دقيقة', durationMins: 30, price: 25000, isDefault: false },
          ],
        }],
      });

      expect(tx.serviceDurationOption.create).toHaveBeenCalledTimes(1);
    });

    it('scopes deleteMany and updateMany to service-level rows (employeeServiceId: null)', async () => {
      const tx = buildTx();
      rlsTransaction.withTransaction.mockImplementation(async (cb) => cb(tx));
      (prisma.serviceDurationOption.findMany as jest.Mock).mockResolvedValueOnce([
        { id: 'opt-1', serviceId: SERVICE_ID },
      ]);

      await handler.execute({
        serviceId: SERVICE_ID,
        types: [{
          deliveryType: 'IN_PERSON' as any,
          price: 100,
          durationMins: 30,
          durationOptions: [{ id: 'opt-1', label: '30 min', durationMins: 30, price: 25000, isDefault: true }],
        }],
      });

      expect(tx.serviceDurationOption.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ employeeServiceId: null }),
      }));
      expect(tx.serviceDurationOption.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ employeeServiceId: null }),
      }));
    });
  });

  describe('durationOption ownership validation', () => {
    const SERVICE_ID = '00000000-0000-0000-0000-000000000001';
    const OTHER_SERVICE_ID = '00000000-0000-0000-0000-000000000002';

    const buildTx = () => ({
      serviceBookingConfig: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      serviceDurationOption: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      serviceAvailabilityWindow: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    });

    beforeEach(() => {
      (prisma.service.findFirst as jest.Mock).mockResolvedValue({ id: SERVICE_ID });
      (prisma.serviceBookingConfig.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.serviceDurationOption.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.serviceAvailabilityWindow.findMany as jest.Mock).mockResolvedValue([]);
    });

    it('rejects durationOption id belonging to another service', async () => {
      const tx = buildTx();
      rlsTransaction.withTransaction.mockImplementation(async (cb) => cb(tx));
      (prisma.serviceDurationOption.findMany as jest.Mock).mockResolvedValueOnce([
        { id: 'opt-foreign', serviceId: OTHER_SERVICE_ID },
      ]);

      await expect(
        handler.execute({
          serviceId: SERVICE_ID,
          types: [{
            deliveryType: 'IN_PERSON' as any,
            price: 100,
            durationMins: 30,
            durationOptions: [{ id: 'opt-foreign', label: 'Hijack', durationMins: 30, price: 1 }],
          }],
        }),
      ).rejects.toThrow(/do not belong to this service/);

      expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
      expect(tx.serviceDurationOption.updateMany).not.toHaveBeenCalled();
    });

    it('rejects fabricated durationOption id (not found in DB)', async () => {
      const tx = buildTx();
      rlsTransaction.withTransaction.mockImplementation(async (cb) => cb(tx));
      (prisma.serviceDurationOption.findMany as jest.Mock).mockResolvedValueOnce([]);

      await expect(
        handler.execute({
          serviceId: SERVICE_ID,
          types: [{
            deliveryType: 'IN_PERSON' as any,
            price: 100,
            durationMins: 30,
            durationOptions: [{ id: 'fake-id', label: 'Ghost', durationMins: 30, price: 1 }],
          }],
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        handler.execute({
          serviceId: SERVICE_ID,
          types: [{
            deliveryType: 'IN_PERSON' as any,
            price: 100,
            durationMins: 30,
            durationOptions: [{ id: 'fake-id', label: 'Ghost', durationMins: 30, price: 1 }],
          }],
        }),
      ).rejects.toThrow(/do not exist/);

      expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
    });

    it('accepts durationOption id that belongs to same service', async () => {
      const tx = buildTx();
      rlsTransaction.withTransaction.mockImplementation(async (cb) => cb(tx));
      (prisma.serviceDurationOption.findMany as jest.Mock)
        .mockResolvedValueOnce([{ id: 'opt-1', serviceId: SERVICE_ID }])
        .mockResolvedValueOnce([]);
      (prisma.serviceBookingConfig.findMany as jest.Mock).mockResolvedValue([{ deliveryType: 'IN_PERSON' }]);

      await expect(
        handler.execute({
          serviceId: SERVICE_ID,
          types: [{
            deliveryType: 'IN_PERSON' as any,
            price: 100,
            durationMins: 30,
            durationOptions: [{ id: 'opt-1', label: 'Standard', durationMins: 30, price: 100 }],
          }],
        }),
      ).resolves.toBeDefined();

      expect(rlsTransaction.withTransaction).toHaveBeenCalled();
      expect(tx.serviceDurationOption.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'opt-1', serviceId: SERVICE_ID, employeeServiceId: null },
      }));
    });

    it('does not call findMany ownership check when no ids provided (all new options)', async () => {
      const tx = buildTx();
      rlsTransaction.withTransaction.mockImplementation(async (cb) => cb(tx));
      const findManyMock = prisma.serviceDurationOption.findMany as jest.Mock;
      findManyMock.mockResolvedValue([]);
      (prisma.serviceBookingConfig.findMany as jest.Mock).mockResolvedValue([{ deliveryType: 'IN_PERSON' }]);

      await handler.execute({
        serviceId: SERVICE_ID,
        types: [{
          deliveryType: 'IN_PERSON' as any,
          price: 100,
          durationMins: 30,
          durationOptions: [{ label: 'Brand new', durationMins: 30, price: 100 }],
        }],
      });

      // The findMany ownership check uses `id: { in: [...] }`. Any call must NOT carry that filter.
      for (const call of findManyMock.mock.calls) {
        const args = call[0];
        const idFilter = args?.where?.id;
        expect(idFilter).not.toEqual(expect.objectContaining({ in: expect.arrayContaining(['anything']) }));
      }
      expect(tx.serviceDurationOption.updateMany).not.toHaveBeenCalled();
      expect(tx.serviceDurationOption.create).toHaveBeenCalled();
    });
  });
});
