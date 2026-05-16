import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { BulkUpsertSiteSettingsHandler } from './bulk-upsert-site-settings.handler';

describe('BulkUpsertSiteSettingsHandler', () => {
  let handler: BulkUpsertSiteSettingsHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (cb) => {
        if (typeof cb === 'function') return await cb(prisma);
        return await Promise.all(cb);
      }),
      siteSetting: { upsert: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        BulkUpsertSiteSettingsHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: { withTransaction: jest.fn((cb: any) => cb(prisma)) } },
      ],
    }).compile();

    handler = module.get(BulkUpsertSiteSettingsHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should upsert entries with all fields', async () => {
    prisma.siteSetting.upsert.mockResolvedValue({});
    const dto = {
      entries: [
        {
          key: 'k1',
          valueText: 'text',
          valueAr: 'ar',
          valueEn: 'en',
          valueJson: { a: 1 },
          valueMedia: 'url',
        },
      ],
    };

    const result = await handler.execute(dto as any);
    expect(result.updated).toBe(1);
    expect(prisma.siteSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'k1' },
      create: {
        key: 'k1',
        valueText: 'text',
        valueAr: 'ar',
        valueEn: 'en',
        valueJson: { a: 1 },
        valueMedia: 'url',
      },
      update: {
        valueText: 'text',
        valueAr: 'ar',
        valueEn: 'en',
        valueJson: { a: 1 },
        valueMedia: 'url',
      },
    });
  });

  it('should upsert entries with null defaults', async () => {
    prisma.siteSetting.upsert.mockResolvedValue({});
    const dto = {
      entries: [{ key: 'k2' }],
    };

    const result = await handler.execute(dto as any);
    expect(result.updated).toBe(1);
    expect(prisma.siteSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'k2' },
      create: {
        key: 'k2',
        valueText: null,
        valueAr: null,
        valueEn: null,
        valueJson: Prisma.DbNull,
        valueMedia: null,
      },
      update: {
        valueText: null,
        valueAr: null,
        valueEn: null,
        valueJson: Prisma.DbNull,
        valueMedia: null,
      },
    });
  });

  it('should handle multiple entries', async () => {
    prisma.siteSetting.upsert.mockResolvedValue({});
    const dto = {
      entries: [{ key: 'a' }, { key: 'b' }],
    };

    const result = await handler.execute(dto as any);
    expect(result.updated).toBe(2);
    expect(prisma.siteSetting.upsert).toHaveBeenCalledTimes(2);
  });
});
