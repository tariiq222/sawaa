import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateProgramHandler } from './create-program.handler';
import { CreateProgramDto } from './create-program.dto';
import {
  PrismaService,
  RlsTransactionService,
} from '../../../infrastructure/database';

const buildBaseDto = (): CreateProgramDto => ({
  departmentId: '00000000-0000-4000-a000-000000000001',
  branchId: '00000000-0000-4000-a000-000000000002',
  nameAr: 'برنامج',
  daysCount: 4,
  hoursPerDay: 4,
  minParticipants: 4,
  maxParticipants: 10,
  price: 50000,
  supervisorIds: ['00000000-0000-4000-a000-000000000003'],
});

describe('CreateProgramHandler', () => {
  let handler: CreateProgramHandler;
  let tx: any;
  let rlsTransaction: { withTransaction: jest.Mock };

  beforeEach(async () => {
    tx = {
      department: { findFirst: jest.fn().mockResolvedValue({ id: 'd-1' }) },
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'b-1' }) },
      employee: {
        findMany: jest.fn().mockResolvedValue([{ id: '00000000-0000-4000-a000-000000000003' }]),
      },
      program: {
        create: jest.fn().mockResolvedValue({
          id: 'prog-1',
          ref: 1,
          status: 'DRAFT',
          supervisors: [{ employeeId: '00000000-0000-4000-a000-000000000003' }],
        }),
      },
    };
    rlsTransaction = {
      withTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateProgramHandler,
        { provide: PrismaService, useValue: {} },
        { provide: RlsTransactionService, useValue: rlsTransaction },
      ],
    }).compile();

    handler = module.get<CreateProgramHandler>(CreateProgramHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a DRAFT program with supervisors', async () => {
    const result = await handler.execute({ ...buildBaseDto(), createdBy: 'admin-1' });
    expect(result.status).toBe('DRAFT');
    expect(tx.program.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DRAFT',
          supervisors: {
            create: [
              { employeeId: '00000000-0000-4000-a000-000000000003' },
            ],
          },
        }),
      }),
    );
  });

  it('rejects when min > max', async () => {
    await expect(
      handler.execute({
        ...buildBaseDto(),
        minParticipants: 12,
        maxParticipants: 10,
        createdBy: 'admin-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when deposit > price', async () => {
    await expect(
      handler.execute({
        ...buildBaseDto(),
        depositEnabled: true,
        depositAmount: 90000,
        price: 50000,
        createdBy: 'admin-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when a supervisor ID is missing', async () => {
    tx.employee.findMany.mockResolvedValue([{ id: 'emp-1' }]);
    await expect(
      handler.execute({
        ...buildBaseDto(),
        supervisorIds: ['00000000-0000-4000-a000-000000000099', '00000000-0000-4000-a000-000000000003'],
        createdBy: 'admin-1',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
