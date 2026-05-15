import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { CreateProblemReportHandler } from './create-problem-report.handler';

describe('CreateProblemReportHandler', () => {
  let handler: CreateProblemReportHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateProblemReportHandler,
        { provide: PrismaService, useValue: {
    problemReport: { create: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<CreateProblemReportHandler>(CreateProblemReportHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.problemReport.create as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({reporterId:"00000000-0000-0000-0000-000000000001",type:"CONSULTATION",title:"test",description:"test notes"});
    expect(result).toBeDefined();
  });
});
