import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UpdateBranchHandler } from './update-branch.handler';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { EventBusService } from '../../../infrastructure/events';

describe('UpdateBranchHandler', () => {
  let handler: UpdateBranchHandler;
  let tx: { branch: { findFirst: jest.Mock; update: jest.Mock; updateMany: jest.Mock } };
  let rlsTransaction: { withTransaction: jest.Mock };
  let cache: { invalidatePrefix: jest.Mock };
  let eventBus: { publish: jest.Mock };

  beforeEach(async () => {
    tx = { branch: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() } };
    rlsTransaction = {
      withTransaction: jest.fn((fn: (tx: unknown) => unknown) => fn(tx)),
    };
    cache = { invalidatePrefix: jest.fn() };
    eventBus = { publish: jest.fn().mockReturnValue({ catch: jest.fn() }) };

    const module = await Test.createTestingModule({
      providers: [
        UpdateBranchHandler,
        { provide: PrismaService, useValue: {} },
        { provide: RlsTransactionService, useValue: rlsTransaction },
        { provide: CacheService, useValue: cache },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    handler = module.get(UpdateBranchHandler);
  });

  const dto = {
    branchId: 'b1',
    nameAr: 'فرع الرياض',
    nameEn: 'Riyadh Branch',
    isActive: true,
  } as Parameters<UpdateBranchHandler['execute']>[0];

  it('throws NotFoundException when branch is missing', async () => {
    tx.branch.findFirst.mockResolvedValue(null);
    await expect(handler.execute(dto)).rejects.toThrow(NotFoundException);
  });

  it('clears existing main branch when promoting to main', async () => {
    tx.branch.findFirst.mockResolvedValue({ id: 'b1', isMain: false, isActive: true });
    tx.branch.update.mockResolvedValue({ id: 'b1', isMain: true });
    await handler.execute({ ...dto, isMain: true });
    expect(tx.branch.updateMany).toHaveBeenCalledWith({
      where: { isMain: true, NOT: { id: 'b1' } },
      data: { isMain: false },
    });
  });

  it('publishes BranchDeactivatedEvent when toggling isActive false', async () => {
    tx.branch.findFirst.mockResolvedValue({ id: 'b1', isMain: false, isActive: true });
    tx.branch.update.mockResolvedValue({ id: 'b1', isActive: false });
    await handler.execute({ ...dto, isActive: false });
    expect(eventBus.publish).toHaveBeenCalled();
  });

  it('invalidates the branches cache after the update', async () => {
    tx.branch.findFirst.mockResolvedValue({ id: 'b1', isMain: false, isActive: true });
    tx.branch.update.mockResolvedValue({ id: 'b1' });
    await handler.execute(dto);
    expect(cache.invalidatePrefix).toHaveBeenCalledWith('ref:branches:');
  });
});