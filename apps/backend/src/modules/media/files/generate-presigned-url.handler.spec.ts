import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GeneratePresignedUrlHandler } from './generate-presigned-url.handler';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';

describe('GeneratePresignedUrlHandler', () => {
  let handler: GeneratePresignedUrlHandler;
  let prisma: any;
  let storage: jest.Mocked<Partial<MinioService>>;

  beforeEach(async () => {
    prisma = { file: { findFirst: jest.fn() } };
    storage = { getSignedUrl: jest.fn().mockResolvedValue('https://signed.url') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneratePresignedUrlHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: MinioService, useValue: storage },
      ],
    }).compile();

    handler = module.get<GeneratePresignedUrlHandler>(GeneratePresignedUrlHandler);
  });

  it('should throw NotFoundException when file not found', async () => {
    prisma.file.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ fileId: 'missing', expirySeconds: 3600 })).rejects.toThrow(NotFoundException);
  });

  it('should return signed url with default expiry', async () => {
    prisma.file.findFirst.mockResolvedValue({ id: 'f1', bucket: 'bucket', storageKey: 'key', filename: 'file.pdf', mimetype: 'application/pdf' });

    const result = await handler.execute({ fileId: 'f1' });
    expect(storage.getSignedUrl).toHaveBeenCalledWith('bucket', 'key', 3600);
    expect(result.url).toBe('https://signed.url');
    expect(result.expiresInSeconds).toBe(3600);
  });

  it('should use custom expiry when provided', async () => {
    prisma.file.findFirst.mockResolvedValue({ id: 'f1', bucket: 'bucket', storageKey: 'key', filename: 'file.pdf', mimetype: 'application/pdf' });

    const result = await handler.execute({ fileId: 'f1', expirySeconds: 7200 });
    expect(storage.getSignedUrl).toHaveBeenCalledWith('bucket', 'key', 7200);
    expect(result.expiresInSeconds).toBe(7200);
  });
});
