import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileVisibility } from '@prisma/client';
import { UploadFileHandler, MAX_FILE_SIZE_BYTES } from './upload-file.handler';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { EventBusService } from '../../../infrastructure/events';
import * as magicByteValidator from '../../../common/security/magic-byte-validator';

jest.mock('../../../common/security/magic-byte-validator', () => ({
  validateMagicBytes: jest.fn(),
}));

describe('UploadFileHandler', () => {
  let handler: UploadFileHandler;
  let prisma: { file: { create: jest.Mock } };
  let storage: { uploadFile: jest.Mock; deleteFile: jest.Mock };
  let eventBus: { publish: jest.Mock };

  beforeEach(async () => {
    prisma = {
      file: {
        create: jest.fn().mockResolvedValue({
          id: 'file-1', bucket: 'bucket', storageKey: 'key', filename: 'test.png', mimetype: 'image/png', size: 100,
        }),
      },
    };
    storage = {
      uploadFile: jest.fn().mockResolvedValue('https://cdn.example.com/key'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        UploadFileHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: MinioService, useValue: storage },
        { provide: EventBusService, useValue: eventBus },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('bucket') } },
      ],
    }).compile();

    handler = module.get(UploadFileHandler);
    (magicByteValidator.validateMagicBytes as jest.Mock).mockResolvedValue({ ok: true });
  });

  const cmd = {
    filename: 'test.png',
    mimetype: 'image/png',
    size: 100,
    visibility: FileVisibility.PRIVATE,
    ownerType: 'CLIENT',
    ownerId: 'client-1',
  };

  it('throws on empty buffer', async () => {
    await expect(handler.execute(cmd, Buffer.alloc(0))).rejects.toThrow('Empty file buffer');
  });

  it('throws when size does not match buffer length', async () => {
    await expect(handler.execute({ ...cmd, size: 50 }, Buffer.alloc(100))).rejects.toThrow('Declared size does not match');
  });

  it('throws when file exceeds max size', async () => {
    await expect(handler.execute({ ...cmd, size: MAX_FILE_SIZE_BYTES + 1 }, Buffer.alloc(MAX_FILE_SIZE_BYTES + 1))).rejects.toThrow('exceeds maximum size');
  });

  it('throws on disallowed mime type', async () => {
    await expect(handler.execute({ ...cmd, mimetype: 'application/exe' }, Buffer.alloc(100))).rejects.toThrow('Mime type not allowed');
  });

  it('throws when magic bytes check fails', async () => {
    (magicByteValidator.validateMagicBytes as jest.Mock).mockResolvedValue({ ok: false, reason: 'bad magic' });
    await expect(handler.execute(cmd, Buffer.alloc(100))).rejects.toThrow('File content validation failed');
  });

  it('uploads file and returns with url', async () => {
    const result = await handler.execute(cmd, Buffer.alloc(100));
    expect(result.url).toBe('https://cdn.example.com/key');
    expect(storage.uploadFile).toHaveBeenCalled();
    expect(prisma.file.create).toHaveBeenCalled();
  });

  it('publishes event after upload', async () => {
    await handler.execute(cmd, Buffer.alloc(100));
    expect(eventBus.publish).toHaveBeenCalled();
  });

  it('deletes uploaded file on db error', async () => {
    prisma.file.create.mockRejectedValue(new Error('DB down'));
    await expect(handler.execute(cmd, Buffer.alloc(100))).rejects.toThrow('DB down');
    expect(storage.deleteFile).toHaveBeenCalled();
  });

  it('ignores delete error on db error cleanup', async () => {
    prisma.file.create.mockRejectedValue(new Error('DB down'));
    storage.deleteFile.mockRejectedValue(new Error('Storage down'));
    await expect(handler.execute(cmd, Buffer.alloc(100))).rejects.toThrow('DB down');
  });

  it('sanitizes filename', async () => {
    await handler.execute({ ...cmd, filename: 'file@name!.png' }, Buffer.alloc(100));
    expect(prisma.file.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ filename: 'file_name_.png' }) }),
    );
  });

  it('uses PRIVATE visibility as default', async () => {
    await handler.execute({ ...cmd, visibility: undefined }, Buffer.alloc(100));
    expect(prisma.file.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ visibility: FileVisibility.PRIVATE }) }),
    );
  });
});
