import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GeneratePresignedUrlHandler } from './generate-presigned-url.handler';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';

describe('GeneratePresignedUrlHandler', () => {
  let handler: GeneratePresignedUrlHandler;
  let prisma: any;
  let storage: jest.Mocked<Partial<MinioService>>;

  const baseFile = {
    id: 'f1',
    bucket: 'bucket',
    storageKey: 'key',
    filename: 'file.pdf',
    mimetype: 'application/pdf',
    uploadedBy: 'user-1',
    visibility: 'PRIVATE',
    isDeleted: false,
  };

  beforeEach(async () => {
    prisma = {
      file: { findFirst: jest.fn() },
      user: { findUnique: jest.fn() },
    };
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

  it('returns a signed url for a PUBLIC file without ownership check', async () => {
    prisma.file.findFirst.mockResolvedValue({ ...baseFile, visibility: 'PUBLIC' });
    const result = await handler.execute({ fileId: 'f1' });
    expect(storage.getSignedUrl).toHaveBeenCalledWith('bucket', 'key', 3600);
    expect(result.url).toBe('https://signed.url');
    expect(result.expiresInSeconds).toBe(3600);
  });

  it('returns a signed url for a PRIVATE file when caller is the uploader', async () => {
    prisma.file.findFirst.mockResolvedValue(baseFile);
    const result = await handler.execute({ fileId: 'f1', userId: 'user-1', expirySeconds: 7200 });
    expect(storage.getSignedUrl).toHaveBeenCalledWith('bucket', 'key', 7200);
    expect(result.expiresInSeconds).toBe(7200);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns a signed url for a PRIVATE file when caller is a super-admin', async () => {
    prisma.file.findFirst.mockResolvedValue(baseFile);
    prisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true });
    const result = await handler.execute({ fileId: 'f1', userId: 'other-user' });
    expect(result.url).toBe('https://signed.url');
  });

  it('rejects access when caller is neither uploader nor super-admin', async () => {
    prisma.file.findFirst.mockResolvedValue(baseFile);
    prisma.user.findUnique.mockResolvedValue({ isSuperAdmin: false });
    await expect(handler.execute({ fileId: 'f1', userId: 'other-user' })).rejects.toThrow(ForbiddenException);
  });

  it('rejects access on PRIVATE file when userId is missing', async () => {
    prisma.file.findFirst.mockResolvedValue(baseFile);
    await expect(handler.execute({ fileId: 'f1' })).rejects.toThrow(ForbiddenException);
  });
});
