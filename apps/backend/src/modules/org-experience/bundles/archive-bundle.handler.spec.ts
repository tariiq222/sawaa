import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ArchiveBundleHandler } from './archive-bundle.handler';

const mockBundle = {
  id: 'bundle-1',
  nameAr: 'باقة',
  archivedAt: null,
  isActive: true,
};

describe('ArchiveBundleHandler', () => {
  let handler: ArchiveBundleHandler;
  let prisma: { serviceBundle: { findFirst: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      serviceBundle: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ ...mockBundle, archivedAt: new Date(), isActive: false }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchiveBundleHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<ArchiveBundleHandler>(ArchiveBundleHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('throws 404 when bundle not found', async () => {
    prisma.serviceBundle.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ bundleId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('archives the bundle and sets isActive to false', async () => {
    prisma.serviceBundle.findFirst.mockResolvedValue(mockBundle);

    const result = await handler.execute({ bundleId: 'bundle-1' });

    expect(result.archivedAt).not.toBeNull();
    expect(result.isActive).toBe(false);
    expect(prisma.serviceBundle.update).toHaveBeenCalledWith({
      where: { id: 'bundle-1' },
      data: expect.objectContaining({ isActive: false }),
    });
  });
});
