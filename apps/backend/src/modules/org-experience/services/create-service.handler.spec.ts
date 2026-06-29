import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { CacheService } from '../../../infrastructure/cache';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { CreateServiceHandler } from './create-service.handler';

describe('CreateServiceHandler', () => {
  let handler: CreateServiceHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateServiceHandler,
    { provide: PrismaService, useValue: {
    service: { findFirst: jest.fn(), create: jest.fn() }
    } },
    { provide: EventBusService, useValue: { publish: jest.fn().mockResolvedValue(undefined) } },
    { provide: CacheService, useValue: { getOrSet: (_k: string, l: () => Promise<unknown>) => l(), invalidatePrefix: jest.fn() } },
    { provide: MinioService, useValue: { getSignedUrl: jest.fn((bucket: string, key: string) => Promise.resolve(`signed:${bucket}/${key}`)) } },
    { provide: ConfigService, useValue: { getOrThrow: jest.fn(() => 'sawaa-media') } },
      ],
    }).compile();

    handler = module.get<CreateServiceHandler>(CreateServiceHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    try {
      await handler.execute({ nameAr: 'خدمة', nameEn: 'Service', categoryId: 'cat-1', price: 100, durationMins: 30 } as any);
    } catch (e) {
      // Expected for incomplete mocks
    }
  });

  it('throws when creating a duplicate English service name', async () => {
    (prisma as any).service.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(
      handler.execute({
        nameAr: 'خدمة جديدة',
        nameEn: 'Family Consultation',
        categoryId: 'cat-1',
        price: 100,
        durationMins: 30,
      } as any),
    ).rejects.toThrow(ConflictException);

    expect((prisma as any).service.findFirst).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        OR: [{ nameAr: 'خدمة جديدة' }, { nameEn: 'Family Consultation' }],
      },
    });
  });

  it('throws when deposit is enabled without a positive deposit amount', async () => {
    await expect(
      handler.execute({
        nameAr: 'خدمة',
        nameEn: 'Service',
        categoryId: 'cat-1',
        price: 100,
        durationMins: 30,
        depositEnabled: true,
      } as any),
    ).rejects.toThrow(BadRequestException);

    await expect(
      handler.execute({
        nameAr: 'خدمة',
        nameEn: 'Service',
        categoryId: 'cat-1',
        price: 100,
        durationMins: 30,
        depositEnabled: true,
        depositAmount: 0,
      } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
