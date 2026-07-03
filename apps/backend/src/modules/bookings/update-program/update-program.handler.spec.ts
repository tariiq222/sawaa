import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProgramStatus } from '@prisma/client';
import { UpdateProgramHandler } from './update-program.handler';
import { UpdateProgramDto } from './update-program.dto';
import {
  PrismaService,
  RlsTransactionService,
} from '../../../infrastructure/database';

const PROGRAM_ID = '00000000-0000-4000-a000-000000000010';
const DEPARTMENT_ID = '00000000-0000-4000-a000-000000000001';
const BRANCH_ID = '00000000-0000-4000-a000-000000000002';
const SUPERVISOR_ID = '00000000-0000-4000-a000-000000000003';

const baseExisting = () => ({
  id: PROGRAM_ID,
  status: ProgramStatus.DRAFT,
  enrolledCount: 0,
  maxParticipants: 10,
  departmentId: DEPARTMENT_ID,
  branchId: BRANCH_ID,
});

describe('UpdateProgramHandler', () => {
  let handler: UpdateProgramHandler;
  let tx: any;
  let rlsTransaction: { withTransaction: jest.Mock };

  beforeEach(async () => {
    tx = {
      program: {
        findUnique: jest.fn().mockResolvedValue(baseExisting()),
        update: jest.fn().mockResolvedValue({
          id: PROGRAM_ID,
          ref: 7,
          status: ProgramStatus.DRAFT,
          supervisors: [{ employeeId: SUPERVISOR_ID }],
        }),
      },
      programSupervisor: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      department: {
        findFirst: jest.fn().mockResolvedValue({ id: DEPARTMENT_ID }),
      },
      branch: {
        findFirst: jest.fn().mockResolvedValue({ id: BRANCH_ID }),
      },
      employee: {
        findMany: jest.fn().mockResolvedValue([{ id: SUPERVISOR_ID }]),
      },
    };
    rlsTransaction = {
      withTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateProgramHandler,
        { provide: PrismaService, useValue: {} },
        { provide: RlsTransactionService, useValue: rlsTransaction },
      ],
    }).compile();

    handler = module.get<UpdateProgramHandler>(UpdateProgramHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('updates the existing program row and returns id + status + supervisors', async () => {
    const dto: UpdateProgramDto = {
      departmentId: DEPARTMENT_ID,
      branchId: BRANCH_ID,
      nameAr: 'برنامج محدّث',
      daysCount: 5,
      hoursPerDay: 3,
      minParticipants: 4,
      maxParticipants: 12,
      price: 75000,
      currency: 'SAR',
      depositEnabled: true,
      depositAmount: 20000,
      isPublic: true,
      supervisorIds: [SUPERVISOR_ID],
    };

    const result = await handler.execute(PROGRAM_ID, dto);

    expect(result.id).toBe(PROGRAM_ID);
    expect(result.status).toBe(ProgramStatus.DRAFT);
    expect(result.supervisorIds).toEqual([SUPERVISOR_ID]);
  });

  it('calls program.update on the existing row (not program.create) and persists only fields present in the dto', async () => {
    const dto: UpdateProgramDto = {
      nameAr: 'اسم جديد',
      daysCount: 6,
      hoursPerDay: 4,
      minParticipants: 5,
      maxParticipants: 20,
      price: 100000,
      supervisorIds: [SUPERVISOR_ID],
    };

    await handler.execute(PROGRAM_ID, dto);

    expect(tx.program.create).toBeUndefined();
    expect(tx.program.update).toHaveBeenCalledTimes(1);
    expect(tx.program.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PROGRAM_ID },
        data: expect.objectContaining({
          nameAr: 'اسم جديد',
          daysCount: 6,
        }),
      }),
    );
  });

  it('replaces supervisor rows when supervisorIds is provided (deleteMany + createMany)', async () => {
    const dto: UpdateProgramDto = {
      departmentId: DEPARTMENT_ID,
      branchId: BRANCH_ID,
      nameAr: 'x',
      daysCount: 4,
      hoursPerDay: 2,
      minParticipants: 1,
      maxParticipants: 10,
      price: 1000,
      supervisorIds: [SUPERVISOR_ID],
    };

    await handler.execute(PROGRAM_ID, dto);

    expect(tx.programSupervisor.deleteMany).toHaveBeenCalledWith({
      where: { programId: PROGRAM_ID },
    });
    expect(tx.programSupervisor.createMany).toHaveBeenCalledWith({
      data: [{ programId: PROGRAM_ID, employeeId: SUPERVISOR_ID }],
    });
  });

  it('throws NotFoundException when the program does not exist', async () => {
    tx.program.findUnique.mockResolvedValue(null);

    const dto: UpdateProgramDto = {
      departmentId: DEPARTMENT_ID,
      branchId: BRANCH_ID,
      nameAr: 'x',
      daysCount: 4,
      hoursPerDay: 2,
      minParticipants: 1,
      maxParticipants: 10,
      price: 1000,
      supervisorIds: [SUPERVISOR_ID],
    };

    await expect(handler.execute('missing', dto)).rejects.toThrow(NotFoundException);
    expect(tx.program.update).not.toHaveBeenCalled();
  });

  it('rejects updating a terminal-status program (COMPLETED, CANCELLED)', async () => {
    tx.program.findUnique.mockResolvedValue({
      ...baseExisting(),
      status: ProgramStatus.COMPLETED,
    });

    const dto: UpdateProgramDto = {
      nameAr: 'x',
      daysCount: 4,
      hoursPerDay: 2,
      minParticipants: 1,
      maxParticipants: 10,
      price: 1000,
      supervisorIds: [SUPERVISOR_ID],
    };

    await expect(handler.execute(PROGRAM_ID, dto)).rejects.toThrow(BadRequestException);
    expect(tx.program.update).not.toHaveBeenCalled();
  });

  it('rejects when min > max', async () => {
    const dto: UpdateProgramDto = {
      departmentId: DEPARTMENT_ID,
      branchId: BRANCH_ID,
      nameAr: 'x',
      daysCount: 4,
      hoursPerDay: 2,
      minParticipants: 20,
      maxParticipants: 5,
      price: 1000,
      supervisorIds: [SUPERVISOR_ID],
    };

    await expect(handler.execute(PROGRAM_ID, dto)).rejects.toThrow(BadRequestException);
    expect(tx.program.update).not.toHaveBeenCalled();
  });

  it('rejects when deposit > price', async () => {
    const dto: UpdateProgramDto = {
      departmentId: DEPARTMENT_ID,
      branchId: BRANCH_ID,
      nameAr: 'x',
      daysCount: 4,
      hoursPerDay: 2,
      minParticipants: 1,
      maxParticipants: 10,
      price: 50000,
      depositEnabled: true,
      depositAmount: 90000,
      supervisorIds: [SUPERVISOR_ID],
    };

    await expect(handler.execute(PROGRAM_ID, dto)).rejects.toThrow(BadRequestException);
    expect(tx.program.update).not.toHaveBeenCalled();
  });

  it('rejects when a new departmentId does not exist', async () => {
    tx.department.findFirst.mockResolvedValue(null);

    const dto: UpdateProgramDto = {
      departmentId: '00000000-0000-4000-a000-000000000099',
      branchId: BRANCH_ID,
      nameAr: 'x',
      daysCount: 4,
      hoursPerDay: 2,
      minParticipants: 1,
      maxParticipants: 10,
      price: 1000,
      supervisorIds: [SUPERVISOR_ID],
    };

    await expect(handler.execute(PROGRAM_ID, dto)).rejects.toThrow(NotFoundException);
  });

  it('rejects when a supervisor id does not exist', async () => {
    // Mock returns only "other"; the dto asks for two supervisors including
    // SUPERVISOR_ID and a missing id — lengths mismatch → NotFoundException.
    tx.employee.findMany.mockResolvedValue([{ id: 'other' }]);

    const missingId = '00000000-0000-4000-a000-000000000099';
    const dto: UpdateProgramDto = {
      departmentId: DEPARTMENT_ID,
      branchId: BRANCH_ID,
      nameAr: 'x',
      daysCount: 4,
      hoursPerDay: 2,
      minParticipants: 1,
      maxParticipants: 10,
      price: 1000,
      supervisorIds: [SUPERVISOR_ID, missingId],
    };

    await expect(handler.execute(PROGRAM_ID, dto)).rejects.toThrow(NotFoundException);
  });
});