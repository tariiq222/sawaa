import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { GetServiceHandler } from './get-service.handler';

describe('GetServiceHandler', () => {
  let handler: GetServiceHandler;
  let prisma: PrismaService;
  let storage: { getSignedUrl: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetServiceHandler,
        { provide: PrismaService, useValue: {
    service: { findFirst: jest.fn() }
        } },
        { provide: MinioService, useValue: { getSignedUrl: jest.fn((bucket: string, key: string) => Promise.resolve(`signed:${bucket}/${key}`)) } },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn(() => 'sawaa-media') } },
      ],
    }).compile();

    handler = module.get<GetServiceHandler>(GetServiceHandler);
    prisma = module.get<PrismaService>(PrismaService);
    storage = module.get(MinioService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.service.findFirst as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({serviceId:"00000000-0000-0000-0000-000000000001"});
    expect(result).toBeDefined();
    
    (prisma.service.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({serviceId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });

  it('signs the service imageUrl (and embedded category imageUrl) at read time', async () => {
    (prisma.service.findFirst as jest.Mock).mockResolvedValue({
      id: 'svc-1',
      imageUrl: 'org-1/svc.png',
      category: { id: 'cat-1', imageUrl: 'org-1/cat.png' },
    });

    const result = await handler.execute({ serviceId: '00000000-0000-0000-0000-000000000001' });

    expect(storage.getSignedUrl).toHaveBeenCalledWith('sawaa-media', 'org-1/svc.png', 300);
    expect(storage.getSignedUrl).toHaveBeenCalledWith('sawaa-media', 'org-1/cat.png', 300);
    expect(result.imageUrl).toBe('signed:sawaa-media/org-1/svc.png');
    expect(result.category?.imageUrl).toBe('signed:sawaa-media/org-1/cat.png');
  });

  it('leaves a null service imageUrl as null without signing', async () => {
    (prisma.service.findFirst as jest.Mock).mockResolvedValue({ id: 'svc-1', imageUrl: null, category: null });

    const result = await handler.execute({ serviceId: '00000000-0000-0000-0000-000000000001' });

    expect(result.imageUrl).toBeNull();
    expect(storage.getSignedUrl).not.toHaveBeenCalled();
  });
});
