import { Test } from '@nestjs/testing';
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
        { provide: PrismaService, useValue: { $transaction: jest.fn() } },
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
