import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { ListServicesHandler } from './list-services.handler';

const storageProvider = {
  provide: MinioService,
  useValue: { getSignedUrl: jest.fn((bucket: string, key: string) => Promise.resolve(`signed:${bucket}/${key}`)) },
};
const configProvider = { provide: ConfigService, useValue: { getOrThrow: jest.fn(() => 'sawaa-media') } };

describe('ListServicesHandler', () => {
  let handler: ListServicesHandler;
  let tx: {
    service: { findMany: jest.Mock; count: jest.Mock };
    employeeService: { groupBy: jest.Mock };
  };

  const buildModule = async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListServicesHandler,
        { provide: PrismaService, useValue: { $transaction: jest.fn(), employeeService: tx.employeeService } },
        {
          provide: RlsTransactionService,
          useValue: { withTransaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)) },
        },
        {
          provide: CacheService,
          useValue: {
            getOrSet: (_k: string, l: () => Promise<unknown>) => l(),
            invalidatePrefix: jest.fn(),
          },
        },
        storageProvider,
        configProvider,
      ],
    }).compile();
    handler = module.get(ListServicesHandler);
  };

  beforeEach(() => {
    tx = {
      service: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      employeeService: { groupBy: jest.fn().mockResolvedValue([]) },
    };
  });

  afterEach(() => jest.restoreAllMocks());

  it('contains a signing rejection per image without losing other services or category images', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    storageProvider.useValue.getSignedUrl.mockRejectedValueOnce(new Error('signing failed'));
    tx.service.findMany.mockResolvedValue([
      { id: 's1', imageUrl: 'org/failing.png', category: { id: 'c1', imageUrl: 'org/category.png' } },
      { id: 's2', imageUrl: 'org/healthy.png', category: null },
    ]);
    tx.service.count.mockResolvedValue(2);
    await buildModule();

    const result = await handler.execute({});

    expect(result.items).toEqual([
      expect.objectContaining({ id: 's1', imageUrl: null, category: expect.objectContaining({ imageUrl: 'signed:sawaa-media/org/category.png' }) }),
      expect.objectContaining({ id: 's2', imageUrl: 'signed:sawaa-media/org/healthy.png' }),
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('Failed to sign media image URL', { bucket: 'sawaa-media', key: 'org/failing.png' });
  });

  it('does not swallow database failures unrelated to image signing', async () => {
    tx.service.findMany.mockRejectedValue(new Error('database failed'));
    await buildModule();
    await expect(handler.execute({})).rejects.toThrow('database failed');
  });

  it('historical catalog admits archived inactive bound services', async () => {
    await buildModule();
    await handler.execute({historicalContext:true,isActive:true,includeHidden:true} as any);
    expect(tx.service.findMany.mock.calls[0][0].where).not.toHaveProperty('archivedAt');
    expect(tx.service.findMany.mock.calls[0][0].where).not.toHaveProperty('isActive');
  });

  it('filters by the branch of an active assigned practitioner and sorts before pagination', async () => {
    (tx.employeeService as any).findMany = jest.fn().mockResolvedValue([{serviceId: 'eligible-service'}]);
    await buildModule();
    await handler.execute({branchId:'branch', departmentId:'dept', sortBy:'price', sortOrder:'asc'} as any);
    expect(tx.service.findMany.mock.calls[0][0]).toMatchObject({where:{id:{in:['eligible-service']},category:{departmentId:'dept'}},orderBy:[{price:'asc'},{id:'asc'}]});
    expect(tx.service.count.mock.calls[0][0].where).toMatchObject({id:{in:['eligible-service']}});
    expect((tx.employeeService as any).findMany).toHaveBeenCalledWith({where:{isActive:true,employee:{isActive:true,branches:{some:{branchId:'branch'}}}},select:{serviceId:true}});
  });

  it('should be defined', async () => {
    await buildModule();
    expect(handler).toBeDefined();
  });

  it('returns empty list and skips the employee-count query when no services match', async () => {
    await buildModule();
    const res = await handler.execute({});
    expect(res.items).toEqual([]);
    expect(tx.employeeService.groupBy).not.toHaveBeenCalled();
  });

  it('attaches employeeCount per service from the grouped active-employee count', async () => {
    tx.service.findMany.mockResolvedValue([
      { id: 's1', nameAr: 'أ' },
      { id: 's2', nameAr: 'ب' },
    ]);
    tx.service.count.mockResolvedValue(2);
    tx.employeeService.groupBy.mockResolvedValue([{ serviceId: 's1', _count: { _all: 3 } }]);
    await buildModule();

    const res = await handler.execute({});

    expect(tx.employeeService.groupBy).toHaveBeenCalledWith({
      by: ['serviceId'],
      where: { serviceId: { in: ['s1', 's2'] }, employee: { isActive: true } },
      _count: { _all: true },
    });
    const items = res.items as Array<{ id: string; employeeCount: number }>;
    expect(items.find((s) => s.id === 's1')?.employeeCount).toBe(3);
    // s2 has no assigned employees → defaults to 0 (wizard disables it).
    expect(items.find((s) => s.id === 's2')?.employeeCount).toBe(0);
  });
});
