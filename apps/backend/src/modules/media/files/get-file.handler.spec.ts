import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { GetFileHandler } from './get-file.handler';

describe('GetFileHandler', () => {
  let handler: GetFileHandler;
  let prisma: { file: { findFirst: jest.Mock } };

  beforeEach(async () => {
    prisma = { file: { findFirst: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetFileHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<GetFileHandler>(GetFileHandler);
  });

  it('throws NotFoundException when the file is missing', async () => {
    prisma.file.findFirst.mockResolvedValue(null);

    await expect(handler.execute('f-1')).rejects.toThrow(NotFoundException);
  });

  it('excludes soft-deleted files via the isDeleted filter', async () => {
    prisma.file.findFirst.mockResolvedValue(null);
    await expect(handler.execute('f-1')).rejects.toThrow(NotFoundException);
    expect(prisma.file.findFirst).toHaveBeenCalledWith({
      where: { id: 'f-1', isDeleted: false },
    });
  });

  it('returns the file row when found', async () => {
    prisma.file.findFirst.mockResolvedValue({ id: 'f-1', bucket: 'avatars' });
    const result = await handler.execute('f-1');
    expect(result).toEqual({ id: 'f-1', bucket: 'avatars' });
  });
});