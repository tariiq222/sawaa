import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CreateGroupSessionHandler } from './create-group-session.handler';
import { PrismaService } from '../../../infrastructure/database';
import { DeliveryType, GroupSessionStatus } from '@prisma/client';

const mockPrisma = {
  groupSession: {
    create: jest.fn(),
  },
};

describe('CreateGroupSessionHandler', () => {
  let handler: CreateGroupSessionHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateGroupSessionHandler,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    handler = module.get(CreateGroupSessionHandler);
    jest.clearAllMocks();
  });

  it('creates a session successfully with a future date', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    mockPrisma.groupSession.create.mockResolvedValue({
      id: 'session-id',
      status: GroupSessionStatus.OPEN,
      scheduledAt: futureDate,
    });
    const result = await handler.execute({
      branchId: 'branch-id',
      employeeId: 'emp-id',
      serviceId: 'svc-id',
      title: 'Test Session',
      scheduledAt: futureDate,
      durationMins: 60,
      maxCapacity: 10,
      price: 10000,
      deliveryType: DeliveryType.IN_PERSON,
    });
    expect(result.id).toBe('session-id');
    expect(result.status).toBe(GroupSessionStatus.OPEN);
    expect(mockPrisma.groupSession.create).toHaveBeenCalledTimes(1);
  });

  it('throws BadRequestException when scheduledAt is in the past', async () => {
    const pastDate = new Date(Date.now() - 86400000);
    await expect(
      handler.execute({
        branchId: 'branch-id',
        employeeId: 'emp-id',
        serviceId: 'svc-id',
        title: 'Test Session',
        scheduledAt: pastDate,
        durationMins: 60,
        maxCapacity: 10,
        price: 10000,
        deliveryType: DeliveryType.IN_PERSON,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.groupSession.create).not.toHaveBeenCalled();
  });
});
