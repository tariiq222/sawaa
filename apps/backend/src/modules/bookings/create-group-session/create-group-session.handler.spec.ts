import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CreateGroupSessionHandler } from './create-group-session.handler';
import { PrismaService } from '../../../infrastructure/database';
import { DeliveryType, GroupSessionStatus } from '@prisma/client';

const mockPrisma = {
  branch: { findFirst: jest.fn() },
  employee: { findFirst: jest.fn() },
  groupProgram: { findFirst: jest.fn() },
  groupSession: { create: jest.fn() },
};

const FUTURE_DATE = new Date(Date.now() + 86400000);

const BASE_CMD = {
  branchId: 'branch-id',
  employeeId: 'emp-id',
  programId: 'p1',
  title: 'Test Session',
  scheduledAt: FUTURE_DATE,
  durationMins: 60,
  maxCapacity: 10,
  price: 10000,
  deliveryType: DeliveryType.IN_PERSON,
};

const ACTIVE_BRANCH = { id: 'branch-id', nameAr: 'الفرع', isActive: true };
const ACTIVE_EMPLOYEE = { id: 'emp-id', name: 'John', isActive: true };
const ACTIVE_PROGRAM = { id: 'p1', isActive: true };

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

  describe('happy path', () => {
    it('creates a session successfully with a future date', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(ACTIVE_BRANCH);
      mockPrisma.employee.findFirst.mockResolvedValue(ACTIVE_EMPLOYEE);
      mockPrisma.groupProgram.findFirst.mockResolvedValue(ACTIVE_PROGRAM);
      mockPrisma.groupSession.create.mockResolvedValue({
        id: 'session-id',
        status: GroupSessionStatus.OPEN,
        scheduledAt: FUTURE_DATE,
      });

      const result = await handler.execute(BASE_CMD);

      expect(result.id).toBe('session-id');
      expect(result.status).toBe(GroupSessionStatus.OPEN);
      expect(mockPrisma.groupSession.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.groupSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ programId: 'p1' }),
        }),
      );
    });
  });

  describe('scheduledAt validation', () => {
    it('throws BadRequestException when scheduledAt is in the past', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      await expect(
        handler.execute({ ...BASE_CMD, scheduledAt: pastDate }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.groupSession.create).not.toHaveBeenCalled();
    });
  });

  describe('branch checks', () => {
    it('throws NotFoundException when branch not found', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(null);

      await expect(handler.execute(BASE_CMD)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.groupSession.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when branch is inactive', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue({ ...ACTIVE_BRANCH, isActive: false });

      await expect(handler.execute(BASE_CMD)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.groupSession.create).not.toHaveBeenCalled();
    });
  });

  describe('employee checks', () => {
    it('throws NotFoundException when employee not found', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(ACTIVE_BRANCH);
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      await expect(handler.execute(BASE_CMD)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.groupSession.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when employee is inactive', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(ACTIVE_BRANCH);
      mockPrisma.employee.findFirst.mockResolvedValue({ ...ACTIVE_EMPLOYEE, isActive: false });

      await expect(handler.execute(BASE_CMD)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.groupSession.create).not.toHaveBeenCalled();
    });
  });

  describe('program checks', () => {
    it('throws NotFoundException when program not found', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(ACTIVE_BRANCH);
      mockPrisma.employee.findFirst.mockResolvedValue(ACTIVE_EMPLOYEE);
      mockPrisma.groupProgram.findFirst.mockResolvedValue(null);

      await expect(handler.execute(BASE_CMD)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.groupSession.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when program is inactive', async () => {
      mockPrisma.branch.findFirst.mockResolvedValue(ACTIVE_BRANCH);
      mockPrisma.employee.findFirst.mockResolvedValue(ACTIVE_EMPLOYEE);
      mockPrisma.groupProgram.findFirst.mockResolvedValue({ id: 'p1', isActive: false });

      await expect(handler.execute(BASE_CMD)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.groupSession.create).not.toHaveBeenCalled();
    });
  });
});
