import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CreateBranchHandler } from './create-branch.handler';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { EventBusService } from '../../../infrastructure/events';

describe('CreateBranchHandler', () => {
  let handler: CreateBranchHandler;
  let tx: { branch: { findFirst: jest.Mock; updateMany: jest.Mock; create: jest.Mock } };
  let rlsTransaction: { withTransaction: jest.Mock };
  let cache: { invalidatePrefix: jest.Mock };
  let eventBus: { publish: jest.Mock };

  beforeEach(async () => {
    tx = {
      branch: { findFirst: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
    };
    rlsTransaction = {
      withTransaction: jest.fn((fn: (tx: unknown) => unknown) => fn(tx)),
    };
    cache = { invalidatePrefix: jest.fn() };
    eventBus = { publish: jest.fn().mockReturnValue({ catch: jest.fn() }) };

    const module = await Test.createTestingModule({
      providers: [
        CreateBranchHandler,
        { provide: PrismaService, useValue: {} },
        { provide: RlsTransactionService, useValue: rlsTransaction },
        { provide: CacheService, useValue: cache },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    handler = module.get(CreateBranchHandler);
  });

  const dto = {
    nameAr: 'فرع الرياض',
    nameEn: 'Riyadh Branch',
    phone: '+966501234567',
    addressAr: 'حي العليا',
    addressEn: 'Al Olaya',
    city: 'Riyadh',
    country: 'SA',
    isActive: true,
    isMain: true,
    timezone: 'Asia/Riyadh',
  };

  it('throws ConflictException when Arabic name already exists', async () => {
    tx.branch.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(handler.execute(dto)).rejects.toThrow(ConflictException);
  });

  it('clears existing main branch and creates new one with isMain', async () => {
    tx.branch.findFirst.mockResolvedValue(null);
    tx.branch.create.mockResolvedValue({ id: 'b1', ...dto });
    const result = await handler.execute(dto);
    expect(tx.branch.updateMany).toHaveBeenCalledWith({
      where: { isMain: true },
      data: { isMain: false },
    });
    expect(result.id).toBe('b1');
  });

  it('publishes BranchCreatedEvent and invalidates the branches cache', async () => {
    tx.branch.findFirst.mockResolvedValue(null);
    tx.branch.create.mockResolvedValue({ id: 'b1', ...dto });
    await handler.execute(dto);
    expect(cache.invalidatePrefix).toHaveBeenCalledWith('ref:branches:');
    expect(eventBus.publish).toHaveBeenCalled();
  });
});