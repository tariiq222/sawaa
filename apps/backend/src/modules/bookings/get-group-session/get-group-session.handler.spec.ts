import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GetGroupSessionHandler } from './get-group-session.handler';
import { PrismaService } from '../../../infrastructure/database';
import { GroupSessionStatus, DeliveryType } from '@prisma/client';

const mockSession = {
  id: 'session-1',
  branchId: 'branch-1',
  employeeId: 'emp-1',
  serviceId: 'svc-1',
  title: 'Test Session',
  scheduledAt: new Date('2026-07-01T10:00:00Z'),
  durationMins: 60,
  maxCapacity: 10,
  enrolledCount: 2,
  price: 10000,
  currency: 'SAR',
  status: GroupSessionStatus.OPEN,
  deliveryType: DeliveryType.IN_PERSON,
  isPublic: false,
  descriptionAr: null,
  descriptionEn: null,
  publicDescriptionAr: null,
  publicDescriptionEn: null,
  cancelReason: null,
  cancelledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  enrollments: [
    { clientId: 'client-1', bookingId: 'booking-1', enrolledAt: new Date() },
  ],
};

const mockPrisma = {
  groupSession: {
    findUnique: jest.fn(),
  },
};

describe('GetGroupSessionHandler', () => {
  let handler: GetGroupSessionHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GetGroupSessionHandler,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    handler = module.get(GetGroupSessionHandler);
    jest.clearAllMocks();
  });

  it('returns session with enrollments', async () => {
    mockPrisma.groupSession.findUnique.mockResolvedValue(mockSession);
    const result = await handler.execute({ groupSessionId: 'session-1' });
    expect(result.id).toBe('session-1');
    expect(result.enrollments).toHaveLength(1);
    expect(result.enrollments[0].clientId).toBe('client-1');
  });

  it('throws NotFoundException when not found', async () => {
    mockPrisma.groupSession.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ groupSessionId: 'bad-id' })).rejects.toThrow(NotFoundException);
  });
});
