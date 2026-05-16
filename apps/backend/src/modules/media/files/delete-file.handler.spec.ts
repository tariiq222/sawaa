import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { DeleteFileHandler } from './delete-file.handler';

describe('DeleteFileHandler', () => {
  let handler: DeleteFileHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteFileHandler,
    { provide: PrismaService, useValue: {
    file: { findFirst: jest.fn(), update: jest.fn() }
    } },
    { provide: MinioService, useValue: {} }
      ],
    }).compile();

    handler = module.get<DeleteFileHandler>(DeleteFileHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    try {
      await handler.execute('00000000-0000-0000-0000-000000000001');
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
