import { Test, TestingModule } from '@nestjs/testing';
import { ListProblemReportsHandler } from './list-problem-reports.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('ListProblemReportsHandler', () => {
  let handler: ListProblemReportsHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      problemReport: { findMany: jest.fn(), count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ListProblemReportsHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();

    handler = module.get<ListProblemReportsHandler>(ListProblemReportsHandler);
  });

  it('should list with default pagination', async () => {
    prisma.problemReport.findMany.mockResolvedValue([]);
    prisma.problemReport.count.mockResolvedValue(0);

    const result = await handler.execute({});
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(20);
    expect(prisma.problemReport.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20 }));
  });

  it('should filter by status', async () => {
    prisma.problemReport.findMany.mockResolvedValue([]);
    prisma.problemReport.count.mockResolvedValue(0);

    await handler.execute({ status: 'OPEN', page: 2, limit: 10 });
    expect(prisma.problemReport.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'OPEN' },
      skip: 10,
      take: 10,
    }));
  });
});
