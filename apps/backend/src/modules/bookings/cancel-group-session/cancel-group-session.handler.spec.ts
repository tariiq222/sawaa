import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CancelGroupSessionHandler } from './cancel-group-session.handler';
import { PrismaService } from '../../../infrastructure/database';
import { GroupSessionStatus, DeliveryType } from '@prisma/client';

const makeSession = (status: GroupSessionStatus) => ({
  id: 'session-1',
  status,
  scheduledAt: new Date('2026-07-01T10:00:00Z'),
  cancelledAt: null,
  cancelReason: null,
  branchId: 'branch-1',
  employeeId: 'emp-1',
  serviceId: 'svc-1',
  title: 'Test',
  durationMins: 60,
  maxCapacity: 10,
  enrolledCount: 0,
  price: 10000,
  currency: 'SAR',
  deliveryType: DeliveryType.IN_PERSON,
  isPublic: false,
});

const mockPrisma = {
  groupSession: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('CancelGroupSessionHandler', () => {
  let handler: CancelGroupSessionHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CancelGroupSessionHandler,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    handler = module.get(CancelGroupSessionHandler);
    jest.clearAllMocks();
  });

  it('cancels an OPEN session successfully', async () => {
    const session = makeSession(GroupSessionStatus.OPEN);
    mockPrisma.groupSession.findUnique.mockResolvedValue(session);
    mockPrisma.groupSession.update.mockResolvedValue({
      ...session,
      status: GroupSessionStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: 'test reason',
    });
    const result = await handler.execute({ groupSessionId: 'session-1', cancelReason: 'test reason' });
    expect(result.status).toBe(GroupSessionStatus.CANCELLED);
    expect(mockPrisma.groupSession.update).toHaveBeenCalledTimes(1);
  });

  it('throws BadRequestException for already CANCELLED session', async () => {
    mockPrisma.groupSession.findUnique.mockResolvedValue(makeSession(GroupSessionStatus.CANCELLED));
    await expect(handler.execute({ groupSessionId: 'session-1' })).rejects.toThrow(BadRequestException);
    expect(mockPrisma.groupSession.update).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for COMPLETED session', async () => {
    mockPrisma.groupSession.findUnique.mockResolvedValue(makeSession(GroupSessionStatus.COMPLETED));
    await expect(handler.execute({ groupSessionId: 'session-1' })).rejects.toThrow(BadRequestException);
    expect(mockPrisma.groupSession.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when session not found', async () => {
    mockPrisma.groupSession.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ groupSessionId: 'bad-id' })).rejects.toThrow(NotFoundException);
  });
});
