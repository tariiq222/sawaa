import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { ArchiveSessionPackageHandler } from './archive-session-package.handler';

const PACKAGE_ID = '00000000-0000-4000-a000-0000000000aa';

function buildPrisma() {
  return {
    sessionPackage: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('ArchiveSessionPackageHandler', () => {
  let handler: ArchiveSessionPackageHandler;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(async () => {
    prisma = buildPrisma();
    prisma.sessionPackage.findFirst.mockResolvedValue({ id: PACKAGE_ID });
    prisma.sessionPackage.update.mockResolvedValue({ id: PACKAGE_ID });

    const module = await Test.createTestingModule({
      providers: [ArchiveSessionPackageHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();
    handler = module.get(ArchiveSessionPackageHandler);
  });

  it('is defined', () => {
    expect(handler).toBeDefined();
  });

  it('soft-archives the package (sets archivedAt + isActive=false)', async () => {
    const result = await handler.execute({ packageId: PACKAGE_ID });
    expect(prisma.sessionPackage.findFirst).toHaveBeenCalledWith({
      where: { id: PACKAGE_ID, archivedAt: null },
      select: { id: true },
    });
    expect(prisma.sessionPackage.update).toHaveBeenCalledWith({
      where: { id: PACKAGE_ID },
      data: { archivedAt: expect.any(Date), isActive: false },
    });
    expect(result).toEqual({ id: PACKAGE_ID });
  });

  it('throws NotFoundException when the package is missing', async () => {
    prisma.sessionPackage.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ packageId: 'missing' })).rejects.toThrow(NotFoundException);
    expect(prisma.sessionPackage.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the package is already archived', async () => {
    prisma.sessionPackage.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ packageId: 'archived' })).rejects.toThrow(NotFoundException);
    expect(prisma.sessionPackage.update).not.toHaveBeenCalled();
  });
});