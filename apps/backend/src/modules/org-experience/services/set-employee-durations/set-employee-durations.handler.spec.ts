import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SetEmployeeDurationsHandler, resolveEffectiveDurations } from './set-employee-durations.handler';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';

describe('SetEmployeeDurationsHandler', () => {
  let handler: SetEmployeeDurationsHandler;
  let prisma: any;
  let txMock: any;
  let rlsTransaction: any;

  const employeeId = 'emp-uuid';
  const serviceId = 'svc-uuid';
  const linkId = 'link-uuid';

  beforeEach(async () => {
    txMock = {
      serviceBookingConfig: { findFirst: jest.fn() },
      serviceDurationOption: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
    };

    rlsTransaction = {
      withTransaction: jest.fn().mockImplementation(async (fn: any) => fn(txMock)),
    };

    prisma = {
      employeeService: { findUnique: jest.fn() },
      serviceDurationOption: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetEmployeeDurationsHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: rlsTransaction },
      ],
    }).compile();

    handler = module.get<SetEmployeeDurationsHandler>(SetEmployeeDurationsHandler);
  });

  describe('execute', () => {
    it('throws NotFoundException when employee-service link not found', async () => {
      prisma.employeeService.findUnique.mockResolvedValue(null);

      await expect(
        handler.execute({ employeeId, serviceId, durations: [] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when deliveryType has no active ServiceBookingConfig', async () => {
      prisma.employeeService.findUnique.mockResolvedValue({ id: linkId });
      txMock.serviceBookingConfig.findFirst.mockResolvedValue(null);

      await expect(
        handler.execute({
          employeeId,
          serviceId,
          durations: [{ deliveryType: 'IN_PERSON', items: [{ label: 'A', labelAr: 'أ', durationMins: 60, price: 10000 }] }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates new rows for a deliveryType when none exist', async () => {
      prisma.employeeService.findUnique.mockResolvedValue({ id: linkId });
      txMock.serviceBookingConfig.findFirst.mockResolvedValue({ id: 'cfg-1' });
      txMock.serviceDurationOption.create.mockResolvedValue({ id: 'new-opt' });
      txMock.serviceDurationOption.updateMany.mockResolvedValue({ count: 0 });
      // buildResult
      prisma.serviceDurationOption.findMany
        .mockResolvedValueOnce([]) // service defaults
        .mockResolvedValueOnce([{ id: 'new-opt', deliveryType: 'IN_PERSON', label: 'A', labelAr: 'أ', durationMins: 60, price: 10000 }]); // owned

      await handler.execute({
        employeeId,
        serviceId,
        durations: [{ deliveryType: 'IN_PERSON', items: [{ label: 'A', labelAr: 'أ', durationMins: 60, price: 10000 }] }],
      });

      expect(txMock.serviceDurationOption.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            serviceId,
            deliveryType: 'IN_PERSON',
            employeeServiceId: linkId,
            label: 'A',
            labelAr: 'أ',
            durationMins: 60,
            price: 10000,
            currency: 'SAR',
            isActive: true,
          }),
        }),
      );
    });

    it('updates existing rows when id is provided', async () => {
      const existingId = 'existing-opt';
      prisma.employeeService.findUnique.mockResolvedValue({ id: linkId });
      txMock.serviceBookingConfig.findFirst.mockResolvedValue({ id: 'cfg-1' });
      txMock.serviceDurationOption.findFirst.mockResolvedValue({ id: existingId });
      txMock.serviceDurationOption.update.mockResolvedValue({ id: existingId });
      txMock.serviceDurationOption.updateMany.mockResolvedValue({ count: 0 });
      prisma.serviceDurationOption.findMany
        .mockResolvedValueOnce([]) // service defaults
        .mockResolvedValueOnce([]); // owned

      await handler.execute({
        employeeId,
        serviceId,
        durations: [{ deliveryType: 'IN_PERSON', items: [{ id: existingId, label: 'Updated', labelAr: 'محدّث', durationMins: 45, price: 20000 }] }],
      });

      expect(txMock.serviceDurationOption.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: existingId },
          data: expect.objectContaining({ label: 'Updated', durationMins: 45, price: 20000 }),
        }),
      );
    });

    it('soft-deactivates omitted rows for a deliveryType', async () => {
      const keptId = 'kept-opt';
      const droppedId = 'dropped-opt';
      prisma.employeeService.findUnique.mockResolvedValue({ id: linkId });
      txMock.serviceBookingConfig.findFirst.mockResolvedValue({ id: 'cfg-1' });
      // findFirst for the keptId row
      txMock.serviceDurationOption.findFirst.mockResolvedValue({ id: keptId });
      txMock.serviceDurationOption.update.mockResolvedValue({ id: keptId });
      txMock.serviceDurationOption.updateMany.mockResolvedValue({ count: 1 });
      prisma.serviceDurationOption.findMany
        .mockResolvedValueOnce([]) // service defaults
        .mockResolvedValueOnce([]); // owned

      await handler.execute({
        employeeId,
        serviceId,
        durations: [{ deliveryType: 'IN_PERSON', items: [{ id: keptId, label: 'K', labelAr: 'ك', durationMins: 30, price: 5000 }] }],
      });

      // updateMany called to deactivate rows not in keepIds
      expect(txMock.serviceDurationOption.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { notIn: [keptId] },
            employeeServiceId: linkId,
            isActive: true,
          }),
          data: { isActive: false },
        }),
      );
      void droppedId; // referenced to avoid lint warning
    });

    it('soft-deactivates all owned rows when items=[] (reverts to inherit)', async () => {
      prisma.employeeService.findUnique.mockResolvedValue({ id: linkId });
      txMock.serviceBookingConfig.findFirst.mockResolvedValue({ id: 'cfg-1' });
      txMock.serviceDurationOption.updateMany.mockResolvedValue({ count: 2 });
      prisma.serviceDurationOption.findMany
        .mockResolvedValueOnce([{ id: 'default-opt', deliveryType: 'IN_PERSON', label: 'Default', labelAr: 'افتراضي', durationMins: 60, price: 25000 }]) // service defaults
        .mockResolvedValueOnce([]); // owned (now empty after deactivate)

      await handler.execute({
        employeeId,
        serviceId,
        durations: [{ deliveryType: 'IN_PERSON', items: [] }],
      });

      expect(txMock.serviceDurationOption.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            serviceId,
            deliveryType: 'IN_PERSON',
            employeeServiceId: linkId,
            isActive: true,
          }),
          data: { isActive: false },
        }),
      );
    });

    it('throws BadRequestException when id does not belong to this practitioner', async () => {
      prisma.employeeService.findUnique.mockResolvedValue({ id: linkId });
      txMock.serviceBookingConfig.findFirst.mockResolvedValue({ id: 'cfg-1' });
      // findFirst returns null → row not found for this employee
      txMock.serviceDurationOption.findFirst.mockResolvedValue(null);

      await expect(
        handler.execute({
          employeeId,
          serviceId,
          durations: [{ deliveryType: 'IN_PERSON', items: [{ id: 'other-opt', label: 'X', labelAr: 'X', durationMins: 30, price: 5000 }] }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

describe('resolveEffectiveDurations', () => {
  const makeRow = (id: string, dt: string, label: string, price: number) => ({
    id, deliveryType: dt, label, labelAr: label, durationMins: 60, price,
  });

  it('returns service defaults with isInherited=true when no owned rows', () => {
    const defaults = [makeRow('d1', 'IN_PERSON', 'Default', 10000)];
    const result = resolveEffectiveDurations(defaults, []);

    expect(result).toHaveLength(1);
    expect(result[0].deliveryType).toBe('IN_PERSON');
    expect(result[0].durations[0].isInherited).toBe(true);
    expect(result[0].durations[0].id).toBe('d1');
  });

  it('returns owned rows with isInherited=false when employee has own rows', () => {
    const defaults = [makeRow('d1', 'IN_PERSON', 'Default', 10000)];
    const owned = [makeRow('o1', 'IN_PERSON', 'Custom', 20000)];
    const result = resolveEffectiveDurations(defaults, owned);

    expect(result[0].durations[0].isInherited).toBe(false);
    expect(result[0].durations[0].id).toBe('o1');
    expect(result[0].durations[0].price).toBe(20000);
  });

  it('handles different deliveryTypes independently', () => {
    const defaults = [
      makeRow('d1', 'IN_PERSON', 'Default IP', 10000),
      makeRow('d2', 'ONLINE', 'Default OL', 8000),
    ];
    const owned = [makeRow('o1', 'IN_PERSON', 'Custom IP', 15000)];
    const result = resolveEffectiveDurations(defaults, owned);

    const inPersonGroup = result.find((r) => r.deliveryType === 'IN_PERSON')!;
    const onlineGroup = result.find((r) => r.deliveryType === 'ONLINE')!;

    expect(inPersonGroup.durations[0].isInherited).toBe(false);
    expect(inPersonGroup.durations[0].id).toBe('o1');

    expect(onlineGroup.durations[0].isInherited).toBe(true);
    expect(onlineGroup.durations[0].id).toBe('d2');
  });

  it('converts price to number', () => {
    const defaults = [{ id: 'd1', deliveryType: 'IN_PERSON', label: 'A', labelAr: 'أ', durationMins: 60, price: '30000.00' as any }];
    const result = resolveEffectiveDurations(defaults, []);
    expect(typeof result[0].durations[0].price).toBe('number');
    expect(result[0].durations[0].price).toBe(30000);
  });
});
