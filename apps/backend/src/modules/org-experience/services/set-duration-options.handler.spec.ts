import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SetDurationOptionsHandler } from './set-duration-options.handler';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';

describe('SetDurationOptionsHandler', () => {
  let handler: SetDurationOptionsHandler;
  let prisma: any;
  let txMock: any;

  beforeEach(async () => {
    txMock = {
      serviceDurationOption: { update: jest.fn(), create: jest.fn() },
    };
    prisma = {
      service: { findFirst: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(txMock)),
      serviceDurationOption: { findMany: jest.fn() },
    };

    const rlsTransaction = { withTransaction: jest.fn().mockImplementation(async (fn: any) => fn(txMock)) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [SetDurationOptionsHandler, { provide: PrismaService, useValue: prisma }, { provide: RlsTransactionService, useValue: rlsTransaction }],
    }).compile();

    handler = module.get<SetDurationOptionsHandler>(SetDurationOptionsHandler);
  });

  it('should throw NotFoundException when service not found', async () => {
    prisma.service.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ serviceId: 'missing', options: [] })).rejects.toThrow(NotFoundException);
  });

  it('should update existing option', async () => {
    prisma.service.findFirst.mockResolvedValue({ id: 'svc-1' });
    txMock.serviceDurationOption.update.mockResolvedValue({ id: 'opt-1' });
    prisma.serviceDurationOption.findMany.mockResolvedValue([{ id: 'opt-1' }]);

    const result = await handler.execute({
      serviceId: 'svc-1',
      options: [{ id: 'opt-1', label: 'Standard', labelAr: 'قياسي', durationMins: 30, price: 100, isActive: true }],
    });
    expect(txMock.serviceDurationOption.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'opt-1' },
      data: expect.objectContaining({ isActive: true }),
    }));
    expect(result).toHaveLength(1);
  });

  it('should create new option without id', async () => {
    prisma.service.findFirst.mockResolvedValue({ id: 'svc-1' });
    txMock.serviceDurationOption.create.mockResolvedValue({ id: 'opt-2' });
    prisma.serviceDurationOption.findMany.mockResolvedValue([{ id: 'opt-2' }]);

    await handler.execute({
      serviceId: 'svc-1',
      options: [{ label: 'New', labelAr: 'جديد', durationMins: 60, price: 200, currency: 'USD', isDefault: true, sortOrder: 1 }],
    });
    expect(txMock.serviceDurationOption.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ currency: 'USD', isDefault: true, sortOrder: 1, bookingType: null }),
    }));
  });

  it('should use defaults for optional fields', async () => {
    prisma.service.findFirst.mockResolvedValue({ id: 'svc-1' });
    txMock.serviceDurationOption.create.mockResolvedValue({ id: 'opt-3' });
    prisma.serviceDurationOption.findMany.mockResolvedValue([]);

    await handler.execute({
      serviceId: 'svc-1',
      options: [{ label: 'Basic', labelAr: 'أساسي', durationMins: 30, price: 50 }],
    });
    expect(txMock.serviceDurationOption.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ currency: 'SAR', isDefault: false, sortOrder: 0 }),
    }));
  });
});
