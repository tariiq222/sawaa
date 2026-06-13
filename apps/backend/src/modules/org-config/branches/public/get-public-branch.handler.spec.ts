import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { GetPublicBranchHandler, PublicBranchDetail } from './get-public-branch.handler';

const BRANCH_ID = '00000000-0000-0000-0000-000000000001';

const mockBranch: PublicBranchDetail = {
  id: BRANCH_ID,
  nameAr: 'الفرع الرئيسي',
  nameEn: 'Main Branch',
  city: 'Riyadh',
  addressAr: 'شارع الملك فهد',
  addressEn: 'King Fahd Road',
  phone: '+966112345678',
  latitude: 24.7136,
  longitude: 46.6753,
  timezone: 'Asia/Riyadh',
  isMain: true,
  businessHours: [
    { dayOfWeek: 0, startTime: '09:00', endTime: '17:00', isOpen: true },
  ],
};

describe('GetPublicBranchHandler', () => {
  let handler: GetPublicBranchHandler;
  let prisma: { branch: { findFirst: jest.Mock } };

  beforeEach(async () => {
    prisma = { branch: { findFirst: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPublicBranchHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<GetPublicBranchHandler>(GetPublicBranchHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('returns branch detail including isMain when found', async () => {
    prisma.branch.findFirst.mockResolvedValue(mockBranch);

    const result = await handler.execute(BRANCH_ID);

    expect(result).toEqual(mockBranch);
    expect(result.isMain).toBe(true);
    expect(prisma.branch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BRANCH_ID, isActive: true },
        select: expect.objectContaining({ isMain: true }),
      }),
    );
  });

  it('throws NotFoundException when branch does not exist', async () => {
    prisma.branch.findFirst.mockResolvedValue(null);

    await expect(handler.execute(BRANCH_ID)).rejects.toThrow(NotFoundException);
    await expect(handler.execute(BRANCH_ID)).rejects.toThrow('Branch not found');
  });

  it('returns isMain: false for non-main branch', async () => {
    const secondaryBranch = { ...mockBranch, id: 'branch-2', isMain: false };
    prisma.branch.findFirst.mockResolvedValue(secondaryBranch);

    const result = await handler.execute('branch-2');

    expect(result.isMain).toBe(false);
  });
});
