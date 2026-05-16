import { Test, TestingModule } from '@nestjs/testing';
import { ProblemReportStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateProblemReportStatusHandler } from './update-problem-report-status.handler';

describe('UpdateProblemReportStatusHandler', () => {
  let handler: UpdateProblemReportStatusHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateProblemReportStatusHandler,
        { provide: PrismaService, useValue: {
    problemReport: { update: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<UpdateProblemReportStatusHandler>(UpdateProblemReportStatusHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.problemReport.update as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({id:"00000000-0000-0000-0000-000000000001",status:ProblemReportStatus.OPEN,resolution:"test"});
    expect(result).toBeDefined();
  });
});
