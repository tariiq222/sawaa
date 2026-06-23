import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { ListEmployeeRatingsHandler } from './list-employee-ratings.handler';

describe('ListEmployeeRatingsHandler', () => {
  let handler: ListEmployeeRatingsHandler;
  let prisma: { employee: { findFirst: jest.Mock } };
  let rlsTransaction: { withTransaction: jest.Mock };

  beforeEach(async () => {
    prisma = { employee: { findFirst: jest.fn() } };
    rlsTransaction = {
      withTransaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          rating: {
            findMany: jest.fn().mockResolvedValue([{ id: 'r1', score: 5 }]),
            count: jest.fn().mockResolvedValue(1),
          },
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListEmployeeRatingsHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: rlsTransaction },
      ],
    }).compile();

    handler = module.get<ListEmployeeRatingsHandler>(ListEmployeeRatingsHandler);
  });

  it('throws NotFoundException when the employee is missing', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ employeeId: 'emp-1' })).rejects.toThrow(NotFoundException);
    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
  });

  it('looks the employee up with a minimal select (id only)', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ employeeId: 'emp-1' })).rejects.toThrow(NotFoundException);
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: { id: 'emp-1' },
      select: { id: true },
    });
  });

  it('queries ratings inside an RLS transaction with skip+take and the employee filter', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });

    let capturedArgs: any = null;
    rlsTransaction.withTransaction.mockImplementationOnce(async (cb: any) => {
      const tx = {
        rating: {
          findMany: jest.fn().mockImplementation((args: any) => {
            capturedArgs = args;
            return [{ id: 'r1', score: 5 }];
          }),
          count: jest.fn().mockResolvedValue(1),
        },
      };
      return cb(tx);
    });
    await handler.execute({ employeeId: 'emp-1', page: 2, limit: 10 });

    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
    expect(capturedArgs).toEqual({
      where: { employeeId: 'emp-1' },
      skip: 10,
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
  });

  it('returns the paginated shape with default page=1, limit=20', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });

    const result = await handler.execute({ employeeId: 'emp-1' });

    expect(result.items).toEqual([{ id: 'r1', score: 5 }]);
    expect(result.meta).toMatchObject({ page: 1, perPage: 20, total: 1, totalPages: 1 });
  });
});