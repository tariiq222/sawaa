import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GroupSessionStatus } from '@prisma/client';
import { GetPublicGroupSessionHandler } from './get-public-group-session.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('GetPublicGroupSessionHandler', () => {
  let handler: GetPublicGroupSessionHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = { groupSession: { findFirst: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [GetPublicGroupSessionHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();

    handler = module.get<GetPublicGroupSessionHandler>(GetPublicGroupSessionHandler);
  });

  it('should throw NotFoundException when session not found', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(null);
    await expect(handler.execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('should return session with spots left and not full', async () => {
    prisma.groupSession.findFirst.mockResolvedValue({
      id: 'gs-1', title: 'Yoga', descriptionAr: null, descriptionEn: 'Yoga class',
      scheduledAt: new Date(), durationMins: 60, maxCapacity: 10, enrolledCount: 5,
      price: 100, currency: 'SAR', status: 'OPEN', isPublic: true,
      waitlistEnabled: true, waitlistCount: 0, employeeId: 'emp-1', serviceId: 'svc-1', branchId: 'branch-1',
    });

    const result = await handler.execute('gs-1');
    expect(result.spotsLeft).toBe(5);
    expect(result.isFull).toBe(false);
    expect(result.isWaitlistOnly).toBe(false);
    expect(result.price).toBe(100);
    expect(prisma.groupSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'gs-1',
        isPublic: true,
        status: GroupSessionStatus.OPEN,
        scheduledAt: { gte: expect.any(Date) },
      },
    });
  });

  it('should return open capacity-full session with waitlist only', async () => {
    prisma.groupSession.findFirst.mockResolvedValue({
      id: 'gs-1', title: 'Yoga', descriptionAr: null, descriptionEn: null,
      scheduledAt: new Date(), durationMins: 60, maxCapacity: 10, enrolledCount: 10,
      price: 100, currency: 'SAR', status: 'OPEN', isPublic: true,
      waitlistEnabled: true, waitlistCount: 2, employeeId: 'emp-1', serviceId: 'svc-1', branchId: 'branch-1',
    });

    const result = await handler.execute('gs-1');
    expect(result.spotsLeft).toBe(0);
    expect(result.isFull).toBe(true);
    expect(result.isWaitlistOnly).toBe(true);
  });

  it('should return full session without waitlist', async () => {
    prisma.groupSession.findFirst.mockResolvedValue({
      id: 'gs-1', title: 'Yoga', descriptionAr: null, descriptionEn: null,
      scheduledAt: new Date(), durationMins: 60, maxCapacity: 10, enrolledCount: 10,
      price: 100, currency: 'SAR', status: 'OPEN', isPublic: true,
      waitlistEnabled: false, waitlistCount: 0, employeeId: 'emp-1', serviceId: 'svc-1', branchId: 'branch-1',
    });

    const result = await handler.execute('gs-1');
    expect(result.isFull).toBe(true);
    expect(result.isWaitlistOnly).toBe(false);
  });
});
