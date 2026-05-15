import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListProblemReportsHandler } from './list-problem-reports.handler';

describe('ListProblemReportsHandler', () => {
  let handler: ListProblemReportsHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListProblemReportsHandler,
        { provide: PrismaService, useValue: {
    problemReport: { findMany: jest.fn(), count: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<ListProblemReportsHandler>(ListProblemReportsHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.problemReport.findMany as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({page:1,limit:10,status:"PENDING"});
    expect(result).toBeDefined();
  });
});
