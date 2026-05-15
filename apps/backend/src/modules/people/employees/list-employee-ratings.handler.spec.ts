import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListEmployeeRatingsHandler } from './list-employee-ratings.handler';

describe('ListEmployeeRatingsHandler', () => {
  let handler: ListEmployeeRatingsHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListEmployeeRatingsHandler,
        { provide: PrismaService, useValue: {
          employee: { findFirst: jest.fn() },
          $transaction: jest.fn(),
        } },
      ],
    }).compile();

    handler = module.get<ListEmployeeRatingsHandler>(ListEmployeeRatingsHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should list ratings', async () => {
    (prisma.employee.findFirst as jest.Mock).mockResolvedValue({ id: 'emp' });
    (prisma.$transaction as jest.Mock).mockImplementation((cb: any) =>
      cb({ rating: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } })
    );
    await handler.execute({ employeeId: 'emp', page: 1, limit: 10 });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('should throw when employee not found', async () => {
    (prisma.employee.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({ employeeId: 'emp' })).rejects.toThrow();
  });
});
