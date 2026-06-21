import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CreateGroupProgramHandler } from './create-group-program.handler';
import { PrismaService } from '../../../infrastructure/database';

const mockPrisma = {
  department: { findFirst: jest.fn() },
  groupProgram: { create: jest.fn() },
};

const BASE_CMD = {
  departmentId: 'dept-id',
  nameAr: 'برنامج دعم الأسرة',
  nameEn: 'Family Support Program',
  descriptionAr: 'وصف البرنامج',
  descriptionEn: 'Program description',
  minParticipants: 3,
  maxParticipants: 20,
  defaultPrice: 5000,
};

const ACTIVE_DEPARTMENT = { id: 'dept-id', isActive: true };

describe('CreateGroupProgramHandler', () => {
  let handler: CreateGroupProgramHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateGroupProgramHandler,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    handler = module.get(CreateGroupProgramHandler);
    jest.clearAllMocks();
  });

  describe('department checks', () => {
    it('throws NotFoundException when department not found', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(null);

      await expect(handler.execute(BASE_CMD)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.groupProgram.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when department is inactive', async () => {
      mockPrisma.department.findFirst.mockResolvedValue({ ...ACTIVE_DEPARTMENT, isActive: false });

      await expect(handler.execute(BASE_CMD)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.groupProgram.create).not.toHaveBeenCalled();
    });
  });

  describe('happy path', () => {
    it('creates a program and returns { id, ref }', async () => {
      mockPrisma.department.findFirst.mockResolvedValue(ACTIVE_DEPARTMENT);
      mockPrisma.groupProgram.create.mockResolvedValue({ id: 'program-id', ref: 'GP-1' });

      const result = await handler.execute(BASE_CMD);

      expect(result).toEqual({ id: 'program-id', ref: 'GP-1' });
      expect(mockPrisma.groupProgram.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.groupProgram.create).toHaveBeenCalledWith({
        data: {
          departmentId: 'dept-id',
          nameAr: 'برنامج دعم الأسرة',
          nameEn: 'Family Support Program',
          descriptionAr: 'وصف البرنامج',
          descriptionEn: 'Program description',
          minParticipants: 3,
          maxParticipants: 20,
          defaultPrice: 5000,
        },
        select: { id: true, ref: true },
      });
    });
  });
});
