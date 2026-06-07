import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { RlsTransactionService } from '../../../infrastructure/database';
import { OnboardEmployeeHandler } from './onboard-employee.handler';

describe('OnboardEmployeeHandler', () => {
  let handler: OnboardEmployeeHandler;
  let prisma: { employee: { findFirst: jest.Mock; create: jest.Mock } };
  let rlsTransaction: { withTransaction: jest.Mock };

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn(), create: jest.fn() },
    };
    rlsTransaction = {
      withTransaction: jest.fn(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardEmployeeHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: rlsTransaction },
      ],
    }).compile();

    handler = module.get<OnboardEmployeeHandler>(OnboardEmployeeHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('creates the employee inside an RLS transaction without a preflight email read', async () => {
    prisma.employee.create.mockResolvedValue({ id: 'emp-1', email: 'test@example.com' });

    const result = await handler.execute({
      nameEn: 'Test',
      nameAr: 'تجربة',
      email: 'test@example.com',
      specialty: 'Test',
    });

    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
    expect(prisma.employee.findFirst).not.toHaveBeenCalled();
    expect(prisma.employee.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: 'test@example.com' }),
    }));
    expect(result.employee.id).toBe('emp-1');
  });

  it('maps the unique email race to ConflictException', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['Employee_email_key'] },
    });
    prisma.employee.create.mockRejectedValue(error);

    await expect(
      handler.execute({
        nameEn: 'Test',
        nameAr: 'تجربة',
        email: 'test@example.com',
        specialty: 'Test',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
