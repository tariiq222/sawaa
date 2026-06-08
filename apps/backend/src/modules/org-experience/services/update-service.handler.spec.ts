import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { CacheService } from '../../../infrastructure/cache';
import { UpdateServiceHandler } from './update-service.handler';

function createService(overrides?: Partial<any>) {
  return {
    id: 's1',
    price: 100,
    minParticipants: 1,
    maxParticipants: 5,
    depositEnabled: false,
    depositAmount: null,
    reserveWithoutPayment: false,
    isActive: true,
    ...overrides,
  };
}

describe('UpdateServiceHandler', () => {
  let handler: UpdateServiceHandler;
  let prisma: any;
  let eventBus: any;

  beforeEach(async () => {
    prisma = {
      service: { findFirst: jest.fn(), update: jest.fn() },
    };
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateServiceHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: CacheService, useValue: { getOrSet: (_k: string, l: () => Promise<unknown>) => l(), invalidatePrefix: jest.fn() } },
      ],
    }).compile();

    handler = module.get<UpdateServiceHandler>(UpdateServiceHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should throw when service not found', async () => {
    prisma.service.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ serviceId: 's1' } as any)).rejects.toThrow(NotFoundException);
  });

  it('should throw when depositAmount > price', async () => {
    prisma.service.findFirst.mockResolvedValue(createService());
    await expect(handler.execute({ serviceId: 's1', depositEnabled: true, depositAmount: 150, price: 100 } as any)).rejects.toThrow(BadRequestException);
  });

  it('should throw when enabling deposit without a positive deposit amount', async () => {
    prisma.service.findFirst.mockResolvedValue(createService({ depositEnabled: false, depositAmount: null }));
    await expect(handler.execute({ serviceId: 's1', depositEnabled: true } as any)).rejects.toThrow(BadRequestException);

    prisma.service.findFirst.mockResolvedValue(createService({ depositEnabled: false, depositAmount: 0 }));
    await expect(handler.execute({ serviceId: 's1', depositEnabled: true } as any)).rejects.toThrow(BadRequestException);
  });

  it('should throw when updating to a duplicate English service name', async () => {
    prisma.service.findFirst
      .mockResolvedValueOnce(createService({ id: 's1', nameAr: 'خدمة', nameEn: 'Old' }))
      .mockResolvedValueOnce({ id: 's2', nameEn: 'Family Consultation' });

    await expect(
      handler.execute({ serviceId: 's1', nameEn: 'Family Consultation' } as any),
    ).rejects.toThrow(ConflictException);

    expect(prisma.service.findFirst).toHaveBeenLastCalledWith({
      where: {
        id: { not: 's1' },
        archivedAt: null,
        OR: [{ nameEn: 'Family Consultation' }],
      },
    });
  });

  it('should throw when min > max', async () => {
    prisma.service.findFirst.mockResolvedValue(createService());
    await expect(handler.execute({ serviceId: 's1', minParticipants: 5, maxParticipants: 3 } as any)).rejects.toThrow(BadRequestException);
  });

  it('should throw when reserveWithoutPayment with max <= 1', async () => {
    prisma.service.findFirst.mockResolvedValue(createService());
    await expect(handler.execute({ serviceId: 's1', reserveWithoutPayment: true, maxParticipants: 1 } as any)).rejects.toThrow(BadRequestException);
  });

  it('should update service successfully', async () => {
    prisma.service.findFirst
      .mockResolvedValueOnce(createService())
      .mockResolvedValueOnce(null);
    prisma.service.update.mockResolvedValue({ id: 's1', nameAr: 'New' });
    const result = await handler.execute({ serviceId: 's1', nameAr: 'New' } as any);
    expect(result.id).toBe('s1');
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('should publish reactivated event when activating', async () => {
    prisma.service.findFirst.mockResolvedValue(createService({ isActive: false }));
    prisma.service.update.mockResolvedValue({ id: 's1', isActive: true });
    await handler.execute({ serviceId: 's1', isActive: true } as any);
    expect(eventBus.publish).toHaveBeenCalledWith('org-experience.service.reactivated', expect.any(Object));
  });

  it('should publish deactivated event when deactivating', async () => {
    prisma.service.findFirst.mockResolvedValue(createService({ isActive: true }));
    prisma.service.update.mockResolvedValue({ id: 's1', isActive: false });
    await handler.execute({ serviceId: 's1', isActive: false } as any);
    expect(eventBus.publish).toHaveBeenCalledWith('org-experience.service.deactivated', expect.any(Object));
  });

  it('should not publish event when isActive unchanged', async () => {
    prisma.service.findFirst
      .mockResolvedValueOnce(createService({ isActive: true }))
      .mockResolvedValueOnce(null);
    prisma.service.update.mockResolvedValue({ id: 's1' });
    await handler.execute({ serviceId: 's1', nameAr: 'New' } as any);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('should swallow event publish error', async () => {
    prisma.service.findFirst.mockResolvedValue(createService({ isActive: false }));
    prisma.service.update.mockResolvedValue({ id: 's1', isActive: true });
    eventBus.publish.mockRejectedValue(new Error('fail'));
    await expect(handler.execute({ serviceId: 's1', isActive: true } as any)).resolves.not.toThrow();
  });

  it('should use existing values for validation when dto values missing', async () => {
    prisma.service.findFirst
      .mockResolvedValueOnce(createService({ price: 200, depositEnabled: true, depositAmount: 50 }))
      .mockResolvedValueOnce(null);
    prisma.service.update.mockResolvedValue({ id: 's1' });
    await handler.execute({ serviceId: 's1', nameAr: 'New' } as any);
    expect(prisma.service.update).toHaveBeenCalled();
  });

  it('should throw ConflictException when expectedUpdatedAt does not match', async () => {
    const updatedAt = new Date('2026-06-08T10:00:00.000Z');
    prisma.service.findFirst.mockResolvedValue(createService({ updatedAt }));
    await expect(
      handler.execute({ serviceId: 's1', nameAr: 'New', expectedUpdatedAt: '2026-06-08T09:00:00.000Z' } as any),
    ).rejects.toThrow(ConflictException);
    expect(prisma.service.update).not.toHaveBeenCalled();
  });

  it('should proceed when expectedUpdatedAt matches', async () => {
    const updatedAt = new Date('2026-06-08T10:00:00.000Z');
    prisma.service.findFirst
      .mockResolvedValueOnce(createService({ updatedAt }))
      .mockResolvedValueOnce(null);
    prisma.service.update.mockResolvedValue({ id: 's1', nameAr: 'New' });
    const result = await handler.execute({
      serviceId: 's1',
      nameAr: 'New',
      expectedUpdatedAt: updatedAt.toISOString(),
    } as any);
    expect(result.id).toBe('s1');
    expect(prisma.service.update).toHaveBeenCalled();
  });
});
