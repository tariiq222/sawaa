import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { DeleteFileHandler } from './delete-file.handler';

describe('DeleteFileHandler', () => {
  let handler: DeleteFileHandler;
  let prisma: { file: { findFirst: jest.Mock; update: jest.Mock } };
  let storage: { deleteFile: jest.Mock };

  beforeEach(async () => {
    prisma = {
      file: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({ id: 'f-1', isDeleted: true }) },
    };
    storage = { deleteFile: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteFileHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: MinioService, useValue: storage },
      ],
    }).compile();

    handler = module.get<DeleteFileHandler>(DeleteFileHandler);
  });

  it('throws ForbiddenException when called with a bare string (no actor gate)', async () => {
    await expect(handler.execute('f-1' as never)).rejects.toThrow(ForbiddenException);
    expect(prisma.file.findFirst).not.toHaveBeenCalled();
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the file does not exist or is already deleted', async () => {
    prisma.file.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute({ fileId: 'f-1', actorUserId: 'u-1' }),
    ).rejects.toThrow(NotFoundException);
    expect(storage.deleteFile).not.toHaveBeenCalled();
    expect(prisma.file.update).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when actor is not the uploader (P1 security gate)', async () => {
    prisma.file.findFirst.mockResolvedValue({ id: 'f-1', uploadedBy: 'u-other', bucket: 'b', storageKey: 'k' });

    await expect(
      handler.execute({ fileId: 'f-1', actorUserId: 'u-1' }),
    ).rejects.toThrow(ForbiddenException);
    expect(storage.deleteFile).not.toHaveBeenCalled();
    expect(prisma.file.update).not.toHaveBeenCalled();
  });

  it('soft-deletes the file when the actor is the uploader', async () => {
    prisma.file.findFirst.mockResolvedValue({ id: 'f-1', uploadedBy: 'u-1', bucket: 'avatars', storageKey: 'a/1.png' });

    await handler.execute({ fileId: 'f-1', actorUserId: 'u-1' });

    expect(storage.deleteFile).toHaveBeenCalledWith('avatars', 'a/1.png');
    expect(prisma.file.update).toHaveBeenCalledWith({
      where: { id: 'f-1' },
      data: { isDeleted: true },
    });
  });

  it('bypasses the uploader check when bypassOwnership=true (e.g. SUPER_ADMIN)', async () => {
    prisma.file.findFirst.mockResolvedValue({ id: 'f-1', uploadedBy: 'u-other', bucket: 'b', storageKey: 'k' });

    await handler.execute({ fileId: 'f-1', actorUserId: 'u-admin', bypassOwnership: true });

    expect(storage.deleteFile).toHaveBeenCalledWith('b', 'k');
    expect(prisma.file.update).toHaveBeenCalled();
  });
});