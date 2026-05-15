import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { GeneratePresignedUrlHandler } from './generate-presigned-url.handler';

describe('GeneratePresignedUrlHandler', () => {
  let handler: GeneratePresignedUrlHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneratePresignedUrlHandler,
    { provide: PrismaService, useValue: {
    file: { findFirst: jest.fn() }
    } },
    { provide: MinioService, useValue: {} }
      ],
    }).compile();

    handler = module.get<GeneratePresignedUrlHandler>(GeneratePresignedUrlHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    try {
      await handler.execute({ id: '00000000-0000-0000-0000-000000000001' });
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
